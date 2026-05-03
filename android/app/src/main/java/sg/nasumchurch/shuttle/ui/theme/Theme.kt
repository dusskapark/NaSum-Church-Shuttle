package sg.nasumchurch.shuttle.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import sg.nasumchurch.shuttle.sharedmodel.AppThemePreference

val ShuttleGreen = Color(0xFF00B140)
val ShuttleInk = Color(0xFF20242C)
val ShuttleMuted = Color(0xFF667085)
val ShuttleSurface = Color(0xFFF7F8FA)

private val LightColors: ColorScheme = lightColorScheme(
    primary = ShuttleGreen,
    onPrimary = Color.White,
    secondary = Color(0xFF2364AA),
    background = Color.White,
    surface = Color.White,
    onBackground = ShuttleInk,
    onSurface = ShuttleInk,
)

private val DarkColors: ColorScheme = darkColorScheme(
    primary = ShuttleGreen,
    onPrimary = Color.White,
    secondary = Color(0xFF7DB3FF),
    background = Color(0xFF111318),
    surface = Color(0xFF1B1E25),
    onBackground = Color(0xFFE9ECF2),
    onSurface = Color(0xFFE9ECF2),
)

@Composable
fun NaSumShuttleTheme(
    themePreference: AppThemePreference = AppThemePreference.system,
    content: @Composable () -> Unit,
) {
    val darkTheme = when (themePreference) {
        AppThemePreference.system -> isSystemInDarkTheme()
        AppThemePreference.light -> false
        AppThemePreference.dark -> true
    }

    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        content = content,
    )
}
