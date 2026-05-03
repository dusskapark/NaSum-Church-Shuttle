package sg.nasumchurch.shuttle.app

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import sg.nasumchurch.shuttle.admin.AdminDashboard
import sg.nasumchurch.shuttle.preview.PreviewFixtures
import sg.nasumchurch.shuttle.rider.*
import sg.nasumchurch.shuttle.sharedmodel.AppThemePreference
import sg.nasumchurch.shuttle.sharedmodel.UserRole
import sg.nasumchurch.shuttle.ui.theme.NaSumShuttleTheme

@Composable
fun NaSumShuttleRoot(appModel: AppModel, state: AppUiState) {
    var tab by remember { mutableIntStateOf(0) }

    LaunchedEffect(state.pendingScanNavigation) {
        if (state.pendingScanNavigation != null) {
            tab = 2
            appModel.consumeScanNavigation()
        }
    }

    if (state.isBootstrapping) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        return
    }

    if (!state.isAuthenticated) {
        LoginScreen(
            state = state,
            onEmailLogin = appModel::signInWithEmail,
            onProvider = appModel::unsupportedProvider,
            onDismissError = appModel::clearError,
        )
        return
    }

    Scaffold(
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = tab == 0,
                    onClick = { tab = 0 },
                    icon = { Icon(Icons.Default.Home, null) },
                    label = { Text("Home") },
                )
                NavigationBarItem(
                    selected = tab == 1,
                    onClick = { tab = 1 },
                    icon = { Icon(Icons.Default.Search, null) },
                    label = { Text("Stops") },
                )
                NavigationBarItem(
                    selected = tab == 2,
                    onClick = { tab = 2 },
                    icon = { Icon(Icons.Default.QrCodeScanner, null) },
                    label = { Text("Scan") },
                )
                NavigationBarItem(
                    selected = tab == 3,
                    onClick = { tab = 3 },
                    icon = {
                        BadgedBox(
                            badge = {
                                if (state.unreadCount > 0) Badge { Text(state.unreadCount.toString()) }
                            },
                        ) { Icon(Icons.Default.Notifications, null) }
                    },
                    label = { Text("Alerts") },
                )
                NavigationBarItem(
                    selected = tab == 4,
                    onClick = { tab = 4 },
                    icon = { Icon(Icons.Default.Settings, null) },
                    label = { Text("Settings") },
                )
            }
        },
    ) { padding ->
        Box(Modifier.padding(padding)) {
            when (tab) {
                0 -> HomeScreen(state, appModel::selectRoute)
                1 -> StopsScreen(state, appModel::loadPlaceRoutes, appModel::registerStop)
                2 -> ScanScreen(state, appModel::checkIn)
                3 -> NotificationsScreen(state, appModel::markNotificationRead, appModel::reloadNotifications)
                4 -> SettingsScreen(state, appModel::updatePreferences, appModel::refreshAllAsync, appModel::loadAdmin, appModel::logout)
            }
        }
    }

    state.errorMessage?.let { message ->
        AlertDialog(
            onDismissRequest = appModel::clearError,
            confirmButton = {
                TextButton(onClick = appModel::clearError) { Text("OK") }
            },
            title = { Text("NaSum Shuttle") },
            text = { Text(message) },
        )
    }
}

@Composable
private fun LoginScreen(
    state: AppUiState,
    onEmailLogin: (String, String) -> Unit,
    onProvider: (String) -> Unit,
    onDismissError: () -> Unit,
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    Scaffold { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            item {
                Spacer(Modifier.height(24.dp))
                Text("NaSum Shuttle", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
                Text("Sign in to manage your shuttle stop and check in.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            item {
                Button(
                    onClick = { onProvider("LINE") },
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Continue with LINE") }
            }
            item {
                OutlinedButton(
                    onClick = { onProvider("Google") },
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Continue with Google") }
            }
            item {
                HorizontalDivider()
            }
            item {
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                )
            }
            item {
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Password") },
                    modifier = Modifier.fillMaxWidth(),
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true,
                )
            }
            item {
                Button(
                    onClick = { onEmailLogin(email, password) },
                    enabled = !state.isAuthenticating && email.isNotBlank() && password.isNotBlank(),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    if (state.isAuthenticating) {
                        CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                    } else {
                        Text("Sign in")
                    }
                }
            }
        }
    }

    state.errorMessage?.let { message ->
        AlertDialog(
            onDismissRequest = onDismissError,
            confirmButton = { TextButton(onClick = onDismissError) { Text("OK") } },
            title = { Text("Sign-in") },
            text = { Text(message) },
        )
    }
}

@Composable
fun SettingsScreen(
    state: AppUiState,
    onUpdatePreferences: (Boolean?, sg.nasumchurch.shuttle.sharedmodel.AppLanguage?, AppThemePreference?) -> Unit,
    onRefresh: () -> Unit,
    onLoadAdmin: () -> Unit,
    onLogout: () -> Unit,
) {
    var showAdmin by remember { mutableStateOf(false) }
    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { Text("Settings", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold) }
        item {
            ElevatedCard {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(state.currentUser?.displayName ?: state.currentUser?.email ?: "Rider", fontWeight = FontWeight.SemiBold)
                    Text("Role: ${state.currentUser?.role ?: UserRole.rider}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("Current route: ${state.registration?.registration?.route?.label ?: "Not selected"}")
                    Text("Current stop: ${state.registration?.registration?.routeStop?.place?.displayName ?: "Not selected"}")
                }
            }
        }
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Push notifications", modifier = Modifier.weight(1f))
                Switch(
                    checked = state.currentUser?.pushNotificationsEnabled == true,
                    onCheckedChange = { onUpdatePreferences(it, null, null) },
                )
            }
        }
        item {
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                AppThemePreference.entries.forEachIndexed { index, preference ->
                    SegmentedButton(
                        selected = state.themePreference == preference,
                        onClick = { onUpdatePreferences(null, null, preference) },
                        shape = SegmentedButtonDefaults.itemShape(index, AppThemePreference.entries.size),
                    ) { Text(preference.name.replaceFirstChar { it.titlecase() }) }
                }
            }
        }
        item {
            OutlinedButton(onClick = onRefresh, modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Default.Refresh, null)
                Spacer(Modifier.width(8.dp))
                Text("Refresh")
            }
        }
        if (state.isAdminSurfaceEnabled) {
            item {
                Button(
                    onClick = {
                        showAdmin = !showAdmin
                        onLoadAdmin()
                    },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Icon(Icons.Default.AdminPanelSettings, null)
                    Spacer(Modifier.width(8.dp))
                    Text(if (showAdmin) "Hide Admin" else "Open Admin")
                }
            }
            if (showAdmin) {
                item { AdminDashboard(state) }
            }
        }
        item {
            TextButton(onClick = onLogout, modifier = Modifier.fillMaxWidth()) {
                Text("Log out")
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun LoginPreview() {
    NaSumShuttleTheme {
        LoginScreen(AppUiState(isBootstrapping = false), { _, _ -> }, {}, {})
    }
}

@Preview(showBackground = true)
@Composable
private fun RootPreview() {
    val state = AppUiState(
        isBootstrapping = false,
        sessionToken = "preview",
        currentUser = PreviewFixtures.me,
        routeSummaries = PreviewFixtures.routeSummaries,
        registration = PreviewFixtures.registration,
        places = PreviewFixtures.places,
        notifications = PreviewFixtures.notifications,
        unreadCount = 1,
        selectedRouteCode = PreviewFixtures.routeDetail.routeCode,
        routeDetails = mapOf(PreviewFixtures.routeDetail.routeCode to PreviewFixtures.routeDetail),
    )
    NaSumShuttleTheme {
        HomeScreen(state = state, onSelectRoute = {})
    }
}
