package sg.nasumchurch.shuttle.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import sg.nasumchurch.shuttle.ui.theme.NaSumShuttleTheme

class MainActivity : ComponentActivity() {
    private val appModel: AppModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        appModel.bootstrap(intent?.data)
        intent?.extras?.let { extras ->
            val payload = extras.keySet().associateWith { extras.getString(it).orEmpty() }
            appModel.handleNotificationPayload(payload)
        }

        setContent {
            val state by appModel.state.collectAsState()
            NaSumShuttleTheme(themePreference = state.themePreference) {
                LaunchedEffect(intent?.data) {
                    intent?.data?.let { appModel.handleIncomingUri(it) }
                }
                NaSumShuttleRoot(appModel = appModel, state = state)
            }
        }
    }
}
