package sg.nasumchurch.shuttle.sharedmodel

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

enum class UserRole { rider, driver, admin }
enum class AppLanguage { ko, en }
enum class AppThemePreference { system, light, dark }

@Serializable
data class MeResponse(
    @SerialName("userId") val userId: String,
    @SerialName("providerUid") val providerUid: String? = null,
    @SerialName("displayName") val displayName: String? = null,
    @SerialName("pictureUrl") val pictureUrl: String? = null,
    val email: String? = null,
    val role: UserRole = UserRole.rider,
    @SerialName("preferredLanguage") val preferredLanguage: AppLanguage = AppLanguage.ko,
    @SerialName("pushNotificationsEnabled") val pushNotificationsEnabled: Boolean = true,
    @SerialName("createdAt") val createdAt: String = "",
)

@Serializable
data class AuthUser(
    val id: String,
    @SerialName("displayName") val displayName: String? = null,
    @SerialName("pictureUrl") val pictureUrl: String? = null,
    val email: String? = null,
    val role: UserRole = UserRole.rider,
)

@Serializable
data class SessionExchangeResponse(
    @SerialName("sessionToken") val sessionToken: String? = null,
    @SerialName("idToken") val legacyIdToken: String? = null,
    val user: AuthUser? = null,
    @SerialName("userId") val userId: String? = null,
    @SerialName("providerUid") val providerUid: String? = null,
    @SerialName("displayName") val displayName: String? = null,
    @SerialName("pictureUrl") val pictureUrl: String? = null,
    val email: String? = null,
    val role: UserRole = UserRole.rider,
) {
    val token: String get() = sessionToken ?: legacyIdToken.orEmpty()
}

@Serializable
data class RouteSummary(
    val id: String,
    @SerialName("routeCode") val routeCode: String,
    val name: String? = null,
    @SerialName("displayName") val displayName: String? = null,
    val line: String = "",
    val service: String = "",
    val revision: String = "",
    @SerialName("googleMapsUrl") val googleMapsUrl: String? = null,
    val active: Boolean = true,
    @SerialName("visibleStopCount") val visibleStopCount: Int = 0,
) {
    val label: String get() = displayName?.takeIf { it.isNotBlank() } ?: name?.takeIf { it.isNotBlank() } ?: listOf(line, service).filter { it.isNotBlank() }.joinToString(" ").ifBlank { "Route" }
}

@Serializable
data class RoutePathPoint(val lat: Double, val lng: Double)

@Serializable
data class Place(
    val id: String,
    @SerialName("googlePlaceId") val googlePlaceId: String,
    val name: String,
    @SerialName("displayName") val displayName: String? = null,
    val address: String? = null,
    @SerialName("formattedAddress") val formattedAddress: String? = null,
    @SerialName("primaryType") val primaryType: String? = null,
    @SerialName("primaryTypeDisplayName") val primaryTypeDisplayName: String? = null,
    val lat: Double,
    val lng: Double,
    @SerialName("placeTypes") val placeTypes: List<String> = emptyList(),
    val notes: String? = null,
    @SerialName("isTerminal") val isTerminal: Boolean = false,
    @SerialName("stopId") val stopId: String? = null,
)

@Serializable
data class RouteStop(
    val id: String,
    @SerialName("routeId") val routeId: String,
    @SerialName("placeId") val placeId: String,
    val sequence: Int,
    @SerialName("pickupTime") val pickupTime: String? = null,
    val notes: String? = null,
    @SerialName("isPickupEnabled") val isPickupEnabled: Boolean = true,
    val place: Place,
)

@Serializable
data class RouteDetail(
    val id: String,
    @SerialName("routeCode") val routeCode: String,
    val name: String? = null,
    @SerialName("displayName") val displayName: String? = null,
    val line: String = "",
    val service: String = "",
    val revision: String = "",
    @SerialName("googleMapsUrl") val googleMapsUrl: String? = null,
    val active: Boolean = true,
    val stops: List<RouteStop> = emptyList(),
    @SerialName("cachedPath") val cachedPath: List<RoutePathPoint> = emptyList(),
    @SerialName("pathCacheStatus") val pathCacheStatus: String = "missing",
) {
    val label: String get() = displayName?.takeIf { it.isNotBlank() } ?: name?.takeIf { it.isNotBlank() } ?: listOf(line, service).filter { it.isNotBlank() }.joinToString(" ").ifBlank { "Route" }
}

@Serializable
data class RegistrationEnvelope(
    val registered: Boolean,
    val registration: RegistrationRecord? = null,
    @SerialName("stopActive") val stopActive: Boolean? = null,
)

@Serializable
data class RegistrationRecord(
    val id: String,
    @SerialName("userId") val userId: String,
    @SerialName("routeId") val routeId: String,
    @SerialName("routeStopId") val routeStopId: String,
    val status: String,
    val route: RouteDetail,
    @SerialName("routeStop") val routeStop: RouteStop,
)

@Serializable
data class PlaceSummary(
    @SerialName("googlePlaceId") val googlePlaceId: String,
    val name: String,
    val lat: Double,
    val lng: Double,
    @SerialName("isTerminal") val isTerminal: Boolean = false,
)

@Serializable
data class StopCandidate(
    @SerialName("routeStopId") val routeStopId: String,
    @SerialName("routeCode") val routeCode: String,
    @SerialName("routeLabel") val routeLabel: String,
    @SerialName("stopOrder") val stopOrder: Int,
    @SerialName("pickupTime") val pickupTime: String? = null,
    val notes: String? = null,
    @SerialName("googleMapsUrl") val googleMapsUrl: String? = null,
    val address: String? = null,
    @SerialName("formattedAddress") val formattedAddress: String? = null,
    @SerialName("isTerminal") val isTerminal: Boolean = false,
    @SerialName("stopId") val stopId: String? = null,
    val name: String,
    val lat: Double,
    val lng: Double,
)

@Serializable
data class PlaceRoutesResponse(
    @SerialName("sourceStop") val sourceStop: StopCandidate? = null,
    @SerialName("matchingStops") val matchingStops: List<StopCandidate> = emptyList(),
)

@Serializable
data class ShuttleRun(
    val id: String,
    @SerialName("routeId") val routeId: String,
    @SerialName("serviceDate") val serviceDate: String,
    val status: String,
    @SerialName("startedAt") val startedAt: String? = null,
    @SerialName("endedAt") val endedAt: String? = null,
)

@Serializable
data class StopBoardingState(
    @SerialName("routeStopId") val routeStopId: String,
    @SerialName("totalPassengers") val totalPassengers: Int,
    val status: String,
)

@Serializable
data class CheckInRunInfoResponse(
    val run: ShuttleRun? = null,
    val route: RouteDetail,
    @SerialName("stopStates") val stopStates: List<StopBoardingState> = emptyList(),
)

@Serializable
data class CheckInResponse(
    val success: Boolean,
    @SerialName("checkinId") val checkinId: String,
    @SerialName("stopState") val stopState: StopBoardingState,
)

@Serializable
data class AppNotification(
    val id: String,
    @SerialName("runId") val runId: String? = null,
    @SerialName("triggerStopId") val triggerStopId: String? = null,
    @SerialName("stopsAway") val stopsAway: Int = 1,
    @SerialName("titleKo") val titleKo: String,
    @SerialName("bodyKo") val bodyKo: String,
    @SerialName("titleEn") val titleEn: String,
    @SerialName("bodyEn") val bodyEn: String,
    @SerialName("isRead") val isRead: Boolean = false,
    @SerialName("createdAt") val createdAt: String,
    @SerialName("routeCode") val routeCode: String? = null,
    @SerialName("userRouteStopId") val userRouteStopId: String? = null,
) {
    fun title(language: AppLanguage) = if (language == AppLanguage.en) titleEn else titleKo
    fun body(language: AppLanguage) = if (language == AppLanguage.en) bodyEn else bodyKo
}

@Serializable
data class UnreadCountResponse(@SerialName("unreadCount") val unreadCount: Int)

@Serializable
data class EmptySuccessResponse(val success: Boolean = true)

@Serializable
data class PushTokenRegistrationResponse(
    val success: Boolean,
    val id: String,
    val platform: String,
    val token: String,
    @SerialName("package_name") val packageName: String? = null,
)

@Serializable
data class AdminRun(
    val id: String,
    @SerialName("routeCode") val routeCode: String? = null,
    val status: String,
    @SerialName("startedAt") val startedAt: String? = null,
    @SerialName("endedAt") val endedAt: String? = null,
)

@Serializable
data class AdminRegistrationRow(
    val id: String,
    @SerialName("displayName") val displayName: String? = null,
    @SerialName("routeCode") val routeCode: String? = null,
    @SerialName("stopName") val stopName: String? = null,
    val status: String = "active",
)

@Serializable
data class AdminPrivilegedUser(
    @SerialName("userId") val userId: String,
    @SerialName("displayName") val displayName: String? = null,
    val provider: String = "",
    @SerialName("providerUid") val providerUid: String = "",
    val role: UserRole = UserRole.rider,
)
