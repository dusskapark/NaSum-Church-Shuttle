package sg.nasumchurch.shuttle

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import sg.nasumchurch.shuttle.app.routeCodeFromText

class RouteCodeParserTest {
    @Test
    fun parsesDirectRouteCode() {
        assertEquals("SUN-01", routeCodeFromText("SUN-01"))
    }

    @Test
    fun parsesUniversalScanUrl() {
        assertEquals(
            "SUN-01",
            routeCodeFromText("https://nasum-church-shuttle.vercel.app/scan?routeCode=SUN-01"),
        )
    }

    @Test
    fun parsesNestedLiffState() {
        assertEquals(
            "SUN-01",
            routeCodeFromText("https://example.com/?liff.state=%2Fscan%3FrouteCode%3DSUN-01"),
        )
    }

    @Test
    fun returnsNullForEmptyText() {
        assertNull(routeCodeFromText("   "))
    }
}
