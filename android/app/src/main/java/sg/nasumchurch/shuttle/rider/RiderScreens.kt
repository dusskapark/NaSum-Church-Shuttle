package sg.nasumchurch.shuttle.rider

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.DirectionsBus
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import sg.nasumchurch.shuttle.app.AppUiState
import sg.nasumchurch.shuttle.app.routeCodeFromText
import sg.nasumchurch.shuttle.preview.PreviewFixtures
import sg.nasumchurch.shuttle.sharedmodel.AppNotification
import sg.nasumchurch.shuttle.sharedmodel.PlaceSummary
import sg.nasumchurch.shuttle.ui.theme.NaSumShuttleTheme

@Composable
fun HomeScreen(state: AppUiState, onSelectRoute: (String) -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Text("Shuttle Routes", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
            Text("Browse routes, stops, and your current boarding point.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        state.registration?.registration?.let { registration ->
            item {
                ElevatedCard {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("Your registered route", style = MaterialTheme.typography.titleMedium)
                        Text(registration.route.label, fontWeight = FontWeight.SemiBold)
                        Text(registration.routeStop.place.displayName ?: registration.routeStop.place.name)
                        Text(registration.routeStop.pickupTime ?: "Pickup time not set", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
        items(state.routeSummaries) { route ->
            ListItem(
                headlineContent = { Text(route.label) },
                supportingContent = { Text("${route.visibleStopCount} stops · ${route.routeCode}") },
                leadingContent = { Icon(Icons.Default.DirectionsBus, null) },
                trailingContent = {
                    if (state.selectedRouteCode == route.routeCode) AssistChip(onClick = {}, label = { Text("Selected") })
                },
                modifier = Modifier.clickable { onSelectRoute(route.routeCode) },
            )
            HorizontalDivider()
        }
        state.selectedRoute?.let { route ->
            item {
                Text("Stops", style = MaterialTheme.typography.titleLarge)
            }
            items(route.stops) { stop ->
                ListItem(
                    headlineContent = { Text(stop.place.displayName ?: stop.place.name) },
                    supportingContent = { Text(listOfNotNull(stop.pickupTime, stop.place.stopId?.let { "Bus Stop $it" }).joinToString(" · ")) },
                    leadingContent = { Text(stop.sequence.toString(), fontWeight = FontWeight.Bold) },
                )
            }
        }
    }
}

@Composable
fun StopsScreen(
    state: AppUiState,
    onLoadPlaceRoutes: (PlaceSummary) -> Unit,
    onRegisterStop: (String, String) -> Unit,
) {
    var query by remember { mutableStateOf("") }
    var selectedPlace by remember { mutableStateOf<PlaceSummary?>(null) }
    val places = state.places.filter { it.name.contains(query, ignoreCase = true) || query.isBlank() }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Text("Search Stops", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                label = { Text("Search stops") },
                modifier = Modifier.fillMaxWidth(),
            )
        }
        items(places) { place ->
            ListItem(
                headlineContent = { Text(place.name) },
                supportingContent = { Text("${place.lat}, ${place.lng}") },
                modifier = Modifier.clickable {
                    selectedPlace = place
                    onLoadPlaceRoutes(place)
                },
            )
            HorizontalDivider()
        }
        selectedPlace?.let { place ->
            val candidates = state.routeCandidates[place.googlePlaceId]?.matchingStops.orEmpty()
            item {
                Text("Routes serving ${place.name}", style = MaterialTheme.typography.titleLarge)
            }
            items(candidates) { candidate ->
                ElevatedCard {
                    Row(
                        Modifier.fillMaxWidth().padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(candidate.routeLabel, fontWeight = FontWeight.SemiBold)
                            Text(candidate.pickupTime ?: "Pickup time not set", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Button(onClick = { onRegisterStop(candidate.routeCode, candidate.routeStopId) }) {
                            Text("Save")
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ScanScreen(state: AppUiState, onCheckIn: (String, String, Int) -> Unit) {
    var scannedText by remember { mutableStateOf(state.pendingScanNavigation?.routeCode ?: state.selectedRouteCode.orEmpty()) }
    var passengers by remember { mutableIntStateOf(0) }
    val routeCode = routeCodeFromText(scannedText) ?: state.selectedRouteCode
    val route = routeCode?.let { state.routeDetails[it] } ?: state.selectedRoute
    val selectedStop = state.registration?.registration?.routeStop ?: route?.stops?.firstOrNull()

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Text("QR Check-in", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
            Text("Paste a shuttle QR payload or open an Android App Link to check in.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        item {
            OutlinedTextField(
                value = scannedText,
                onValueChange = { scannedText = it },
                label = { Text("QR result or route code") },
                modifier = Modifier.fillMaxWidth(),
            )
        }
        item {
            ElevatedCard {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(route?.label ?: routeCode ?: "No route selected", fontWeight = FontWeight.SemiBold)
                    Text(selectedStop?.place?.displayName ?: selectedStop?.place?.name ?: "Choose a stop first")
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Additional passengers", modifier = Modifier.weight(1f))
                        AssistChip(onClick = { if (passengers > 0) passengers-- }, label = { Text("-") })
                        Text(passengers.toString(), Modifier.padding(horizontal = 12.dp))
                        AssistChip(onClick = { passengers++ }, label = { Text("+") })
                    }
                    Button(
                        onClick = {
                            if (routeCode != null && selectedStop != null) onCheckIn(routeCode, selectedStop.id, passengers)
                        },
                        enabled = routeCode != null && selectedStop != null,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Icon(Icons.Default.CheckCircle, null)
                        Spacer(Modifier.width(8.dp))
                        Text("Check In")
                    }
                }
            }
        }
    }
}

@Composable
fun NotificationsScreen(
    state: AppUiState,
    onRead: (AppNotification) -> Unit,
    onRefresh: () -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Notifications", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                TextButton(onClick = onRefresh) { Text("Refresh") }
            }
        }
        if (state.notifications.isEmpty()) {
            item { Text("No notifications yet.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
        items(state.notifications) { notification ->
            ElevatedCard(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.elevatedCardColors(
                    containerColor = if (notification.isRead) MaterialTheme.colorScheme.surface else MaterialTheme.colorScheme.primaryContainer,
                ),
            ) {
                ListItem(
                    headlineContent = { Text(notification.title(state.preferredLanguage)) },
                    supportingContent = { Text(notification.body(state.preferredLanguage)) },
                    leadingContent = { Icon(Icons.Default.Notifications, null) },
                    trailingContent = {
                        if (!notification.isRead) TextButton(onClick = { onRead(notification) }) { Text("Read") }
                    },
                )
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun HomePreview() {
    val state = AppUiState(
        isBootstrapping = false,
        sessionToken = "preview",
        currentUser = PreviewFixtures.me,
        routeSummaries = PreviewFixtures.routeSummaries,
        registration = PreviewFixtures.registration,
        places = PreviewFixtures.places,
        selectedRouteCode = PreviewFixtures.routeDetail.routeCode,
        routeDetails = mapOf(PreviewFixtures.routeDetail.routeCode to PreviewFixtures.routeDetail),
    )
    NaSumShuttleTheme {
        HomeScreen(state, {})
    }
}
