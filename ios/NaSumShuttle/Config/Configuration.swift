import Foundation
import UIKit

enum AppConfiguration {
    private static let info = Bundle.main.infoDictionary ?? [:]

    static let appName = stringValue(for: "APP_DISPLAY_NAME") ?? "NaSum Shuttle"
    static let apiBaseURL = URL(string: stringValue(for: "NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000")
    static let authMode = "Provider auth session"
    static let lineChannelID = stringValue(for: "LINE_LOGIN_CHANNEL_ID")
    static let lineUniversalLinkURL = stringValue(for: "LINE_UNIVERSAL_LINK_URL").flatMap(URL.init(string:))
    static let googleMapsAPIKey = stringValue(for: "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY")
    static let apnsBundleID = stringValue(for: "APNS_BUNDLE_ID")
    @MainActor
    static var isLineAppAvailable: Bool {
        guard let url = URL(string: "lineauth2://authorize/") else { return false }
        return UIApplication.shared.canOpenURL(url)
    }

    private static func stringValue(for key: String) -> String? {
        guard let rawValue = info[key] as? String else { return nil }
        let trimmed = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !isUnresolvedBuildSetting(trimmed) else { return nil }
        return trimmed
    }

    private static func isUnresolvedBuildSetting(_ value: String) -> Bool {
        value.hasPrefix("$(") && value.hasSuffix(")")
    }
}
