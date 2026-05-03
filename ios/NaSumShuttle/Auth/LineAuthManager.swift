import AuthenticationServices
import Foundation
import Security
import UIKit
#if canImport(LineSDK)
import LineSDK
#endif

struct AuthIdentity: Sendable {
    let accessToken: String
    let idToken: String?
}

@MainActor
protocol AuthProviding: AnyObject {
    func handleOpenURL(_ url: URL) -> Bool
    func login(presentingViewController: UIViewController?) async throws -> AuthIdentity
    func logout() async
}

enum AuthProviderError: LocalizedError {
    case missingPresenter
    case lineSDKUnavailable
    case lineConfigurationMissing
    case lineAppUnavailable
    case missingAccessToken
    case cancelled

    var errorDescription: String? {
        switch self {
        case .missingPresenter:
            return "A presenting view controller is required to start LINE login."
        case .lineSDKUnavailable:
            return "LineSDK package is not available in this build."
        case .lineConfigurationMissing:
            return "LINE_LOGIN_CHANNEL_ID is not configured."
        case .lineAppUnavailable:
            return "LINE app login is unavailable on this device. Install or open the LINE app and try again. Web login fallback is disabled for this native client."
        case .missingAccessToken:
            return "LINE login succeeded but no access token was returned."
        case .cancelled:
            return "The login was cancelled."
        }
    }
}

private func sanitizeAuthErrorMessage(_ raw: String) -> String {
    let normalized = raw
        .replacingOccurrences(of: "\n", with: " ")
        .replacingOccurrences(of: "\r", with: " ")
        .trimmingCharacters(in: .whitespacesAndNewlines)

    guard !normalized.isEmpty else {
        return "Authentication failed."
    }

    let strippedHTML = stripMarkup(from: normalized)
    let compact = strippedHTML
        .components(separatedBy: .whitespacesAndNewlines)
        .filter { !$0.isEmpty }
        .joined(separator: " ")

    if compact.localizedCaseInsensitiveContains("page not found") ||
        compact.contains("self.__next_f")
    {
        return """
        LINE login callback failed. The LINE Login channel may be redirecting to an invalid web page instead of returning to the iOS app. Check the LINE Login channel settings for bundle ID \(Bundle.main.bundleIdentifier ?? "unknown") and callback configuration.
        """
    }

    return compact
}

private func stripMarkup(from string: String) -> String {
    let withoutTags = (try? NSRegularExpression(pattern: "<[^>]+>"))?
        .stringByReplacingMatches(
            in: string,
            range: NSRange(string.startIndex..., in: string),
            withTemplate: " "
        ) ?? string

    let withoutEntities = withoutTags
        .replacingOccurrences(of: "&nbsp;", with: " ")
        .replacingOccurrences(of: "&lt;", with: "<")
        .replacingOccurrences(of: "&gt;", with: ">")
        .replacingOccurrences(of: "&amp;", with: "&")

    if let rscRange = withoutEntities.range(of: "(self.__next_f=") {
        return String(withoutEntities[..<rscRange.lowerBound])
    }

    return withoutEntities
}

private func debugLineAuthLog(_ message: @autoclosure () -> String) {
    #if DEBUG
    print("[LineAuthManager] \(message())")
    #endif
}

@MainActor
final class LineAuthManager: AuthProviding {
    private let channelID: String?
    private let universalLinkURL: URL?
    private var didSetup = false

    init(channelID: String? = AppConfiguration.lineChannelID, universalLinkURL: URL? = AppConfiguration.lineUniversalLinkURL) {
        self.channelID = channelID
        self.universalLinkURL = universalLinkURL

        setupIfNeeded()
    }

    func handleOpenURL(_ url: URL) -> Bool {
        #if canImport(LineSDK)
        let handled = LoginManager.shared.application(.shared, open: url)
        debugLineAuthLog("handleOpenURL url=\(url.absoluteString) handled=\(handled)")
        return handled
        #else
        return false
        #endif
    }

    func login(presentingViewController: UIViewController?) async throws -> AuthIdentity {
        guard presentingViewController != nil else {
            throw AuthProviderError.missingPresenter
        }
        guard let channelID, !channelID.isEmpty else {
            throw AuthProviderError.lineConfigurationMissing
        }
        debugLineAuthLog("login requested channelID=\(channelID) bundleID=\(Bundle.main.bundleIdentifier ?? "nil") lineAppAvailable=\(isLineAppAvailable) universalLink=\(universalLinkURL?.absoluteString ?? "nil")")
        guard isLineAppAvailable else {
            debugLineAuthLog("aborting before LINE SDK login because lineauth2 scheme is unavailable.")
            throw AuthProviderError.lineAppUnavailable
        }

        setupIfNeeded()

        #if canImport(LineSDK)
        let presenter = presentingViewController!
        return try await withCheckedThrowingContinuation { continuation in
            let parameters = LoginManager.Parameters()
            LoginManager.shared.login(
                permissions: [.profile],
                in: presenter,
                parameters: parameters
            ) { result in
                switch result {
                case let .success(loginResult):
                    let grantedPermissions = loginResult.permissions.map(\.rawValue).sorted().joined(separator: ",")
                    let tokenPermissions = loginResult.accessToken.permissions.map(\.rawValue).sorted().joined(separator: ",")
                    debugLineAuthLog("login success grantedPermissions=\(grantedPermissions) tokenPermissions=\(tokenPermissions) hasIDToken=\(loginResult.accessToken.IDTokenRaw != nil) nonceReturned=\(loginResult.IDTokenNonce != nil)")
                    let accessToken = loginResult.accessToken.value
                    guard !accessToken.isEmpty else {
                        debugLineAuthLog("login returned without accessToken.")
                        continuation.resume(throwing: AuthProviderError.missingAccessToken)
                        return
                    }

                    continuation.resume(returning: AuthIdentity(
                        accessToken: accessToken,
                        idToken: loginResult.accessToken.IDTokenRaw
                    ))

                case let .failure(error):
                    let nsError = error as NSError
                    debugLineAuthLog("login failed domain=\(nsError.domain) code=\(nsError.code) description=\(nsError.localizedDescription)")
                    if (error as NSError).code == ASWebAuthenticationSessionError.canceledLogin.rawValue {
                        continuation.resume(throwing: AuthProviderError.cancelled)
                    } else {
                        let sdkMessage = sanitizeAuthErrorMessage((error as NSError).localizedDescription)
                        let wrappedError = NSError(
                            domain: (error as NSError).domain,
                            code: (error as NSError).code,
                            userInfo: [
                                NSLocalizedDescriptionKey: "LINE login failed. \(sdkMessage)",
                                NSUnderlyingErrorKey: error,
                            ]
                        )
                        continuation.resume(throwing: wrappedError)
                    }
                }
            }
        }
        #else
        throw AuthProviderError.lineSDKUnavailable
        #endif
    }

    func logout() async {
        #if canImport(LineSDK)
        try? await LoginManager.shared.logout()
        #endif
    }

    private func setupIfNeeded() {
        #if canImport(LineSDK)
        guard !didSetup, let channelID, !channelID.isEmpty else { return }
        debugLineAuthLog("setup channelID=\(channelID) universalLinkURL=\(universalLinkURL?.absoluteString ?? "nil")")
        LoginManager.shared.setup(channelID: channelID, universalLinkURL: universalLinkURL)
        didSetup = true
        #endif
    }

    private var isLineAppAvailable: Bool {
        #if canImport(LineSDK)
        guard let url = URL(string: "lineauth2://authorize/") else {
            return false
        }
        return UIApplication.shared.canOpenURL(url)
        #else
        return false
        #endif
    }
}

@MainActor
final class PreviewAuthProvider: AuthProviding {
    func handleOpenURL(_ url: URL) -> Bool {
        false
    }

    func login(presentingViewController: UIViewController?) async throws -> AuthIdentity {
        throw AuthProviderError.lineConfigurationMissing
    }

    func logout() async {}
}

enum SecureStore {
    static func save(_ value: String, service: String, account: String) {
        let data = Data(value.utf8)
        let baseQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]

        SecItemDelete(baseQuery as CFDictionary)

        var query = baseQuery
        query[kSecValueData as String] = data
        SecItemAdd(query as CFDictionary, nil)
    }

    static func load(service: String, account: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else {
            return nil
        }

        return String(data: data, encoding: .utf8)
    }

    static func delete(service: String, account: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
