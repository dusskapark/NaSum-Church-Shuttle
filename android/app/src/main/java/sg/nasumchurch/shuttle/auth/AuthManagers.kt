package sg.nasumchurch.shuttle.auth

import android.app.Activity
import sg.nasumchurch.shuttle.BuildConfig

data class AuthCredential(val token: String)

class LineAuthManager {
    suspend fun signIn(activity: Activity): AuthCredential {
        if (BuildConfig.LINE_LOGIN_CHANNEL_ID.isBlank()) {
            throw IllegalStateException("LINE_LOGIN_CHANNEL_ID is not configured.")
        }
        throw UnsupportedOperationException("LINE Android SDK wiring requires LINE channel configuration in Android Studio.")
    }
}

class GoogleAuthManager {
    suspend fun signIn(activity: Activity): AuthCredential {
        if (BuildConfig.GOOGLE_ANDROID_CLIENT_ID.isBlank()) {
            throw IllegalStateException("GOOGLE_ANDROID_CLIENT_ID is not configured.")
        }
        throw UnsupportedOperationException("Google ID token flow requires project-specific SHA-256 configuration.")
    }
}
