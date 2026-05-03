package sg.nasumchurch.shuttle.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import sg.nasumchurch.shuttle.BuildConfig
import sg.nasumchurch.shuttle.sharedmodel.*
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

class APIException(message: String, val status: Int = 0) : Exception(message)

class APIClient(
    private val baseUrl: String = BuildConfig.API_BASE_URL,
    private val sessionTokenProvider: () -> String? = { null },
) {
    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        encodeDefaults = true
    }

    suspend fun fetchMe(): MeResponse = request("/api/v1/me")
    suspend fun fetchRouteSummaries(): List<RouteSummary> = request("/api/v1/routes/summary")
    suspend fun fetchRouteDetail(routeCode: String): RouteDetail = request("/api/v1/routes/${path(routeCode)}")
    suspend fun fetchRegistration(): RegistrationEnvelope = request("/api/v1/me/registration")
    suspend fun fetchPlaces(): List<PlaceSummary> = request("/api/v1/places")
    suspend fun fetchPlaceRoutes(googlePlaceId: String): PlaceRoutesResponse = request("/api/v1/places/${path(googlePlaceId)}/routes")
    suspend fun fetchNotifications(): List<AppNotification> = request("/api/v1/notifications")
    suspend fun fetchUnreadCount(): UnreadCountResponse = request("/api/v1/notifications/unread-count")
    suspend fun fetchRunInfo(routeCode: String): CheckInRunInfoResponse = request("/api/v1/checkin/run?routeCode=${query(routeCode)}")
    suspend fun fetchAdminRuns(status: String): List<AdminRun> = request("/api/v1/admin/runs?status=${query(status)}")
    suspend fun fetchAdminRegistrations(status: String = "active"): List<AdminRegistrationRow> = request("/api/v1/admin/registrations?status=${query(status)}")
    suspend fun fetchAdminUsers(): List<AdminPrivilegedUser> = request("/api/v1/admin/users")

    suspend fun exchangeLineSession(accessToken: String): SessionExchangeResponse =
        request("/api/v1/auth/session", "POST", LineSessionExchangeRequest(accessToken), requiresAuth = false)

    suspend fun exchangeGoogleSession(idToken: String): SessionExchangeResponse =
        request("/api/v1/auth/session", "POST", GoogleSessionExchangeRequest(idToken), requiresAuth = false)

    suspend fun exchangeEmailPasswordSession(email: String, password: String): SessionExchangeResponse =
        request("/api/v1/auth/session", "POST", EmailPasswordSessionExchangeRequest(email, password), requiresAuth = false)

    suspend fun updateRegistration(routeCode: String, routeStopId: String): EmptySuccessResponse =
        request("/api/v1/me/registration", "PUT", RegistrationUpdateRequest(routeCode, routeStopId))

    suspend fun deleteRegistration(): EmptySuccessResponse = request("/api/v1/me/registration", "DELETE")

    suspend fun checkIn(runId: String, routeStopId: String, additionalPassengers: Int): CheckInResponse =
        request("/api/v1/checkin", "POST", CheckInRequest(runId, routeStopId, additionalPassengers))

    suspend fun markNotificationRead(id: String): EmptySuccessResponse =
        request("/api/v1/notifications/${path(id)}/read", "PATCH")

    suspend fun markAllNotificationsRead(): EmptySuccessResponse =
        request("/api/v1/notifications/read-all", "PATCH")

    suspend fun updatePreferences(pushNotificationsEnabled: Boolean? = null, preferredLanguage: AppLanguage? = null): EmptySuccessResponse =
        request("/api/v1/me/preferences", "PATCH", PreferencesUpdateRequest(pushNotificationsEnabled, preferredLanguage))

    suspend fun registerAndroidPushToken(token: String): PushTokenRegistrationResponse =
        request("/api/v1/push-tokens", "POST", AndroidPushTokenRegistrationRequest(token))

    suspend fun deletePushToken(token: String): EmptySuccessResponse =
        request("/api/v1/push-tokens/${path(token)}", "DELETE")

    private suspend inline fun <reified T> request(
        path: String,
        method: String = "GET",
        requiresAuth: Boolean = true,
    ): T = request(path, method, NoBody, requiresAuth)

    private suspend inline fun <reified T, reified Body> request(
        path: String,
        method: String = "GET",
        body: Body,
        requiresAuth: Boolean = true,
    ): T = withContext(Dispatchers.IO) {
        val connection = (URL(URL(baseUrl), path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 30_000
            readTimeout = 30_000
            setRequestProperty("Accept", "application/json")
            if (requiresAuth) {
                sessionTokenProvider()?.takeIf { it.isNotBlank() }?.let {
                    setRequestProperty("Authorization", "Bearer $it")
                }
            }
            if (body !is NoBody) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                outputStream.use { output ->
                    output.write(json.encodeToString(body).toByteArray(Charsets.UTF_8))
                }
            }
        }

        val status = connection.responseCode
        val text = (if (status in 200..299) connection.inputStream else connection.errorStream)
            ?.bufferedReader()
            ?.use { it.readText() }
            .orEmpty()

        if (status !in 200..299) {
            throw APIException(extractError(text).ifBlank { "Request failed ($status)." }, status)
        }

        if (T::class == EmptySuccessResponse::class && text.isBlank()) {
            @Suppress("UNCHECKED_CAST")
            return@withContext EmptySuccessResponse(true) as T
        }

        json.decodeFromString<T>(text)
    }

    private fun extractError(text: String): String {
        val parsed = runCatching { json.parseToJsonElement(text) }.getOrNull()
        val error = parsed?.let { element ->
            element as? kotlinx.serialization.json.JsonObject
        }?.get("error")?.toString()?.trim('"')
        return error ?: text.replace(Regex("<[^>]+>"), " ").split(Regex("\\s+")).joinToString(" ").trim()
    }

    companion object {
        fun path(value: String): String = URLEncoder.encode(value, Charsets.UTF_8.name()).replace("+", "%20")
        fun query(value: String): String = URLEncoder.encode(value, Charsets.UTF_8.name())
    }
}

@Serializable private object NoBody

@Serializable
private data class LineSessionExchangeRequest(
    val provider: String = "line",
    val credential: LineCredential,
) {
    constructor(accessToken: String) : this(credential = LineCredential(accessToken))
}

@Serializable private data class LineCredential(val accessToken: String)

@Serializable
private data class GoogleSessionExchangeRequest(
    val provider: String = "google",
    val credential: GoogleCredential,
) {
    constructor(idToken: String) : this(credential = GoogleCredential(idToken))
}

@Serializable private data class GoogleCredential(val idToken: String)

@Serializable
private data class EmailPasswordSessionExchangeRequest(
    val provider: String = "email_password",
    val credential: EmailPasswordCredential,
) {
    constructor(email: String, password: String) : this(credential = EmailPasswordCredential(email, password))
}

@Serializable private data class EmailPasswordCredential(val email: String, val password: String)

@Serializable
private data class RegistrationUpdateRequest(
    @SerialName("route_code") val routeCode: String,
    @SerialName("route_stop_id") val routeStopId: String,
)

@Serializable
private data class PreferencesUpdateRequest(
    @SerialName("push_notifications_enabled") val pushNotificationsEnabled: Boolean? = null,
    @SerialName("preferred_language") val preferredLanguage: AppLanguage? = null,
)

@Serializable
private data class AndroidPushTokenRegistrationRequest(
    val token: String,
    val platform: String = "android",
    @SerialName("package_name") val packageName: String = BuildConfig.APPLICATION_ID,
)

@Serializable
private data class CheckInRequest(
    @SerialName("run_id") val runId: String,
    @SerialName("route_stop_id") val routeStopId: String,
    @SerialName("additional_passengers") val additionalPassengers: Int,
)
