import CoreLocation
import Foundation
import Observation
import UIKit

@MainActor
@Observable
final class AppModel {
    enum Mode {
        case live
        case previewLoggedOut
        case previewLoggedIn
    }

    private enum Constants {
        static let keychainService = "org.nasumik.NaSumShuttle"
        static let sessionAccount = "session-jwt"
    }

    let apiClient: APIClient
    let authProvider: AuthProviding
    let pushManager: PushNotificationManager

    var isBootstrapping = true
    var isLoading = false
    var isAuthenticating = false
    var errorMessage: String?

    var sessionToken: String?
    var currentUser: MeResponse?
    var routeSummaries: [RouteSummary] = []
    var registration: RegistrationEnvelope?
    var places: [PlaceSummary] = []
    var notifications: [AppNotification] = []
    var unreadCount = 0
    var selectedRouteCode: String?
    var routeDetails: [String: RouteDetail] = [:]
    var routeCandidates: [String: PlaceRoutesResponse] = [:]
    var runInfoByRouteCode: [String: CheckInRunInfoResponse] = [:]
    var lastCheckInResponse: CheckInResponse?

    private let mode: Mode

    init(mode: Mode = .live) {
        self.mode = mode
        self.apiClient = APIClient()
        self.authProvider = LineAuthManager()
        self.pushManager = PushNotificationManager()

        apiClient.sessionTokenProvider = { [weak self] in
            self?.sessionToken
        }
        apiClient.unauthorizedHandler = { [weak self] in
            Task { @MainActor in
                await self?.handleUnauthorized()
            }
        }
        pushManager.onDeviceTokenUpdated = { [weak self] token in
            Task { @MainActor in
                await self?.registerPushTokenIfPossible(token: token)
            }
        }

        if mode == .previewLoggedIn {
            applyPreviewState()
        }
    }

    var isAuthenticated: Bool {
        sessionToken != nil && currentUser != nil
    }

    var preferredLanguage: AppLanguage {
        currentUser?.preferredLanguage ?? .ko
    }

    var isAdminSurfaceEnabled: Bool {
        guard let role = currentUser?.role else { return false }
        return role == .admin || role == .driver
    }

    func bootstrap() async {
        defer { isBootstrapping = false }

        switch mode {
        case .previewLoggedOut:
            return
        case .previewLoggedIn:
            return
        case .live:
            break
        }

        sessionToken = SecureStore.load(service: Constants.keychainService, account: Constants.sessionAccount)
        guard sessionToken != nil else { return }

        do {
            try await refreshAll()
            await pushManager.refreshAuthorizationStatus()
            await registerPushTokenIfPossible(token: pushManager.deviceTokenHex)
        } catch {
            await handleUnauthorized()
        }
    }

    func signIn(presentingViewController: UIViewController?) async {
        guard mode == .live else { return }
        isAuthenticating = true
        errorMessage = nil

        defer { isAuthenticating = false }

        do {
            let identity = try await authProvider.login(presentingViewController: presentingViewController)
            let session = try await apiClient.exchangeLineSession(accessToken: identity.accessToken)

            sessionToken = session.sessionToken
            SecureStore.save(session.sessionToken, service: Constants.keychainService, account: Constants.sessionAccount)
            try await refreshAll()
            await pushManager.requestAuthorizationIfNeeded()
            await registerPushTokenIfPossible(token: pushManager.deviceTokenHex)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func signInWithEmail(email: String, password: String) async {
        guard mode == .live else { return }
        isAuthenticating = true
        errorMessage = nil

        defer { isAuthenticating = false }

        do {
            let session = try await apiClient.exchangeEmailPasswordSession(
                email: email,
                password: password
            )

            sessionToken = session.sessionToken
            SecureStore.save(session.sessionToken, service: Constants.keychainService, account: Constants.sessionAccount)
            try await refreshAll()
            await pushManager.requestAuthorizationIfNeeded()
            await registerPushTokenIfPossible(token: pushManager.deviceTokenHex)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func logout() async {
        if let token = pushManager.deviceTokenHex {
            _ = try? await apiClient.deletePushToken(token: token)
        }

        await authProvider.logout()
        sessionToken = nil
        currentUser = nil
        registration = nil
        routeSummaries = []
        places = []
        notifications = []
        unreadCount = 0
        selectedRouteCode = nil
        routeDetails = [:]
        runInfoByRouteCode = [:]
        SecureStore.delete(service: Constants.keychainService, account: Constants.sessionAccount)
    }

    func refreshAll() async throws {
        guard mode == .live else { return }

        isLoading = true
        defer { isLoading = false }

        async let meTask = apiClient.fetchMe()
        async let routesTask = apiClient.fetchRouteSummaries()
        async let registrationTask = apiClient.fetchRegistration()
        async let placesTask = apiClient.fetchPlaces()
        async let notificationsTask = apiClient.fetchNotifications()
        async let unreadTask = apiClient.fetchUnreadCount()

        let me = try await meTask
        let routes = try await routesTask
        let registration = try await registrationTask
        let places = try await placesTask
        let notifications = try await notificationsTask
        let unreadCount = try await unreadTask

        currentUser = me
        routeSummaries = routes
        self.registration = registration
        self.places = places
        self.notifications = notifications
        self.unreadCount = unreadCount.unreadCount

        let preferredRouteCode = registration.registration?.route.routeCode ?? routes.first?.routeCode
        if let preferredRouteCode {
            selectedRouteCode = preferredRouteCode
            try await loadRouteDetail(routeCode: preferredRouteCode)
            try? await loadRunInfo(routeCode: preferredRouteCode)
        }
    }

    func loadRouteDetail(routeCode: String) async throws {
        if routeDetails[routeCode] != nil { return }
        let detail = try await apiClient.fetchRouteDetail(routeCode: routeCode)
        routeDetails[routeCode] = detail
    }

    func selectRoute(routeCode: String) async {
        selectedRouteCode = routeCode
        do {
            try await loadRouteDetail(routeCode: routeCode)
            try? await loadRunInfo(routeCode: routeCode)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadPlaceRoutes(googlePlaceId: String) async {
        if routeCandidates[googlePlaceId] != nil { return }
        do {
            routeCandidates[googlePlaceId] = try await apiClient.fetchPlaceRoutes(googlePlaceId: googlePlaceId)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func registerStop(routeCode: String, routeStopId: String) async {
        do {
            _ = try await apiClient.updateRegistration(routeCode: routeCode, routeStopId: routeStopId)
            registration = try await apiClient.fetchRegistration()
            if let routeCode = registration?.registration?.route.routeCode {
                selectedRouteCode = routeCode
                routeDetails[routeCode] = registration?.registration?.route
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func removeRegistration() async {
        do {
            _ = try await apiClient.deleteRegistration()
            registration = try await apiClient.fetchRegistration()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func reloadNotifications() async {
        do {
            notifications = try await apiClient.fetchNotifications()
            let unreadResponse = try await apiClient.fetchUnreadCount()
            unreadCount = unreadResponse.unreadCount
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func markNotificationRead(_ notification: AppNotification) async {
        do {
            _ = try await apiClient.markNotificationRead(id: notification.id)
            await reloadNotifications()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func markAllNotificationsRead() async {
        do {
            _ = try await apiClient.markAllNotificationsRead()
            await reloadNotifications()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func updatePreferences(pushNotificationsEnabled: Bool? = nil, preferredLanguage: AppLanguage? = nil) async {
        do {
            _ = try await apiClient.updatePreferences(
                pushNotificationsEnabled: pushNotificationsEnabled,
                preferredLanguage: preferredLanguage
            )
            currentUser = try await apiClient.fetchMe()
            if pushNotificationsEnabled == true {
                await pushManager.requestAuthorizationIfNeeded()
            }
            if pushNotificationsEnabled == false, let token = pushManager.deviceTokenHex {
                _ = try? await apiClient.deletePushToken(token: token)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadRunInfo(routeCode: String) async throws {
        runInfoByRouteCode[routeCode] = try await apiClient.fetchRunInfo(routeCode: routeCode)
    }

    func checkIn(routeCode: String, routeStopId: String, additionalPassengers: Int) async {
        do {
            if runInfoByRouteCode[routeCode] == nil {
                try await loadRunInfo(routeCode: routeCode)
            }
            guard let run = runInfoByRouteCode[routeCode]?.run else { return }
            lastCheckInResponse = try await apiClient.checkIn(
                runId: run.id,
                routeStopId: routeStopId,
                additionalPassengers: additionalPassengers
            )
            try await loadRunInfo(routeCode: routeCode)
            await reloadNotifications()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func parseRouteCode(from scannedText: String) -> String? {
        if let url = URL(string: scannedText), let components = URLComponents(url: url, resolvingAgainstBaseURL: false) {
            if let routeCode = components.queryItems?.first(where: { $0.name == "routeCode" })?.value {
                return routeCode
            }

            if
                let liffState = components.queryItems?.first(where: { $0.name == "liff.state" })?.value,
                let stateURL = URL(string: liffState),
                let nestedComponents = URLComponents(url: stateURL, resolvingAgainstBaseURL: false),
                let routeCode = nestedComponents.queryItems?.first(where: { $0.name == "routeCode" })?.value
            {
                return routeCode
            }
        }

        return scannedText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? nil
            : scannedText.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    func clearError() {
        errorMessage = nil
    }

    func handleIncomingURL(_ url: URL) -> Bool {
        authProvider.handleOpenURL(url)
    }

    func registerPushTokenIfPossible(token: String?) async {
        guard
            mode == .live,
            let token,
            currentUser?.pushNotificationsEnabled == true
        else {
            return
        }

        do {
            _ = try await apiClient.registerPushToken(
                token: token,
                bundleId: AppConfiguration.apnsBundleID,
                environment: "sandbox"
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func handleUnauthorized() async {
        await logout()
        errorMessage = APIError.unauthorized.localizedDescription
    }

    private func applyPreviewState() {
        sessionToken = "preview"
        currentUser = PreviewFixtures.me
        routeSummaries = PreviewFixtures.routeSummaries
        registration = PreviewFixtures.registration
        routeDetails[PreviewFixtures.routeDetail.routeCode] = PreviewFixtures.routeDetail
        selectedRouteCode = PreviewFixtures.routeDetail.routeCode
        places = [
            PlaceSummary(
                googlePlaceId: "google-1",
                name: "강남역",
                lat: 37.4979,
                lng: 127.0276,
                isTerminal: false
            )
        ]
        notifications = PreviewFixtures.notifications
        unreadCount = notifications.filter { !$0.isRead }.count
        runInfoByRouteCode[PreviewFixtures.routeDetail.routeCode] = CheckInRunInfoResponse(
            run: ShuttleRun(
                id: "run-1",
                routeId: PreviewFixtures.routeDetail.id,
                serviceDate: ISO8601DateFormatter().string(from: .now),
                status: "active",
                startedAt: ISO8601DateFormatter().string(from: .now),
                endedAt: nil
            ),
            route: PreviewFixtures.routeDetail,
            stopStates: [
                StopBoardingState(routeStopId: "stop-1", totalPassengers: 12, status: "arrived")
            ],
            myCheckin: nil
        )
        isBootstrapping = false
    }
}
