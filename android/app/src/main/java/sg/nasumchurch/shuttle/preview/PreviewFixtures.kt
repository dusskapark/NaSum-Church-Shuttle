package sg.nasumchurch.shuttle.preview

import sg.nasumchurch.shuttle.sharedmodel.*

object PreviewFixtures {
    val me = MeResponse(
        userId = "preview-user",
        providerUid = "line-preview",
        displayName = "Preview Rider",
        email = "preview@example.com",
        role = UserRole.admin,
        preferredLanguage = AppLanguage.ko,
        pushNotificationsEnabled = true,
        createdAt = "2026-05-04T00:00:00.000Z",
    )

    val routeDetail = RouteDetail(
        id = "route-1",
        routeCode = "SUN-01",
        name = "Sunday Morning",
        displayName = "주일 1호차",
        line = "Sunday",
        service = "AM",
        revision = "1",
        stops = listOf(
            RouteStop(
                id = "stop-1",
                routeId = "route-1",
                placeId = "place-1",
                sequence = 1,
                pickupTime = "08:20",
                place = Place(
                    id = "place-1",
                    googlePlaceId = "google-1",
                    name = "Gangnam Station",
                    displayName = "강남역",
                    formattedAddress = "Gangnam Station",
                    primaryTypeDisplayName = "Station",
                    lat = 37.4979,
                    lng = 127.0276,
                    stopId = "A1",
                ),
            ),
            RouteStop(
                id = "stop-2",
                routeId = "route-1",
                placeId = "place-2",
                sequence = 2,
                pickupTime = "08:40",
                place = Place(
                    id = "place-2",
                    googlePlaceId = "google-2",
                    name = "Church",
                    displayName = "교회",
                    formattedAddress = "NaSum Church",
                    primaryTypeDisplayName = "Church",
                    lat = 37.5200,
                    lng = 127.0400,
                    stopId = "B1",
                ),
            ),
        ),
        cachedPath = listOf(RoutePathPoint(37.4979, 127.0276), RoutePathPoint(37.5200, 127.0400)),
        pathCacheStatus = "ready",
    )

    val routeSummaries = listOf(
        RouteSummary(
            id = "route-1",
            routeCode = "SUN-01",
            name = "Sunday Morning",
            displayName = "주일 1호차",
            line = "Sunday",
            service = "AM",
            revision = "1",
            visibleStopCount = 8,
        ),
    )

    val registration = RegistrationEnvelope(
        registered = true,
        registration = RegistrationRecord(
            id = "registration-1",
            userId = "preview-user",
            routeId = "route-1",
            routeStopId = "stop-1",
            status = "active",
            route = routeDetail,
            routeStop = routeDetail.stops.first(),
        ),
        stopActive = true,
    )

    val places = listOf(
        PlaceSummary("google-1", "강남역", 37.4979, 127.0276),
        PlaceSummary("google-2", "교회", 37.5200, 127.0400, true),
    )

    val notifications = listOf(
        AppNotification(
            id = "notification-1",
            runId = "run-1",
            triggerStopId = "stop-1",
            stopsAway = 1,
            titleKo = "도착 알림",
            bodyKo = "셔틀이 곧 도착합니다.",
            titleEn = "Arrival alert",
            bodyEn = "The shuttle is almost there.",
            isRead = false,
            createdAt = "2026-05-04T00:00:00.000Z",
            routeCode = "SUN-01",
            userRouteStopId = "stop-1",
        ),
    )

    val adminRuns = listOf(AdminRun("run-1", "SUN-01", "active", "08:00"))
    val adminRegistrations = listOf(AdminRegistrationRow("registration-1", "Preview Rider", "SUN-01", "강남역"))
    val adminUsers = listOf(AdminPrivilegedUser("preview-user", "Preview Rider", "line", "line-preview", UserRole.admin))
}
