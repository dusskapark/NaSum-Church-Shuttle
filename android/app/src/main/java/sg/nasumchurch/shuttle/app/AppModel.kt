package sg.nasumchurch.shuttle.app

import android.app.Application
import android.net.Uri
import java.net.URLDecoder
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import sg.nasumchurch.shuttle.auth.SessionStore
import sg.nasumchurch.shuttle.network.APIClient
import sg.nasumchurch.shuttle.preview.PreviewFixtures
import sg.nasumchurch.shuttle.sharedmodel.*

data class NotificationNavigationTarget(
    val notificationId: String?,
    val routeCode: String,
    val routeStopId: String?,
)

data class ScanNavigationTarget(val routeCode: String)

data class AppUiState(
    val isBootstrapping: Boolean = true,
    val isLoading: Boolean = false,
    val isAuthenticating: Boolean = false,
    val errorMessage: String? = null,
    val sessionToken: String? = null,
    val currentUser: MeResponse? = null,
    val routeSummaries: List<RouteSummary> = emptyList(),
    val registration: RegistrationEnvelope? = null,
    val places: List<PlaceSummary> = emptyList(),
    val notifications: List<AppNotification> = emptyList(),
    val unreadCount: Int = 0,
    val selectedRouteCode: String? = null,
    val routeDetails: Map<String, RouteDetail> = emptyMap(),
    val routeCandidates: Map<String, PlaceRoutesResponse> = emptyMap(),
    val runInfoByRouteCode: Map<String, CheckInRunInfoResponse> = emptyMap(),
    val pendingNotificationNavigation: NotificationNavigationTarget? = null,
    val pendingScanNavigation: ScanNavigationTarget? = null,
    val adminRuns: List<AdminRun> = emptyList(),
    val adminRegistrations: List<AdminRegistrationRow> = emptyList(),
    val adminUsers: List<AdminPrivilegedUser> = emptyList(),
    val themePreference: AppThemePreference = AppThemePreference.system,
) {
    val isAuthenticated: Boolean get() = sessionToken != null && currentUser != null
    val preferredLanguage: AppLanguage get() = currentUser?.preferredLanguage ?: AppLanguage.ko
    val isAdminSurfaceEnabled: Boolean get() = currentUser?.role == UserRole.admin || currentUser?.role == UserRole.driver
    val selectedRoute: RouteDetail? get() = selectedRouteCode?.let { routeDetails[it] }
}

class AppModel(application: Application) : AndroidViewModel(application) {
    private val sessionStore = SessionStore(application)
    private val apiClient = APIClient(sessionTokenProvider = { state.value.sessionToken })
    private val _state = MutableStateFlow(AppUiState())
    val state: StateFlow<AppUiState> = _state

    fun bootstrap(initialUri: Uri? = null) {
        viewModelScope.launch {
            val token = sessionStore.loadSessionToken()
            val theme = sessionStore.loadTheme()?.let { runCatching { AppThemePreference.valueOf(it) }.getOrNull() }
                ?: AppThemePreference.system
            _state.update { it.copy(sessionToken = token, themePreference = theme) }
            initialUri?.let { handleIncomingUri(it) }
            if (token == null) {
                _state.update { it.copy(isBootstrapping = false) }
                return@launch
            }
            runCatching { refreshAll() }
                .onFailure { logout(error = it.message ?: "Session expired.") }
            _state.update { it.copy(isBootstrapping = false) }
        }
    }

    fun usePreviewState() {
        _state.value = AppUiState(
            isBootstrapping = false,
            sessionToken = "preview",
            currentUser = PreviewFixtures.me,
            routeSummaries = PreviewFixtures.routeSummaries,
            registration = PreviewFixtures.registration,
            places = PreviewFixtures.places,
            notifications = PreviewFixtures.notifications,
            unreadCount = PreviewFixtures.notifications.count { !it.isRead },
            selectedRouteCode = PreviewFixtures.routeDetail.routeCode,
            routeDetails = mapOf(PreviewFixtures.routeDetail.routeCode to PreviewFixtures.routeDetail),
            adminRuns = PreviewFixtures.adminRuns,
            adminRegistrations = PreviewFixtures.adminRegistrations,
            adminUsers = PreviewFixtures.adminUsers,
        )
    }

    fun signInWithEmail(email: String, password: String) {
        viewModelScope.launch {
            _state.update { it.copy(isAuthenticating = true, errorMessage = null) }
            runCatching {
                val session = apiClient.exchangeEmailPasswordSession(email, password)
                applySession(session.token)
            }.onFailure { caught ->
                _state.update { it.copy(errorMessage = caught.message ?: "Sign-in failed.") }
            }
            _state.update { it.copy(isAuthenticating = false) }
        }
    }

    fun unsupportedProvider(provider: String) {
        _state.update {
            it.copy(errorMessage = "$provider login is scaffolded. Add provider SDK credentials in Android Studio to enable it.")
        }
    }

    fun refreshAllAsync() {
        viewModelScope.launch {
            refreshAll()
        }
    }

    private suspend fun refreshAll() {
        _state.update { it.copy(isLoading = true, errorMessage = null) }
        val me = apiClient.fetchMe()
        val routes = apiClient.fetchRouteSummaries()
        val registration = apiClient.fetchRegistration()
        val places = apiClient.fetchPlaces()
        val notifications = apiClient.fetchNotifications()
        val unread = apiClient.fetchUnreadCount()
        val preferredRouteCode = registration.registration?.route?.routeCode ?: routes.firstOrNull()?.routeCode
        val details = mutableMapOf<String, RouteDetail>()
        preferredRouteCode?.let { details[it] = apiClient.fetchRouteDetail(it) }
        _state.update {
            it.copy(
                isLoading = false,
                currentUser = me,
                routeSummaries = routes,
                registration = registration,
                places = places,
                notifications = notifications,
                unreadCount = unread.unreadCount,
                selectedRouteCode = preferredRouteCode,
                routeDetails = it.routeDetails + details,
            )
        }
    }

    fun selectRoute(routeCode: String) {
        viewModelScope.launch {
            runCatching {
                val detail = state.value.routeDetails[routeCode] ?: apiClient.fetchRouteDetail(routeCode)
                val runInfo = runCatching { apiClient.fetchRunInfo(routeCode) }.getOrNull()
                _state.update {
                    it.copy(
                        selectedRouteCode = routeCode,
                        routeDetails = it.routeDetails + (routeCode to detail),
                        runInfoByRouteCode = if (runInfo == null) it.runInfoByRouteCode else it.runInfoByRouteCode + (routeCode to runInfo),
                    )
                }
            }.onFailure { setError(it) }
        }
    }

    fun loadPlaceRoutes(place: PlaceSummary) {
        viewModelScope.launch {
            if (state.value.routeCandidates.containsKey(place.googlePlaceId)) return@launch
            runCatching { apiClient.fetchPlaceRoutes(place.googlePlaceId) }
                .onSuccess { response ->
                    _state.update { it.copy(routeCandidates = it.routeCandidates + (place.googlePlaceId to response)) }
                }
                .onFailure { setError(it) }
        }
    }

    fun registerStop(routeCode: String, routeStopId: String) {
        viewModelScope.launch {
            runCatching {
                apiClient.updateRegistration(routeCode, routeStopId)
                val registration = apiClient.fetchRegistration()
                _state.update {
                    it.copy(
                        registration = registration,
                        selectedRouteCode = registration.registration?.route?.routeCode ?: routeCode,
                    )
                }
            }.onFailure { setError(it) }
        }
    }

    fun checkIn(routeCode: String, routeStopId: String, additionalPassengers: Int) {
        viewModelScope.launch {
            runCatching {
                val runInfo = state.value.runInfoByRouteCode[routeCode] ?: apiClient.fetchRunInfo(routeCode)
                val run = runInfo.run ?: throw IllegalStateException("No active run found for this route.")
                apiClient.checkIn(run.id, routeStopId, additionalPassengers)
                val updatedRunInfo = apiClient.fetchRunInfo(routeCode)
                _state.update { it.copy(runInfoByRouteCode = it.runInfoByRouteCode + (routeCode to updatedRunInfo)) }
                reloadNotifications()
            }.onFailure { setError(it) }
        }
    }

    fun reloadNotifications() {
        viewModelScope.launch {
            runCatching {
                val notifications = apiClient.fetchNotifications()
                val unread = apiClient.fetchUnreadCount()
                _state.update { it.copy(notifications = notifications, unreadCount = unread.unreadCount) }
            }.onFailure { setError(it) }
        }
    }

    fun markNotificationRead(notification: AppNotification) {
        viewModelScope.launch {
            runCatching {
                apiClient.markNotificationRead(notification.id)
                reloadNotifications()
            }.onFailure { setError(it) }
        }
    }

    fun updatePreferences(pushNotificationsEnabled: Boolean? = null, preferredLanguage: AppLanguage? = null, theme: AppThemePreference? = null) {
        viewModelScope.launch {
            runCatching {
                if (theme != null) {
                    sessionStore.saveTheme(theme.name)
                    _state.update { it.copy(themePreference = theme) }
                }
                if (pushNotificationsEnabled != null || preferredLanguage != null) {
                    apiClient.updatePreferences(pushNotificationsEnabled, preferredLanguage)
                    _state.update { it.copy(currentUser = apiClient.fetchMe()) }
                }
            }.onFailure { setError(it) }
        }
    }

    fun registerPushToken(token: String) {
        viewModelScope.launch {
            if (state.value.currentUser?.pushNotificationsEnabled != true) return@launch
            runCatching { apiClient.registerAndroidPushToken(token) }.onFailure { setError(it) }
        }
    }

    fun loadAdmin() {
        viewModelScope.launch {
            runCatching {
                val runs = apiClient.fetchAdminRuns("active")
                val registrations = if (state.value.currentUser?.role == UserRole.admin) apiClient.fetchAdminRegistrations() else emptyList()
                val users = if (state.value.currentUser?.role == UserRole.admin) apiClient.fetchAdminUsers() else emptyList()
                _state.update { it.copy(adminRuns = runs, adminRegistrations = registrations, adminUsers = users) }
            }.onFailure { setError(it) }
        }
    }

    fun handleIncomingUri(uri: Uri): Boolean {
        val routeCode = routeCodeFromUri(uri) ?: return false
        _state.update {
            it.copy(
                pendingScanNavigation = ScanNavigationTarget(routeCode),
                selectedRouteCode = routeCode,
            )
        }
        return true
    }

    fun consumeScanNavigation() {
        _state.update { it.copy(pendingScanNavigation = null) }
    }

    fun handleNotificationPayload(data: Map<String, String>) {
        val routeCode = data["routeCode"] ?: return
        _state.update {
            it.copy(
                pendingNotificationNavigation = NotificationNavigationTarget(
                    notificationId = data["notificationId"],
                    routeCode = routeCode,
                    routeStopId = data["userRouteStopId"],
                ),
                selectedRouteCode = routeCode,
            )
        }
        data["notificationId"]?.let { id ->
            state.value.notifications.firstOrNull { it.id == id }?.let { markNotificationRead(it) }
        }
        selectRoute(routeCode)
    }

    fun clearError() {
        _state.update { it.copy(errorMessage = null) }
    }

    fun logout(error: String? = null) {
        viewModelScope.launch {
            sessionStore.clearSessionToken()
            _state.update { AppUiState(isBootstrapping = false, errorMessage = error) }
        }
    }

    private suspend fun applySession(token: String) {
        require(token.isNotBlank()) { "The server did not return a session token." }
        sessionStore.saveSessionToken(token)
        _state.update { it.copy(sessionToken = token) }
        refreshAll()
    }

    private fun setError(error: Throwable) {
        _state.update { it.copy(isLoading = false, errorMessage = error.message ?: "Something went wrong.") }
    }
}

fun routeCodeFromText(scannedText: String): String? {
    val trimmed = scannedText.trim()
    if (trimmed.isBlank()) return null
    return routeCodeFromQuery(trimmed) ?: trimmed
}

fun routeCodeFromUri(uri: Uri): String? {
    uri.getQueryParameter("routeCode")?.let { return it }
    uri.getQueryParameter("liff.state")?.let { nested ->
        routeCodeFromText(nested)?.let { return it }
    }
    uri.getQueryParameter("sessionParams")?.let { params ->
        Regex("\"routeCode\"\\s*:\\s*\"([^\"]+)\"").find(params)?.groupValues?.getOrNull(1)?.let { return it }
    }
    return null
}

private fun routeCodeFromQuery(value: String): String? {
    val query = value.substringAfter('?', missingDelimiterValue = value)
    fun parameter(name: String): String? = query
        .split('&')
        .firstOrNull { it.substringBefore('=') == name }
        ?.substringAfter('=', "")
        ?.let { URLDecoder.decode(it, Charsets.UTF_8.name()) }
        ?.takeIf { it.isNotBlank() }

    parameter("routeCode")?.let { return it }
    parameter("liff.state")?.let { nested -> routeCodeFromText(nested)?.let { return it } }
    parameter("sessionParams")?.let { params ->
        Regex("\"routeCode\"\\s*:\\s*\"([^\"]+)\"").find(params)?.groupValues?.getOrNull(1)?.let { return it }
    }
    return null
}
