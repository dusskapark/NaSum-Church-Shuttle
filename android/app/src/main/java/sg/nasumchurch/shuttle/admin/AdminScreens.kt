package sg.nasumchurch.shuttle.admin

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DirectionsBus
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Route
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import sg.nasumchurch.shuttle.app.AppUiState
import sg.nasumchurch.shuttle.preview.PreviewFixtures
import sg.nasumchurch.shuttle.sharedmodel.UserRole
import sg.nasumchurch.shuttle.ui.theme.NaSumShuttleTheme

@Composable
fun AdminDashboard(state: AppUiState) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Admin", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        AdminSection(
            title = "Run Management",
            icon = { Icon(Icons.Default.DirectionsBus, null) },
        ) {
            if (state.adminRuns.isEmpty()) {
                Text("No active runs.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            state.adminRuns.forEach { run ->
                Text("${run.routeCode ?: "Route"} · ${run.status} · ${run.startedAt ?: ""}")
            }
        }
        if (state.currentUser?.role == UserRole.admin) {
            AdminSection(
                title = "Registrations",
                icon = { Icon(Icons.Default.Route, null) },
            ) {
                if (state.adminRegistrations.isEmpty()) Text("No registrations loaded.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                state.adminRegistrations.forEach { row ->
                    Text("${row.displayName ?: row.id} · ${row.routeCode ?: ""} · ${row.stopName ?: ""}")
                }
            }
            AdminSection(
                title = "User Roles",
                icon = { Icon(Icons.Default.Groups, null) },
            ) {
                if (state.adminUsers.isEmpty()) Text("No privileged users loaded.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                state.adminUsers.forEach { user ->
                    Text("${user.displayName ?: user.userId} · ${user.provider} · ${user.role}")
                }
            }
        }
    }
}

@Composable
private fun AdminSection(
    title: String,
    icon: @Composable () -> Unit,
    content: @Composable ColumnScope.() -> Unit,
) {
    ElevatedCard {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                icon()
                Text(title, fontWeight = FontWeight.SemiBold)
            }
            content()
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun AdminPreview() {
    NaSumShuttleTheme {
        AdminDashboard(
            AppUiState(
                currentUser = PreviewFixtures.me,
                adminRuns = PreviewFixtures.adminRuns,
                adminRegistrations = PreviewFixtures.adminRegistrations,
                adminUsers = PreviewFixtures.adminUsers,
            ),
        )
    }
}
