import Foundation

enum APIError: LocalizedError {
    case missingBaseURL
    case invalidResponse
    case unauthorized
    case status(Int, String)

    var errorDescription: String? {
        switch self {
        case .missingBaseURL:
            return "API_BASE_URL is not configured."
        case .invalidResponse:
            return "The server returned an invalid response."
        case .unauthorized:
            return "Your session expired. Please sign in again."
        case let .status(code, message):
            return message.isEmpty ? "Request failed (\(code))." : message
        }
    }
}

final class APIClient {
    var sessionTokenProvider: (() -> String?)?
    var unauthorizedHandler: (() -> Void)?

    private let baseURL: URL?
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    init(baseURL: URL? = AppConfiguration.apiBaseURL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        self.decoder = decoder

        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        self.encoder = encoder
    }

    func fetchMe() async throws -> MeResponse {
        try await request(path: "/api/v1/me", method: "GET")
    }

    func exchangeLineSession(accessToken: String) async throws -> SessionExchangeResponse {
        try await request(
            path: "/api/v1/auth/session",
            method: "POST",
            body: SessionExchangeRequest(accessToken: accessToken),
            requiresAuth: false
        )
    }

    func exchangeAppleSession(identityToken: String, authorizationCode: String?, nonce: String) async throws -> SessionExchangeResponse {
        try await request(
            path: "/api/v1/auth/session",
            method: "POST",
            body: AppleSessionExchangeRequest(
                identityToken: identityToken,
                authorizationCode: authorizationCode,
                nonce: nonce
            ),
            requiresAuth: false
        )
    }

    func exchangeGoogleSession(idToken: String) async throws -> SessionExchangeResponse {
        try await request(
            path: "/api/v1/auth/session",
            method: "POST",
            body: GoogleSessionExchangeRequest(idToken: idToken),
            requiresAuth: false
        )
    }

    func exchangeEmailPasswordSession(email: String, password: String) async throws -> SessionExchangeResponse {
        try await request(
            path: "/api/v1/auth/session",
            method: "POST",
            body: EmailPasswordSessionRequest(email: email, password: password),
            requiresAuth: false
        )
    }

    func fetchRouteSummaries() async throws -> [RouteSummary] {
        try await request(path: "/api/v1/routes/summary", method: "GET")
    }

    func fetchRouteDetail(routeCode: String) async throws -> RouteDetail {
        try await request(path: "/api/v1/routes/\(routeCode.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? routeCode)", method: "GET")
    }

    func fetchRegistration() async throws -> RegistrationEnvelope {
        try await request(path: "/api/v1/me/registration", method: "GET")
    }

    func updateRegistration(routeCode: String, routeStopId: String) async throws -> EmptySuccessResponse {
        try await request(
            path: "/api/v1/me/registration",
            method: "PUT",
            body: RegistrationUpdateRequest(routeCode: routeCode, routeStopId: routeStopId)
        )
    }

    func deleteRegistration() async throws -> EmptySuccessResponse {
        try await request(path: "/api/v1/me/registration", method: "DELETE")
    }

    func fetchPlaces() async throws -> [PlaceSummary] {
        try await request(path: "/api/v1/places", method: "GET")
    }

    func fetchPlaceRoutes(googlePlaceId: String) async throws -> PlaceRoutesResponse {
        let encoded = googlePlaceId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? googlePlaceId
        return try await request(path: "/api/v1/places/\(encoded)/routes", method: "GET")
    }

    func fetchRunInfo(routeCode: String) async throws -> CheckInRunInfoResponse {
        let encoded = routeCode.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? routeCode
        return try await request(path: "/api/v1/checkin/run?routeCode=\(encoded)", method: "GET")
    }

    func checkIn(runId: String, routeStopId: String, additionalPassengers: Int) async throws -> CheckInResponse {
        try await request(
            path: "/api/v1/checkin",
            method: "POST",
            body: CheckInRequest(runId: runId, routeStopId: routeStopId, additionalPassengers: additionalPassengers)
        )
    }

    func fetchNotifications() async throws -> [AppNotification] {
        try await request(path: "/api/v1/notifications", method: "GET")
    }

    func fetchUnreadCount() async throws -> UnreadCountResponse {
        try await request(path: "/api/v1/notifications/unread-count", method: "GET")
    }

    func markNotificationRead(id: String) async throws -> EmptySuccessResponse {
        let encoded = id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
        return try await request(path: "/api/v1/notifications/\(encoded)/read", method: "PATCH")
    }

    func markAllNotificationsRead() async throws -> EmptySuccessResponse {
        try await request(path: "/api/v1/notifications/read-all", method: "PATCH")
    }

    func updatePreferences(pushNotificationsEnabled: Bool? = nil, preferredLanguage: AppLanguage? = nil) async throws -> EmptySuccessResponse {
        try await request(
            path: "/api/v1/me/preferences",
            method: "PATCH",
            body: PreferencesUpdateRequest(
                pushNotificationsEnabled: pushNotificationsEnabled,
                preferredLanguage: preferredLanguage
            )
        )
    }

    func registerPushToken(token: String, bundleId: String?, environment: String?) async throws -> PushTokenRegistrationResponse {
        try await request(
            path: "/api/v1/push-tokens",
            method: "POST",
            body: PushTokenRegistrationRequest(token: token, bundleId: bundleId, apnsEnvironment: environment)
        )
    }

    func deletePushToken(token: String) async throws -> EmptySuccessResponse {
        let encoded = token.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? token
        return try await request(path: "/api/v1/push-tokens/\(encoded)", method: "DELETE")
    }

    func fetchAdminRuns(status: String) async throws -> [AdminRun] {
        let encoded = status.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? status
        return try await request(path: "/api/v1/admin/runs?status=\(encoded)", method: "GET")
    }

    func fetchAdminActiveRun(routeCode: String) async throws -> AdminActiveRun? {
        let encoded = routeCode.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? routeCode
        return try await request(path: "/api/v1/checkin/run-status?routeCode=\(encoded)", method: "GET")
    }

    func createAdminRun(routeCode: String) async throws -> AdminRun {
        try await request(
            path: "/api/v1/admin/runs",
            method: "POST",
            body: AdminRunCreateRequest(routeCode: routeCode)
        )
    }

    func endAdminRun(runId: String) async throws -> AdminRun {
        let encoded = runId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? runId
        return try await request(path: "/api/v1/admin/runs/\(encoded)/end", method: "POST")
    }

    func updateAdminStopOverride(runId: String, stopId: String, status: String?, passengerOverride: Int?, reset: Bool = false) async throws -> AdminMutationResponse {
        let run = runId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? runId
        let stop = stopId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? stopId
        return try await request(
            path: "/api/v1/admin/runs/\(run)/stops/\(stop)",
            method: "PATCH",
            body: AdminStopOverrideRequest(
                status: status,
                totalPassengersOverride: passengerOverride,
                reset: reset ? true : nil
            )
        )
    }

    func fetchAdminRunResult(runId: String) async throws -> AdminRunResult {
        let encoded = runId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? runId
        return try await request(path: "/api/v1/admin/runs/\(encoded)/results", method: "GET")
    }

    func fetchAdminAutoRunConfig() async throws -> AdminAutoRunConfig {
        try await request(path: "/api/v1/admin/run-schedule", method: "GET")
    }

    func updateAdminAutoRunConfig(_ config: AdminAutoRunUpdateRequest) async throws -> AdminAutoRunConfig {
        try await request(path: "/api/v1/admin/run-schedule", method: "PUT", body: config)
    }

    func fetchAdminRegistrations(status: AdminRegistrationStatus) async throws -> [AdminRegistrationRow] {
        let encoded = status.rawValue.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? status.rawValue
        return try await request(path: "/api/v1/admin/registrations?status=\(encoded)", method: "GET")
    }

    func deleteAdminRegistration(registrationId: String) async throws -> AdminMutationResponse {
        let encoded = registrationId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? registrationId
        return try await request(path: "/api/v1/admin/registrations/\(encoded)", method: "DELETE")
    }

    func fetchAdminUsers() async throws -> [AdminPrivilegedUser] {
        try await request(path: "/api/v1/admin/users", method: "GET")
    }

    func assignAdminUser(providerUid: String, provider: AdminProvider, role: UserRole) async throws -> AdminPrivilegedUser {
        try await request(
            path: "/api/v1/admin/users",
            method: "POST",
            body: AdminAssignRoleRequest(providerUid: providerUid, provider: provider.rawValue, role: role.rawValue)
        )
    }

    func revokeAdminUser(userId: String) async throws -> AdminMutationResponse {
        let encoded = userId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? userId
        return try await request(path: "/api/v1/admin/users/\(encoded)", method: "DELETE")
    }

    func fetchAdminRoutes() async throws -> [AdminRouteListItem] {
        try await request(path: "/api/v1/admin/routes", method: "GET")
    }

    func fetchAdminRoute(routeId: String) async throws -> AdminRouteListItem {
        let encoded = routeId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? routeId
        return try await request(path: "/api/v1/admin/routes/\(encoded)", method: "GET")
    }

    func fetchAdminRouteStops(routeId: String) async throws -> [AdminStop] {
        let encoded = routeId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? routeId
        return try await request(path: "/api/v1/admin/routes/\(encoded)/stops", method: "GET")
    }

    func fetchAdminLiveRoutes() async throws -> [AdminLiveRoute] {
        try await request(path: "/api/v1/routes", method: "GET")
    }

    func fetchAdminSchedules() async throws -> [AdminScheduleSummary] {
        try await request(path: "/api/v1/admin/schedules", method: "GET")
    }

    func createAdminSchedule() async throws -> AdminCreateScheduleResponse {
        try await request(path: "/api/v1/admin/schedules", method: "POST")
    }

    func fetchAdminSchedule(scheduleId: String) async throws -> AdminScheduleWithRouteDetails {
        let encoded = scheduleId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? scheduleId
        return try await request(path: "/api/v1/admin/schedules/\(encoded)", method: "GET")
    }

    func deleteAdminSchedule(scheduleId: String) async throws -> AdminMutationResponse {
        let encoded = scheduleId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? scheduleId
        return try await request(path: "/api/v1/admin/schedules/\(encoded)", method: "DELETE")
    }

    func syncAdminSchedule(scheduleId: String) async throws -> AdminScheduleSyncResponse {
        let encoded = scheduleId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? scheduleId
        return try await request(path: "/api/v1/admin/schedules/\(encoded)/sync", method: "POST")
    }

    func publishAdminSchedule(scheduleId: String) async throws -> AdminMutationResponse {
        let encoded = scheduleId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? scheduleId
        return try await request(path: "/api/v1/admin/schedules/\(encoded)/publish", method: "POST")
    }

    func restoreAdminSchedule(scheduleId: String) async throws -> AdminMutationResponse {
        let encoded = scheduleId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? scheduleId
        return try await request(path: "/api/v1/admin/schedules/\(encoded)/restore", method: "POST")
    }

    func addAdminScheduleRoute(scheduleId: String, request body: AdminScheduleRouteCreateRequest) async throws -> AdminMutationResponse {
        let encoded = scheduleId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? scheduleId
        return try await request(path: "/api/v1/admin/schedules/\(encoded)/routes", method: "POST", body: body)
    }

    func updateAdminRoute(routeId: String, request body: AdminRouteUpdateRequest) async throws -> AdminRouteListItem {
        let encoded = routeId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? routeId
        return try await request(path: "/api/v1/admin/routes/\(encoded)", method: "PATCH", body: body)
    }

    func syncAdminRoute(routeId: String) async throws -> AdminRouteSyncResponse {
        let encoded = routeId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? routeId
        return try await request(path: "/api/v1/admin/routes/\(encoded)/sync", method: "POST")
    }

    func syncAdminScheduleRoute(scheduleId: String, routeId: String) async throws -> AdminRouteSyncResponse {
        let schedule = scheduleId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? scheduleId
        let route = routeId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? routeId
        return try await request(path: "/api/v1/admin/schedules/\(schedule)/routes/\(route)/sync", method: "POST")
    }

    func updateAdminRouteStop(routeId: String, stopId: String, request body: AdminRouteStopUpdateRequest) async throws -> AdminMutationResponse {
        let route = routeId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? routeId
        let stop = stopId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? stopId
        return try await request(path: "/api/v1/admin/routes/\(route)/stops/\(stop)", method: "PATCH", body: body)
    }

    func updateAdminRouteStopPlace(routeId: String, stopId: String, request body: AdminPlaceUpdateRequest) async throws -> AdminMutationResponse {
        let route = routeId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? routeId
        let stop = stopId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? stopId
        return try await request(path: "/api/v1/admin/routes/\(route)/stops/\(stop)/place", method: "PATCH", body: body)
    }

    func updateAdminRouteStopFull(routeId: String, stopId: String, request body: AdminRouteStopFullUpdateRequest) async throws -> AdminMutationResponse {
        let route = routeId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? routeId
        let stop = stopId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? stopId
        return try await request(path: "/api/v1/admin/routes/\(route)/stops/\(stop)/full", method: "PATCH", body: body)
    }

    func deleteAdminRouteStop(routeId: String, stopId: String) async throws -> AdminMutationResponse {
        let route = routeId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? routeId
        let stop = stopId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? stopId
        return try await request(path: "/api/v1/admin/routes/\(route)/stops/\(stop)", method: "DELETE")
    }

    func fetchAdminPlaceLookup(googlePlaceId: String) async throws -> AdminPlaceLookup {
        let encoded = googlePlaceId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? googlePlaceId
        return try await request(path: "/api/v1/admin/places/lookup/\(encoded)", method: "GET")
    }

    func fetchAdminPlaces(query search: String, duplicatesOnly: Bool) async throws -> AdminPlaceListResponse {
        let q = search.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? search
        return try await request(path: "/api/v1/admin/places?q=\(q)&duplicates=\(duplicatesOnly ? "true" : "false")", method: "GET")
    }

    func fetchAdminPlace(placeId: String) async throws -> AdminPlaceDetail {
        let encoded = placeId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? placeId
        return try await request(path: "/api/v1/admin/places/\(encoded)", method: "GET")
    }

    func fetchAdminPlaceDuplicates(placeId: String) async throws -> AdminPlaceListResponse {
        let encoded = placeId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? placeId
        return try await request(path: "/api/v1/admin/places/\(encoded)/duplicates", method: "GET")
    }

    func updateAdminPlace(placeId: String, request body: AdminPlacePatchRequest) async throws -> AdminMutationResponse {
        let encoded = placeId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? placeId
        return try await request(path: "/api/v1/admin/places/\(encoded)", method: "PATCH", body: body)
    }

    func mergeAdminPlace(placeId: String, duplicatePlaceId: String) async throws -> AdminPlaceMergeResponse {
        let encoded = placeId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? placeId
        return try await request(
            path: "/api/v1/admin/places/\(encoded)/merge",
            method: "POST",
            body: AdminPlaceMergeRequest(duplicatePlaceId: duplicatePlaceId)
        )
    }

    func fetchAdminScheduleStopCandidates(scheduleId: String, routeId: String, query search: String) async throws -> AdminStopCandidatesResponse {
        let schedule = scheduleId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? scheduleId
        let route = routeId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? routeId
        let q = search.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? search
        return try await request(path: "/api/v1/admin/schedules/\(schedule)/routes/\(route)/stops/candidates?q=\(q)", method: "GET")
    }

    func updateAdminScheduleStop(scheduleId: String, routeId: String, sequence: Int, request body: AdminScheduleStopPatchRequest) async throws -> AdminMutationResponse {
        let schedule = scheduleId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? scheduleId
        let route = routeId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? routeId
        return try await request(path: "/api/v1/admin/schedules/\(schedule)/routes/\(route)/stops/\(sequence)", method: "PATCH", body: body)
    }

    func deleteAdminScheduleStop(scheduleId: String, routeId: String, sequence: Int) async throws -> AdminMutationResponse {
        let schedule = scheduleId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? scheduleId
        let route = routeId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? routeId
        return try await request(path: "/api/v1/admin/schedules/\(schedule)/routes/\(route)/stops/\(sequence)", method: "DELETE")
    }

    func addAdminScheduleStop(scheduleId: String, routeId: String, request body: AdminScheduleStopCreateRequest) async throws -> AdminMutationResponse {
        let schedule = scheduleId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? scheduleId
        let route = routeId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? routeId
        return try await request(path: "/api/v1/admin/schedules/\(schedule)/routes/\(route)/stops", method: "POST", body: body)
    }

    private func request<T: Decodable>(path: String, method: String, requiresAuth: Bool = true) async throws -> T {
        try await request(path: path, method: method, body: Optional<String>.none, requiresAuth: requiresAuth)
    }

    private func request<T: Decodable, Body: Encodable>(
        path: String,
        method: String,
        body: Body?,
        requiresAuth: Bool = true
    ) async throws -> T {
        guard let baseURL else {
            throw APIError.missingBaseURL
        }

        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw APIError.invalidResponse
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 30
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if requiresAuth, let token = sessionTokenProvider?(), !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            request.httpBody = try encoder.encode(body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if httpResponse.statusCode == 401 {
            await MainActor.run {
                self.unauthorizedHandler?()
            }
            throw APIError.unauthorized
        }

        guard (200 ..< 300).contains(httpResponse.statusCode) else {
            throw APIError.status(httpResponse.statusCode, Self.extractErrorMessage(from: data))
        }

        if T.self == EmptySuccessResponse.self, data.isEmpty {
            return EmptySuccessResponse(success: true) as! T
        }

        return try decoder.decode(T.self, from: data)
    }

    private static func extractErrorMessage(from data: Data) -> String {
        guard !data.isEmpty else { return "" }

        if
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let error = json["error"] as? String
        {
            return error
        }

        guard let raw = String(data: data, encoding: .utf8) else {
            return ""
        }

        let normalized = raw.replacingOccurrences(of: "\n", with: " ").trimmingCharacters(in: .whitespacesAndNewlines)
        if normalized.localizedCaseInsensitiveContains("no tunnel here") {
            return "The development server tunnel is unavailable. Update NEXT_PUBLIC_APP_URL to a live backend URL and try again."
        }

        let plainText = stripHTML(from: normalized)
        return plainText.isEmpty ? normalized : plainText
    }

    private static func stripHTML(from string: String) -> String {
        guard string.contains("<"), string.contains(">") else {
            return string
        }

        let pattern = "<[^>]+>"
        let stripped = (try? NSRegularExpression(pattern: pattern))
            .map { regex in
                regex.stringByReplacingMatches(
                    in: string,
                    range: NSRange(string.startIndex..., in: string),
                    withTemplate: " "
                )
            } ?? string

        return stripped
            .replacingOccurrences(of: "&nbsp;", with: " ")
            .replacingOccurrences(of: "&lt;", with: "<")
            .replacingOccurrences(of: "&gt;", with: ">")
            .replacingOccurrences(of: "&amp;", with: "&")
            .split(whereSeparator: \.isWhitespace)
            .joined(separator: " ")
    }
}
