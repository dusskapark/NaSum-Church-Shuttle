import AuthenticationServices
import CryptoKit
import Foundation
import Security
import UIKit
#if canImport(GoogleSignIn)
import GoogleSignIn
#endif

struct AppleAuthCredential: Sendable {
    let identityToken: String
    let authorizationCode: String?
    let nonce: String
}

struct GoogleAuthCredential: Sendable {
    let idToken: String
}

enum NativeAuthProviderError: LocalizedError {
    case missingPresenter
    case missingGoogleClientID
    case googleSDKUnavailable
    case missingAppleCredential
    case missingIdentityToken
    case missingGoogleIDToken
    case cancelled

    var errorDescription: String? {
        switch self {
        case .missingPresenter:
            return "A presenting view controller is required to start login."
        case .missingGoogleClientID:
            return "GOOGLE_IOS_CLIENT_ID is not configured."
        case .googleSDKUnavailable:
            return "GoogleSignIn package is not available in this build."
        case .missingAppleCredential:
            return "Apple login did not return an Apple ID credential."
        case .missingIdentityToken:
            return "The identity token was not returned by the provider."
        case .missingGoogleIDToken:
            return "Google login succeeded but no ID token was returned."
        case .cancelled:
            return "The login was cancelled."
        }
    }
}

enum AppleNonce {
    static func randomString(length: Int = 32) -> String {
        precondition(length > 0)
        let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        var result = ""
        var remainingLength = length

        while remainingLength > 0 {
            var randoms = [UInt8](repeating: 0, count: 16)
            let status = SecRandomCopyBytes(kSecRandomDefault, randoms.count, &randoms)
            if status != errSecSuccess {
                fatalError("Unable to generate a secure nonce.")
            }

            randoms.forEach { random in
                guard remainingLength > 0 else { return }
                if Int(random) < charset.count {
                    result.append(charset[Int(random)])
                    remainingLength -= 1
                }
            }
        }

        return result
    }

    static func sha256(_ input: String) -> String {
        let digest = SHA256.hash(data: Data(input.utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }
}

enum AppleAuthParser {
    static func credential(from authorization: ASAuthorization, nonce: String) throws -> AppleAuthCredential {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            throw NativeAuthProviderError.missingAppleCredential
        }
        guard
            let identityTokenData = credential.identityToken,
            let identityToken = String(data: identityTokenData, encoding: .utf8),
            !identityToken.isEmpty
        else {
            throw NativeAuthProviderError.missingIdentityToken
        }

        let authorizationCode = credential.authorizationCode.flatMap {
            String(data: $0, encoding: .utf8)
        }

        return AppleAuthCredential(
            identityToken: identityToken,
            authorizationCode: authorizationCode,
            nonce: nonce
        )
    }
}

@MainActor
final class GoogleAuthManager {
    private let clientID: String?

    init(clientID: String? = AppConfiguration.googleIOSClientID) {
        self.clientID = clientID
    }

    func handleOpenURL(_ url: URL) -> Bool {
        #if canImport(GoogleSignIn)
        GIDSignIn.sharedInstance.handle(url)
        #else
        false
        #endif
    }

    func signIn(presentingViewController: UIViewController?) async throws -> GoogleAuthCredential {
        guard let presentingViewController else {
            throw NativeAuthProviderError.missingPresenter
        }
        guard let clientID, !clientID.isEmpty else {
            throw NativeAuthProviderError.missingGoogleClientID
        }

        #if canImport(GoogleSignIn)
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
        let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: presentingViewController)
        guard let idToken = result.user.idToken?.tokenString, !idToken.isEmpty else {
            throw NativeAuthProviderError.missingGoogleIDToken
        }
        return GoogleAuthCredential(idToken: idToken)
        #else
        throw NativeAuthProviderError.googleSDKUnavailable
        #endif
    }

    func logout() {
        #if canImport(GoogleSignIn)
        GIDSignIn.sharedInstance.signOut()
        #endif
    }
}
