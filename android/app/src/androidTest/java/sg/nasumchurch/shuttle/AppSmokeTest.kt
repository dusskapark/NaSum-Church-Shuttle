package sg.nasumchurch.shuttle

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import org.junit.Rule
import org.junit.Test
import sg.nasumchurch.shuttle.app.MainActivity

class AppSmokeTest {
    @get:Rule
    val composeRule = createAndroidComposeRule<MainActivity>()

    @Test
    fun loginScreenRenders() {
        composeRule.onNodeWithText("NaSum Shuttle").assertIsDisplayed()
    }
}
