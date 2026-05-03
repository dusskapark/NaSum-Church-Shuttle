import Foundation

enum AdminProvider: String, Codable, CaseIterable, Identifiable, Sendable {
    case line
    case apple
    case google
    case emailPassword = "email_password"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .line: "LINE"
        case .apple: "Apple"
        case .google: "Google"
        case .emailPassword: "Email"
        }
    }
}

enum AdminRegistrationStatus: String, CaseIterable, Identifiable, Sendable {
    case active
    case inactive
    case all

    var id: String { rawValue }
}

enum AdminRegistrationGroup: String, CaseIterable, Identifiable, Sendable {
    case route
    case user

    var id: String { rawValue }
}

enum AdminScheduleStatus: String, Codable, Sendable {
    case draft
    case published
    case archived
}

enum AdminFeedbackStyle: String, Sendable {
    case success
    case error
    case info
}

struct AdminFeedbackMessage: Identifiable, Equatable, Sendable {
    let id: UUID
    let style: AdminFeedbackStyle
    let title: String
    let body: String?
    let duration: TimeInterval?

    init(
        id: UUID = UUID(),
        style: AdminFeedbackStyle,
        title: String,
        body: String? = nil,
        duration: TimeInterval? = nil
    ) {
        self.id = id
        self.style = style
        self.title = title
        self.body = body
        self.duration = duration
    }
}

struct AdminRun: Codable, Identifiable, Sendable {
    let id: String
    let routeId: String
    let routeCode: String?
    let serviceDate: String
    let status: String
    let startedAt: String?
    let endedAt: String?
    let createdMode: String?
    let createdBy: String?
    let endedMode: String?
    let endedBy: String?
}

struct AdminActiveRun: Codable, Identifiable, Sendable {
    var id: String { runId }
    let runId: String
    let routeId: String
    let routeCode: String
    let startedAt: String
    let stopStates: [StopBoardingState]
}

struct AdminRunResult: Codable, Identifiable, Sendable {
    var id: String { run.id }
    let run: AdminRun
    let route: AdminRunResultRoute
    let stopResults: [AdminStopBoardingResult]
}

struct AdminRunResultRoute: Codable, Sendable {
    let routeCode: String
    let displayName: String?

    var title: String {
        let trimmed = displayName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? "Route" : trimmed
    }
}

struct AdminStopBoardingResult: Codable, Identifiable, Sendable {
    var id: String { routeStopId }
    let routeStopId: String
    let stopName: String?
    let totalPassengers: Int
    let status: String
    let riders: [AdminRunRider]
}

struct AdminRunRider: Codable, Identifiable, Sendable {
    var id: String { "\(userId)-\(scannedAt)" }
    let userId: String
    let displayName: String?
    let pictureUrl: String?
    let additionalPassengers: Int
    let scannedAt: String
}

struct AdminAutoRunConfig: Codable, Sendable {
    var enabled: Bool
    var daysOfWeek: [Int]
    var startTime: String
    var endTime: String
    var updatedAt: String?
}

struct AdminRouteListItem: Codable, Identifiable, Sendable {
    let id: String
    let routeCode: String
    let name: String?
    let displayName: String?
    let line: String
    let service: String
    let direction: String?
    let googleMapsUrl: String?
    let syncStatus: String
    let lastSyncedAt: String?
    let syncError: String?
    let active: Bool
    let stopCount: Int
    let incompleteStopCount: Int

    var title: String {
        preferredRouteLabel(displayName: displayName, name: name, line: line, service: service)
    }
}

struct AdminLiveRoute: Codable, Identifiable, Sendable {
    let id: String
    let routeCode: String
    let stops: [AdminLiveStop]
}

struct AdminLiveStop: Codable, Identifiable, Sendable {
    let id: String
    let sequence: Int
    let pickupTime: String?
    let isPickupEnabled: Bool
    let notes: String?
    let stopId: String?
    let place: AdminLiveStopPlace
}

struct AdminLiveStopPlace: Codable, Sendable {
    let name: String
    let displayName: String?
    let isTerminal: Bool
    let googlePlaceId: String
}

struct AdminStop: Codable, Identifiable, Sendable {
    var id: String { routeStopId }
    let routeStopId: String
    let placeId: String
    let sequence: Int
    let pickupTime: String?
    let routeStopNotes: String?
    let isPickupEnabled: Bool
    let googlePlaceId: String
    let placeName: String
    let placeDisplayName: String?
    let placeNotes: String?
    let formattedAddress: String?
    let lat: Double
    let lng: Double
    let isTerminal: Bool
    let stopId: String?

    var title: String {
        placeDisplayName?.nilIfBlank ?? placeName
    }
}

struct AdminScheduleSummary: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let status: AdminScheduleStatus
    let publishedAt: String?
    let hasIncompleteStops: Bool
}

struct AdminSchedule: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let status: AdminScheduleStatus
    let createdAt: String?
    let publishedAt: String?
    let routes: [AdminScheduleRouteSummary]
}

struct AdminScheduleRouteSummary: Codable, Identifiable, Sendable {
    let id: String
    let routeId: String
    let routeCode: String
    let routeName: String?
    let displayName: String?
    let line: String
    let service: String
    let googleMapsUrl: String?
    let stopsSnapshot: [AdminScheduleStopSnapshotSummary]
    let syncStatus: String
    let syncError: String?

    var title: String {
        preferredRouteLabel(displayName: displayName, name: routeName, line: line, service: service)
    }
}

struct AdminScheduleStopSnapshotSummary: Codable, Sendable {
    let isPickupEnabled: Bool
    let pickupTime: String?
    let changeType: String
}

struct AdminScheduleWithRouteDetails: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let status: AdminScheduleStatus
    let createdAt: String?
    let publishedAt: String?
    let routes: [AdminScheduleRouteDetail]
}

struct AdminScheduleRouteDetail: Codable, Identifiable, Sendable {
    let id: String
    let routeId: String
    let routeCode: String
    let routeName: String?
    let displayName: String?
    let line: String
    let service: String
    let googleMapsUrl: String?
    let stopsSnapshot: [AdminScheduleStopSnapshot]
    let syncStatus: String
    let syncedAt: String?
    let syncError: String?
    let active: Bool?

    var title: String {
        preferredRouteLabel(displayName: displayName, name: routeName, line: line, service: service)
    }
}

struct AdminScheduleStopSnapshot: Codable, Identifiable, Sendable {
    var id: String { "\(sequence)-\(googlePlaceId)" }
    let routeStopId: String?
    let sequence: Int
    let pickupTime: String?
    let isPickupEnabled: Bool
    let notes: String?
    let placeId: String?
    let googlePlaceId: String
    let placeName: String
    let placeDisplayName: String?
    let formattedAddress: String?
    let lat: Double
    let lng: Double
    let placeTypes: [String]
    let placeNotes: String?
    let isTerminal: Bool
    let stopId: String?
    let changeType: String

    var title: String {
        placeDisplayName?.nilIfBlank ?? placeName
    }
}

struct AdminPlaceLookup: Codable, Identifiable, Sendable {
    var id: String { googlePlaceId }
    let googlePlaceId: String
    let name: String
    let displayName: String?
    let formattedAddress: String?
    let lat: Double?
    let lng: Double?
    let placeTypes: [String]?
    let isTerminal: Bool
    let stopId: String?
}

struct AdminStopCandidateItem: Codable, Identifiable, Sendable {
    var id: String { googlePlaceId }
    let googlePlaceId: String
    let name: String
    let displayName: String?
    let stopId: String?
    let isTerminal: Bool
    let formattedAddress: String?
    let lat: Double
    let lng: Double
    let placeTypes: [String]
    let notes: String?
    let alreadyInRoute: Bool

    var title: String {
        displayName?.nilIfBlank ?? name
    }
}

struct AdminStopCandidatesResponse: Codable, Sendable {
    let items: [AdminStopCandidateItem]
}

struct AdminPlaceListResponse: Codable, Sendable {
    let items: [AdminPlaceListItem]
}

struct AdminPlaceListItem: Codable, Identifiable, Sendable {
    let id: String
    let googlePlaceId: String
    let name: String
    let displayName: String?
    let formattedAddress: String?
    let lat: Double
    let lng: Double
    let placeTypes: [String]
    let notes: String?
    let isTerminal: Bool
    let stopId: String?
    let routeStopCount: Int
    let scheduleSnapshotCount: Int
    let duplicateCandidateCount: Int

    var title: String {
        displayName?.nilIfBlank ?? name
    }
}

struct AdminPlaceDetail: Codable, Identifiable, Sendable {
    let id: String
    let googlePlaceId: String
    let name: String
    let displayName: String?
    let formattedAddress: String?
    let lat: Double
    let lng: Double
    let placeTypes: [String]
    let notes: String?
    let isTerminal: Bool
    let stopId: String?
    let routeStopCount: Int
    let scheduleSnapshotCount: Int
    let duplicateCandidateCount: Int
    let routeUsages: [AdminPlaceRouteUsage]
    let scheduleUsages: [AdminPlaceScheduleUsage]

    var title: String {
        displayName?.nilIfBlank ?? name
    }
}

struct AdminPlaceRouteUsage: Codable, Identifiable, Sendable {
    var id: String { routeStopId }
    let routeStopId: String
    let routeId: String
    let routeCode: String
    let routeTitle: String
    let sequence: Int
    let pickupTime: String?
    let active: Bool
}

struct AdminPlaceScheduleUsage: Codable, Identifiable, Sendable {
    var id: String { "\(scheduleId)-\(routeId)-\(sequence)-\(changeType)" }
    let scheduleId: String
    let scheduleName: String
    let status: AdminScheduleStatus
    let routeId: String
    let routeCode: String
    let sequence: Int
    let changeType: String
}

struct AdminPlacePatchRequest: Encodable, Sendable {
    let displayName: String?
    let notes: String?
    let isTerminal: Bool
    let stopId: String?
}

struct AdminPlaceMergeRequest: Encodable, Sendable {
    let duplicatePlaceId: String
}

struct AdminPlaceMergeResponse: Codable, Sendable {
    let success: Bool?
    let id: String?
    let updatedRouteStopCount: Int?
}

struct AdminRegistrationRow: Codable, Identifiable, Sendable {
    var id: String { registrationId }
    let registrationId: String
    let userId: String
    let displayName: String?
    let pictureUrl: String?
    let routeCode: String
    let routeName: String?
    let routeDisplayName: String?
    let routeStopId: String
    let sequence: Int
    let pickupTime: String?
    let placeName: String
    let placeDisplayName: String?
    let status: String
    let registeredAt: String?
    let updatedAt: String?

    var userTitle: String { displayName?.nilIfBlank ?? userId }
    var routeTitle: String { routeDisplayName?.nilIfBlank ?? routeName?.nilIfBlank ?? "Route" }
    var stopTitle: String { placeDisplayName?.nilIfBlank ?? placeName }
}

struct AdminPrivilegedUser: Codable, Identifiable, Sendable {
    var id: String { userId }
    let userId: String
    let displayName: String?
    let pictureUrl: String?
    let role: UserRole
    let provider: String
    let providerUid: String
}

struct AdminRouteBundle: Sendable {
    let routes: [AdminRouteListItem]
    let schedules: [AdminScheduleSummary]
    let liveRoutes: [AdminLiveRoute]

    var liveRouteMap: [String: [AdminLiveStop]] {
        Dictionary(uniqueKeysWithValues: liveRoutes.map { ($0.routeCode, $0.stops) })
    }
}

struct AdminRouteSyncResponse: Codable, Sendable {
    let diff: AdminRouteSyncDiff?
    let unresolved: Int?
    let success: Bool?
    let changes: [AdminScheduleStopSnapshot]?
}

struct AdminRouteSyncDiff: Codable, Sendable {
    let added: Int
    let updated: Int
    let removed: Int
}

struct AdminScheduleSyncResponse: Codable, Sendable {
    let synced: Int
    let errors: [AdminScheduleSyncError]
    let totalChanges: Int?
}

struct AdminScheduleSyncError: Codable, Identifiable, Sendable {
    var id: String { routeId }
    let routeId: String
    let error: String
}

struct AdminPublishError: Codable, Sendable {
    let error: String?
    let details: [AdminPublishValidationDetail]?
}

struct AdminPublishValidationDetail: Codable, Sendable {
    let routeCode: String
    let sequences: [Int]
}

struct AdminCreateScheduleResponse: Codable, Sendable {
    let id: String?
    let draft: AdminScheduleSummary?
}

struct AdminMutationResponse: Codable, Sendable {
    let success: Bool?
    let id: String?
}

struct AdminAssignRoleRequest: Encodable, Sendable {
    let providerUid: String
    let provider: String
    let role: String
}

struct AdminRunCreateRequest: Encodable, Sendable {
    let routeCode: String
}

struct AdminStopOverrideRequest: Encodable, Sendable {
    let status: String?
    let totalPassengersOverride: Int?
    let reset: Bool?
}

struct AdminAutoRunUpdateRequest: Encodable, Sendable {
    let enabled: Bool
    let daysOfWeek: [Int]
    let startTime: String
    let endTime: String
}

struct AdminRouteUpdateRequest: Encodable, Sendable {
    let displayName: String?
    let googleMapsUrl: String?
    let active: Bool?
}

struct AdminRouteStopUpdateRequest: Encodable, Sendable {
    let sequence: Int?
    let pickupTime: String?
    let notes: String?
    let isPickupEnabled: Bool?
}

struct AdminPlaceUpdateRequest: Encodable, Sendable {
    let googlePlaceId: String?
    let displayName: String?
    let isTerminal: Bool?
    let stopId: String?
}

struct AdminRouteStopFullUpdateRequest: Encodable, Sendable {
    let sequence: Int?
    let pickupTime: String?
    let notes: String?
    let isPickupEnabled: Bool?
    let displayName: String?
    let placeNotes: String?
    let googlePlaceId: String?
    let isTerminal: Bool?
    let stopId: String?
}

struct AdminScheduleRouteCreateRequest: Encodable, Sendable {
    let routeCode: String
    let line: String
    let service: String
    let googleMapsUrl: String
}

struct AdminScheduleStopPatchRequest: Encodable, Sendable {
    let pickupTime: String?
    let notes: String?
    let isPickupEnabled: Bool?
    let displayName: String?
    let placeNotes: String?
    let googlePlaceId: String?
    let isTerminal: Bool?
    let stopId: String?
    let restore: Bool?
    let moveToSequence: Int?
}

struct AdminScheduleStopCreateRequest: Encodable, Sendable {
    let googlePlaceId: String
    let placeName: String?
    let displayName: String?
    let formattedAddress: String?
    let lat: Double?
    let lng: Double?
    let placeTypes: [String]?
    let placeNotes: String?
    let isTerminal: Bool?
    let stopId: String?
    let isPickupEnabled: Bool
}
