import Foundation

struct MeResponse: Codable, Sendable {
    let userId: String
    let providerUid: String?
    let displayName: String?
    let pictureUrl: String?
    let email: String?
    let role: UserRole
    let preferredLanguage: AppLanguage
    let pushNotificationsEnabled: Bool
    let createdAt: String
}

struct SessionExchangeResponse: Decodable, Sendable {
    let userId: String
    let providerUid: String?
    let displayName: String?
    let pictureUrl: String?
    let statusMessage: String?
    let email: String?
    let role: UserRole
    let sessionToken: String

    enum CodingKeys: String, CodingKey {
        case userId
        case providerUid
        case displayName
        case pictureUrl
        case statusMessage
        case email
        case role
        case sessionToken
        case idToken
        case user
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let nestedUser = try container.decodeIfPresent(AuthSessionUser.self, forKey: .user)
        userId =
            try container.decodeIfPresent(String.self, forKey: .userId)
            ?? nestedUser?.id
            ?? ""
        providerUid = try container.decodeIfPresent(String.self, forKey: .providerUid)
        displayName =
            try container.decodeIfPresent(String.self, forKey: .displayName)
            ?? nestedUser?.displayName
        pictureUrl =
            try container.decodeIfPresent(String.self, forKey: .pictureUrl)
            ?? nestedUser?.pictureUrl
        statusMessage = try container.decodeIfPresent(String.self, forKey: .statusMessage)
        email =
            try container.decodeIfPresent(String.self, forKey: .email)
            ?? nestedUser?.email
        role =
            try container.decodeIfPresent(UserRole.self, forKey: .role)
            ?? nestedUser?.role
            ?? .rider
        sessionToken =
            try container.decodeIfPresent(String.self, forKey: .sessionToken)
            ?? container.decode(String.self, forKey: .idToken)
    }
}

private struct AuthSessionUser: Decodable, Sendable {
    let id: String
    let displayName: String?
    let pictureUrl: String?
    let email: String?
    let role: UserRole
}

enum UserRole: String, Codable, Sendable {
    case rider
    case driver
    case admin
}

enum AppLanguage: String, Codable, CaseIterable, Sendable {
    case ko
    case en

    var label: String {
        switch self {
        case .ko:
            return "한국어"
        case .en:
            return "English"
        }
    }
}

enum AppThemePreference: String, Codable, CaseIterable, Sendable {
    case system
    case light
    case dark

    func label(language: AppLanguage) -> String {
        switch self {
        case .system:
            return RiderStrings.settingsThemeSystem(language)
        case .light:
            return RiderStrings.settingsThemeLight(language)
        case .dark:
            return RiderStrings.settingsThemeDark(language)
        }
    }
}

struct RouteSummary: Codable, Identifiable, Sendable {
    let id: String
    let routeCode: String
    let name: String?
    let displayName: String?
    let line: String
    let service: String
    let revision: String
    let googleMapsUrl: String?
    let active: Bool
    let visibleStopCount: Int

    var label: String {
        displayName?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
            ? displayName!
            : [line, service, "R\(revision)"].joined(separator: " · ")
    }
}

struct RoutePathPoint: Codable, Hashable, Sendable {
    let lat: Double
    let lng: Double
}

struct Place: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let googlePlaceId: String
    let name: String
    let displayName: String?
    let address: String?
    let formattedAddress: String?
    let primaryType: String?
    let primaryTypeDisplayName: String?
    let lat: Double
    let lng: Double
    let placeTypes: [String]
    let notes: String?
    let isTerminal: Bool
    let stopId: String?
}

struct RouteStop: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let routeId: String
    let placeId: String
    let sequence: Int
    let pickupTime: String?
    let notes: String?
    let isPickupEnabled: Bool
    let place: Place
}

struct RouteDetail: Codable, Identifiable, Sendable {
    let id: String
    let routeCode: String
    let name: String?
    let displayName: String?
    let line: String
    let service: String
    let revision: String
    let googleMapsUrl: String?
    let active: Bool
    let stops: [RouteStop]
    let cachedPath: [RoutePathPoint]
    let pathCacheStatus: String
    let pathCacheUpdatedAt: String?
    let pathCacheExpiresAt: String?
    let pathCacheError: String?

    var label: String {
        displayName?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
            ? displayName!
            : [line, service, "R\(revision)"].joined(separator: " · ")
    }
}

struct RegistrationEnvelope: Codable, Sendable {
    let registered: Bool
    let registration: RegistrationRecord?
    let stopActive: Bool?
}

struct RegistrationRecord: Codable, Sendable {
    let id: String
    let userId: String
    let routeId: String
    let routeStopId: String
    let status: String
    let route: RouteDetail
    let routeStop: RouteStop
}

struct PlaceSummary: Codable, Identifiable, Hashable, Sendable {
    var id: String { googlePlaceId }
    let googlePlaceId: String
    let name: String
    let lat: Double
    let lng: Double
    let isTerminal: Bool
}

struct StopCandidate: Codable, Identifiable, Hashable, Sendable {
    var id: String { routeStopId }
    let routeStopId: String
    let routeCode: String
    let routeLabel: String
    let stopOrder: Int
    let pickupTime: String?
    let notes: String?
    let googleMapsUrl: String?
    let address: String?
    let formattedAddress: String?
    let primaryType: String?
    let primaryTypeDisplayName: String?
    let placeTypes: [String]
    let isTerminal: Bool
    let stopId: String?
    let name: String
    let lat: Double
    let lng: Double

    enum CodingKeys: String, CodingKey {
        case routeStopId
        case routeCode
        case routeLabel
        case stopOrder
        case pickupTime
        case notes
        case googleMapsUrl
        case address
        case formattedAddress
        case primaryType
        case primaryTypeDisplayName
        case placeTypes
        case isTerminal
        case stopId
        case name
        case lat
        case lng
    }
}

extension StopCandidate {
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        routeStopId = try container.decode(String.self, forKey: .routeStopId)
        routeCode = try container.decode(String.self, forKey: .routeCode)
        routeLabel = try container.decode(String.self, forKey: .routeLabel)
        stopOrder = try container.decode(Int.self, forKey: .stopOrder)
        pickupTime = try container.decodeIfPresent(String.self, forKey: .pickupTime)
        notes = try container.decodeIfPresent(String.self, forKey: .notes)
        googleMapsUrl = try container.decodeIfPresent(String.self, forKey: .googleMapsUrl)
        address = try container.decodeIfPresent(String.self, forKey: .address)
        formattedAddress = try container.decodeIfPresent(String.self, forKey: .formattedAddress)
        primaryType = try container.decodeIfPresent(String.self, forKey: .primaryType)
        primaryTypeDisplayName = try container.decodeIfPresent(String.self, forKey: .primaryTypeDisplayName)
        placeTypes = try container.decodeIfPresent([String].self, forKey: .placeTypes) ?? []
        isTerminal = try container.decodeIfPresent(Bool.self, forKey: .isTerminal) ?? false
        stopId = try container.decodeIfPresent(String.self, forKey: .stopId)
        name = try container.decode(String.self, forKey: .name)
        lat = try container.decode(Double.self, forKey: .lat)
        lng = try container.decode(Double.self, forKey: .lng)
    }
}

struct PlaceRoutesResponse: Codable, Sendable {
    let sourceStop: StopCandidate?
    let matchingStops: [StopCandidate]
}

struct ShuttleRun: Codable, Identifiable, Sendable {
    let id: String
    let routeId: String
    let serviceDate: String
    let status: String
    let startedAt: String?
    let endedAt: String?
}

struct StopBoardingState: Codable, Hashable, Sendable {
    let routeStopId: String
    let totalPassengers: Int
    let status: String
}

struct CheckInRunInfoResponse: Codable, Sendable {
    struct ExistingCheckIn: Codable, Sendable {
        let checkinId: String
        let routeStopId: String
        let stopState: StopBoardingState
    }

    let run: ShuttleRun
    let route: RouteDetail
    let stopStates: [StopBoardingState]
    let myCheckin: ExistingCheckIn?
}

struct CheckInResponse: Codable, Sendable {
    let success: Bool
    let checkinId: String
    let stopState: StopBoardingState
}

struct AppNotification: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let runId: String
    let triggerStopId: String
    let stopsAway: Int
    let titleKo: String
    let bodyKo: String
    let titleEn: String
    let bodyEn: String
    let isRead: Bool
    let createdAt: String
    let routeCode: String?
    let userRouteStopId: String?

    func title(for language: AppLanguage) -> String {
        language == .en ? titleEn : titleKo
    }

    func body(for language: AppLanguage) -> String {
        language == .en ? bodyEn : bodyKo
    }
}

struct UnreadCountResponse: Codable, Sendable {
    let unreadCount: Int
}

struct PushTokenRegistrationResponse: Codable, Sendable {
    let success: Bool
    let id: String
    let token: String
    let bundleId: String
    let apnsEnvironment: String
    let isActive: Bool
    let updatedAt: String
}

struct EmptySuccessResponse: Codable, Sendable {
    let success: Bool
}

struct SessionExchangeRequest: Encodable, Sendable {
    let provider = "line"
    let credential: LineSessionCredential

    init(accessToken: String) {
        self.credential = LineSessionCredential(accessToken: accessToken)
    }
}

struct LineSessionCredential: Encodable, Sendable {
    let accessToken: String
}

struct AppleSessionExchangeRequest: Encodable, Sendable {
    let provider = "apple"
    let credential: AppleSessionCredential

    init(identityToken: String, authorizationCode: String?, nonce: String) {
        self.credential = AppleSessionCredential(
            identityToken: identityToken,
            authorizationCode: authorizationCode,
            nonce: nonce
        )
    }
}

struct AppleSessionCredential: Encodable, Sendable {
    let identityToken: String
    let authorizationCode: String?
    let nonce: String
}

struct GoogleSessionExchangeRequest: Encodable, Sendable {
    let provider = "google"
    let credential: GoogleSessionCredential

    init(idToken: String) {
        self.credential = GoogleSessionCredential(idToken: idToken)
    }
}

struct GoogleSessionCredential: Encodable, Sendable {
    let idToken: String
}

struct EmailPasswordSessionRequest: Encodable, Sendable {
    let provider = "email_password"
    let credential: EmailPasswordCredential

    init(email: String, password: String) {
        self.credential = EmailPasswordCredential(email: email, password: password)
    }
}

struct EmailPasswordCredential: Encodable, Sendable {
    let email: String
    let password: String
}

struct RegistrationUpdateRequest: Encodable, Sendable {
    let routeCode: String
    let routeStopId: String

    enum CodingKeys: String, CodingKey {
        case routeCode = "route_code"
        case routeStopId = "route_stop_id"
    }
}

struct PreferencesUpdateRequest: Encodable, Sendable {
    let pushNotificationsEnabled: Bool?
    let preferredLanguage: AppLanguage?

    enum CodingKeys: String, CodingKey {
        case pushNotificationsEnabled = "push_notifications_enabled"
        case preferredLanguage = "preferred_language"
    }
}

struct PushTokenRegistrationRequest: Encodable, Sendable {
    let token: String
    let bundleId: String?
    let apnsEnvironment: String?

    enum CodingKeys: String, CodingKey {
        case token
        case bundleId = "bundle_id"
        case apnsEnvironment = "apns_environment"
    }
}

struct CheckInRequest: Encodable, Sendable {
    let runId: String
    let routeStopId: String
    let additionalPassengers: Int

    enum CodingKeys: String, CodingKey {
        case runId = "run_id"
        case routeStopId = "route_stop_id"
        case additionalPassengers = "additional_passengers"
    }
}
