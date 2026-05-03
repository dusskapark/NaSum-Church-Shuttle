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
