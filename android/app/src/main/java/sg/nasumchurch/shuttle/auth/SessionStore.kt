package sg.nasumchurch.shuttle.auth

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first

private val Context.sessionDataStore by preferencesDataStore(name = "nasum_session")

class SessionStore(private val context: Context) {
    private val sessionTokenKey = stringPreferencesKey("session_token")
    private val themeKey = stringPreferencesKey("theme")

    suspend fun loadSessionToken(): String? =
        context.sessionDataStore.data.first()[sessionTokenKey]

    suspend fun saveSessionToken(token: String) {
        context.sessionDataStore.edit { it[sessionTokenKey] = token }
    }

    suspend fun clearSessionToken() {
        context.sessionDataStore.edit { it.remove(sessionTokenKey) }
    }

    suspend fun loadTheme(): String? = context.sessionDataStore.data.first()[themeKey]

    suspend fun saveTheme(value: String) {
        context.sessionDataStore.edit { it[themeKey] = value }
    }
}
