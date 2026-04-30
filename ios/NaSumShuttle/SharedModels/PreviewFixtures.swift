import Foundation

enum PreviewFixtures {
    static let me = MeResponse(
        userId: "preview-user",
        providerUid: "line-preview",
        displayName: "Preview Rider",
        pictureUrl: nil,
        email: "preview@example.com",
        role: .rider,
        preferredLanguage: .ko,
        pushNotificationsEnabled: true,
        createdAt: ISO8601DateFormatter().string(from: .now)
    )

    static let routeDetail = RouteDetail(
        id: "route-1",
        routeCode: "SUN-01",
        name: "Sunday Morning",
        displayName: "주일 1호차",
        line: "Sunday",
        service: "AM",
        revision: "1",
        googleMapsUrl: nil,
        active: true,
        stops: [
            RouteStop(
                id: "stop-1",
                routeId: "route-1",
                placeId: "place-1",
                sequence: 1,
                pickupTime: "08:20",
                notes: nil,
                isPickupEnabled: true,
                place: Place(
                    id: "place-1",
                    googlePlaceId: "google-1",
                    name: "Gangnam Station",
                    displayName: "강남역",
                    address: "Gangnam",
                    formattedAddress: "Gangnam Station",
                    primaryType: nil,
                    primaryTypeDisplayName: "Station",
                    lat: 37.4979,
                    lng: 127.0276,
                    placeTypes: [],
                    notes: nil,
                    isTerminal: false,
                    stopId: "A1"
                )
            ),
            RouteStop(
                id: "stop-2",
                routeId: "route-1",
                placeId: "place-2",
                sequence: 2,
                pickupTime: "08:40",
                notes: nil,
                isPickupEnabled: true,
                place: Place(
                    id: "place-2",
                    googlePlaceId: "google-2",
                    name: "Church",
                    displayName: "교회",
                    address: "Church",
                    formattedAddress: "NaSum Church",
                    primaryType: nil,
                    primaryTypeDisplayName: "Church",
                    lat: 37.5200,
                    lng: 127.0400,
                    placeTypes: [],
                    notes: nil,
                    isTerminal: false,
                    stopId: "B1"
                )
            )
        ],
        cachedPath: [
            RoutePathPoint(lat: 37.4979, lng: 127.0276),
            RoutePathPoint(lat: 37.5200, lng: 127.0400)
        ],
        pathCacheStatus: "ready",
        pathCacheUpdatedAt: nil,
        pathCacheExpiresAt: nil,
        pathCacheError: nil
    )

    static let registration = RegistrationEnvelope(
        registered: true,
        registration: RegistrationRecord(
            id: "registration-1",
            userId: "preview-user",
            routeId: "route-1",
            routeStopId: "stop-1",
            status: "active",
            route: routeDetail,
            routeStop: routeDetail.stops[0]
        ),
        stopActive: true
    )

    static let routeSummaries: [RouteSummary] = [
        RouteSummary(
            id: "route-1",
            routeCode: "SUN-01",
            name: "Sunday Morning",
            displayName: "주일 1호차",
            line: "Sunday",
            service: "AM",
            revision: "1",
            googleMapsUrl: nil,
            active: true,
            visibleStopCount: 8
        )
    ]

    static let notifications: [AppNotification] = [
        AppNotification(
            id: "notification-1",
            runId: "run-1",
            triggerStopId: "stop-1",
            stopsAway: 1,
            titleKo: "도착 알림",
            bodyKo: "셔틀이 곧 도착합니다.",
            titleEn: "Arrival alert",
            bodyEn: "The shuttle is almost there.",
            isRead: false,
            createdAt: ISO8601DateFormatter().string(from: .now),
            routeCode: "SUN-01",
            userRouteStopId: "stop-1"
        )
    ]
}
