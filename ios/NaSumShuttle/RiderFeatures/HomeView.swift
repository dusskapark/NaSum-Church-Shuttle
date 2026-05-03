import CoreLocation
import Observation
import SwiftUI

private enum HomePanelLevel: CaseIterable {
    case compact
    case medium
    case expanded

    var backgroundOpacity: Double {
        switch self {
        case .compact: 0.03
        case .medium: 0.12
        case .expanded: 0.34
        }
    }

    var expandedStep: HomePanelLevel {
        switch self {
        case .compact: .medium
        case .medium, .expanded: .expanded
        }
    }

    var compactedStep: HomePanelLevel {
        switch self {
        case .expanded: .medium
        case .medium, .compact: .compact
        }
    }
}

private enum StopSortMode: String, CaseIterable {
    case alphabetical
    case distance
}

private struct StopInfoData {
    let stopId: String?
    let address: String?
    let isBusStop: Bool
    let isTerminal: Bool

    var hasContent: Bool {
        (isBusStop && trimmedStopId != nil) || isTerminal || trimmedAddress != nil
    }

    var trimmedStopId: String? {
        trimmed(stopId)
    }

    var trimmedAddress: String? {
        trimmed(address)
    }

    private func trimmed(_ value: String?) -> String? {
        let normalized = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return normalized.isEmpty ? nil : normalized
    }
}

private func routeShortTitle(line: String, service: String) -> String {
    let title = [line, service]
        .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty }
        .joined(separator: " · ")
    return title.isEmpty ? "Route" : title
}

private func routeCandidateShortTitle(_ candidate: StopCandidate) -> String {
    let label = candidate.routeLabel.trimmingCharacters(in: .whitespacesAndNewlines)
    let source = label.isEmpty ? candidate.routeCode : label
    let parts = source
        .components(separatedBy: " · ")
        .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty && !($0.hasPrefix("R") && $0.dropFirst().allSatisfy(\.isNumber)) }
    return parts.isEmpty ? source : parts.joined(separator: " · ")
}

private func stopInfoData(for place: Place) -> StopInfoData {
    StopInfoData(
        stopId: place.stopId,
        address: place.formattedAddress ?? place.address,
        isBusStop: isBusStop(primaryType: place.primaryType, placeTypes: place.placeTypes, stopId: place.stopId),
        isTerminal: place.isTerminal
    )
}

private func stopInfoData(for candidate: StopCandidate?) -> StopInfoData {
    StopInfoData(
        stopId: candidate?.stopId,
        address: candidate?.formattedAddress ?? candidate?.address,
        isBusStop: isBusStop(
            primaryType: candidate?.primaryType,
            placeTypes: candidate?.placeTypes ?? [],
            stopId: candidate?.stopId
        ),
        isTerminal: candidate?.isTerminal ?? false
    )
}

private func isBusStop(primaryType: String?, placeTypes: [String], stopId: String?) -> Bool {
    stopId?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
        || primaryType == "bus_stop"
        || placeTypes.contains("bus_stop")
}

struct ShuttleHome: View {
    @Bindable var appModel: AppModel
    @State private var panelLevel: HomePanelLevel = .medium
    @State private var showingRoutes = true
    @State private var selectedHomeStopId: String?
    @State private var stopSearchQuery = ""
    @State private var isStopSearchActive = false
    @State private var stopSortMode: StopSortMode = .alphabetical
    @State private var currentLocation: CLLocation?
    @State private var currentLocationFocusRequestId = 0
    @State private var isLocatingStops = false
    @State private var selectedSearchPlace: PlaceSummary?
    @State private var selectedSearchCandidateId: String?
    @State private var isSettingsSheetPresented = false
    @State private var isNotificationsSheetPresented = false
    @State private var isScanSheetPresented = false
    @State private var isScannerSheetPresented = false
    @State private var pendingScanRouteCode: String?
    @FocusState private var isStopSearchFocused: Bool

    private var language: AppLanguage {
        appModel.preferredLanguage
    }

    private var selectedRouteDetail: RouteDetail? {
        guard let routeCode = appModel.selectedRouteCode else { return nil }
        return appModel.routeDetails[routeCode] ?? appModel.registration?.registration?.route
    }

    private var selectedStopId: String? {
        if let selectedHomeStopId {
            return selectedHomeStopId
        }
        if !showingRoutes {
            return selectedRouteStops.first?.id
        }
        return appModel.registration?.registration?.routeStop.id
    }

    private var activeStates: [StopBoardingState] {
        appModel.runInfoByRouteCode[appModel.selectedRouteCode ?? ""]?.stopStates ?? []
    }

    private var isSearchStopDetailActive: Bool {
        selectedSearchPlace != nil && !isStopSearchActive
    }

    private var selectedRouteStops: [RouteStop] {
        selectedRouteDetail?.stops.filter(\.isPickupEnabled) ?? []
    }

    private var selectedRouteStop: RouteStop? {
        guard !selectedRouteStops.isEmpty else { return nil }
        guard let selectedStopId else { return selectedRouteStops.first }
        return selectedRouteStops.first { $0.id == selectedStopId } ?? selectedRouteStops.first
    }

    private var selectedRouteStopIndex: Int? {
        guard let selectedStopId else { return nil }
        return selectedRouteStops.firstIndex { $0.id == selectedStopId }
    }

    private var isSelectedStopMyStop: Bool {
        guard
            let route = selectedRouteDetail,
            let selectedStopId,
            let registration = appModel.registration?.registration
        else { return false }
        return registration.route.routeCode == route.routeCode && registration.routeStop.id == selectedStopId
    }

    private var canSelectPreviousStop: Bool {
        guard let selectedRouteStopIndex else { return false }
        return selectedRouteStopIndex > 0
    }

    private var canSelectNextStop: Bool {
        guard let selectedRouteStopIndex else { return false }
        return selectedRouteStopIndex < selectedRouteStops.count - 1
    }

    private var filteredSearchPlaces: [PlaceSummary] {
        let trimmedQuery = stopSearchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedQuery.isEmpty else { return appModel.places }
        return appModel.places.filter {
            $0.name.localizedCaseInsensitiveContains(trimmedQuery)
        }
    }

    private var visibleSearchPlaces: [PlaceSummary] {
        guard stopSortMode == .distance, let currentLocation else { return filteredSearchPlaces }
        return filteredSearchPlaces.sorted {
            CLLocation(latitude: $0.lat, longitude: $0.lng).distance(from: currentLocation)
                < CLLocation(latitude: $1.lat, longitude: $1.lng).distance(from: currentLocation)
        }
    }

    private var selectedSearchCandidates: PlaceRoutesResponse? {
        guard let selectedSearchPlace else { return nil }
        return appModel.routeCandidates[selectedSearchPlace.googlePlaceId]
    }

    private var selectedSearchCandidate: StopCandidate? {
        guard let selectedSearchCandidateId else { return nil }
        return selectedSearchCandidates?.matchingStops.first { $0.routeStopId == selectedSearchCandidateId }
    }

    private var isSelectedSearchCandidateMyStop: Bool {
        guard
            let selectedSearchCandidate,
            let registration = appModel.registration?.registration
        else { return false }
        return registration.route.routeCode == selectedSearchCandidate.routeCode
            && registration.routeStop.id == selectedSearchCandidate.routeStopId
    }

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .bottom) {
                ShuttleMap(
                    route: selectedRouteDetail,
                    selectedStopId: selectedStopId,
                    activeStates: activeStates,
                    focusedUserLocation: currentLocation,
                    focusedUserLocationRequestId: currentLocationFocusRequestId,
                    bottomPadding: mapBottomPadding(for: proxy),
                    trailingPadding: 18
                )

                Color.black
                    .opacity(panelLevel.backgroundOpacity)
                    .ignoresSafeArea()
                    .allowsHitTesting(false)

                MapsStyleBottomSheet(
                    level: $panelLevel,
                    containerHeight: proxy.size.height,
                    bottomSafeArea: proxy.safeAreaInsets.bottom,
                    showsActionBar: !isStopSearchActive
                ) {
                    homeSheetChrome
                } actionBar: {
                    homeSheetActionBar
                } content: { isScrollEnabled in
                    if isStopSearchActive {
                        HomeStopSearchResults(
                            appModel: appModel,
                            places: visibleSearchPlaces,
                            query: stopSearchQuery,
                            sortMode: $stopSortMode,
                            isScrollEnabled: isScrollEnabled,
                            isLocating: isLocatingStops,
                            distanceText: distanceText,
                            onRequestLocation: {
                                Task { await requestLocation() }
                            },
                            onSelect: { place in
                                openSearchStopDetail(place)
                            }
                        )
                    } else if let selectedSearchPlace {
                        SearchStopDetail(
                            appModel: appModel,
                            place: selectedSearchPlace,
                            selectedCandidateId: $selectedSearchCandidateId,
                            isScrollEnabled: isScrollEnabled
                        )
                    } else if !showingRoutes, let route = selectedRouteDetail, let stop = selectedRouteStop {
                        RouteDetailContent(
                            route: route,
                            myStop: appModel.registration?.registration?.routeStop,
                            selectedStop: stop,
                            selectedRouteStopId: selectedStopId,
                            stopStates: activeStates,
                            isScrollEnabled: isScrollEnabled,
                            onStopSelect: { stopId in
                                selectedHomeStopId = stopId
                            }
                        )
                    } else if showingRoutes || selectedRouteDetail == nil {
                        HomeRouteList(
                            appModel: appModel,
                            isScrollEnabled: isScrollEnabled,
                            onSelect: { routeCode in
                                openRouteDetail(routeCode: routeCode)
                            },
                            onSelectMyRoute: {
                                showMyRouteDetail()
                                if let routeCode = appModel.registration?.registration?.route.routeCode {
                                    Task { await appModel.selectRoute(routeCode: routeCode) }
                                }
                            }
                        )
                    }
                }
            }
            .overlay(alignment: .bottomTrailing) {
                mapOverlayControls
                    .padding(.bottom, mapControlBottomOffset(for: proxy))
                    .padding(.trailing, 18)
            }
            .background(ShuttleTheme.background)
            .task {
                if appModel.selectedRouteCode == nil {
                    appModel.selectedRouteCode = appModel.registration?.registration?.route.routeCode
                        ?? appModel.routeSummaries.first?.routeCode
                }
            }
            .refreshable {
                try? await appModel.refreshAll()
            }
        }
        .navigationBarHidden(true)
        .sheet(isPresented: $isSettingsSheetPresented) {
            NavigationStack {
                SettingsPage(appModel: appModel, onOpenStopSearch: openStopSearchFromSettings)
            }
            .preferredColorScheme(appModel.preferredColorScheme)
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
            .presentationCornerRadius(32)
            .presentationBackgroundInteraction(.disabled)
        }
        .sheet(isPresented: $isNotificationsSheetPresented) {
            NavigationStack {
                NotificationsPage(appModel: appModel)
            }
            .mapSheetCloseOverlay(alignment: .topLeading) {
                isNotificationsSheetPresented = false
            }
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
            .presentationCornerRadius(32)
            .presentationBackgroundInteraction(.disabled)
        }
        .sheet(isPresented: $isScanSheetPresented) {
            NavigationStack {
                ScanPage(appModel: appModel, initialRouteCode: pendingScanRouteCode)
            }
            .mapSheetCloseOverlay(alignment: .topLeading) {
                isScanSheetPresented = false
            }
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
            .presentationCornerRadius(32)
            .presentationBackgroundInteraction(.disabled)
        }
        .sheet(isPresented: $isScannerSheetPresented) {
            QRScannerSheet(language: language) { payload in
                if let routeCode = appModel.parseRouteCode(from: payload) {
                    pendingScanRouteCode = routeCode
                    Task { try? await appModel.loadRunInfo(routeCode: routeCode) }
                }
                isScannerSheetPresented = false
            }
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
            .presentationCornerRadius(32)
            .presentationBackgroundInteraction(.disabled)
        }
        .onChange(of: isScannerSheetPresented) { _, isPresented in
            guard !isPresented, pendingScanRouteCode != nil else { return }
            isScanSheetPresented = true
        }
        .onChange(of: stopSortMode) { _, newValue in
            if newValue == .distance, currentLocation == nil {
                Task { await requestLocation() }
            }
        }
        .onChange(of: appModel.pendingNotificationNavigation) { _, target in
            guard let target else { return }
            applyNotificationNavigation(target)
        }
        .onChange(of: appModel.pendingScanNavigation) { _, target in
            guard let target else { return }
            applyScanNavigation(target)
        }
        .task {
            if let target = appModel.pendingScanNavigation {
                applyScanNavigation(target)
            }
        }
    }

    @ViewBuilder
    private var homeSheetChrome: some View {
        if !showingRoutes, let stop = selectedRouteStop {
            DetailChrome(
                backTitle: "Routes",
                title: stop.place.displayName ?? stop.place.name,
                subtitle: routeDetailSubtitle,
                onBack: showRouteList
            )
        } else if let selectedSearchPlace, !isStopSearchActive {
            DetailChrome(
                backTitle: "Search",
                title: selectedSearchCandidates?.sourceStop?.name ?? selectedSearchPlace.name,
                subtitle: selectedSearchCandidates?.sourceStop?.stopId.map { "Bus Stop ID \($0)" } ?? "Choose a route and time",
                onBack: showSearchResults
            )
        } else {
            HomeStopSearchBar(
                query: $stopSearchQuery,
                isActive: isStopSearchActive,
                avatarURL: appModel.currentUser?.pictureUrl,
                language: language,
                isFocused: $isStopSearchFocused,
                onActivate: activateStopSearch,
                onCancel: dismissStopSearch,
                onAvatarTap: openSettingsSheet
            )
        }
    }

    @ViewBuilder
    private var homeSheetActionBar: some View {
        if !showingRoutes, let stop = selectedRouteStop {
            StopDetailFloatingToolbar(
                stopName: stop.place.displayName ?? stop.place.name,
                canGoPrevious: canSelectPreviousStop,
                canGoNext: canSelectNextStop,
                isSaved: isSelectedStopMyStop,
                onPrevious: { selectAdjacentStop(offset: -1) },
                onSave: saveSelectedStopAsMyStop,
                onNext: { selectAdjacentStop(offset: 1) }
            )
        } else if let selectedSearchPlace, !isStopSearchActive {
            MyStopSaveActionBar(
                stopName: selectedSearchCandidates?.sourceStop?.name ?? selectedSearchPlace.name,
                isEnabled: selectedSearchCandidate != nil && !isSelectedSearchCandidateMyStop,
                isSaved: isSelectedSearchCandidateMyStop,
                disabledTitle: selectedSearchCandidate == nil ? "Choose Route First" : "My Stop Saved",
                onSave: saveSelectedSearchStopAsMyStop
            )
        } else {
            QRScanPrimaryActionBar(language: language) {
                isStopSearchFocused = false
                pendingScanRouteCode = nil
                isScannerSheetPresented = true
            }
        }
    }

    private var mapOverlayControls: some View {
        VStack(spacing: 12) {
            NotificationMapButton(count: appModel.unreadCount, language: language) {
                isStopSearchFocused = false
                isNotificationsSheetPresented = true
            }

            CurrentLocationMapButton(isLocating: isLocatingStops) {
                Task { await focusCurrentLocation() }
            }
        }
        .zIndex(4)
    }

    private var routeDetailSubtitle: String? {
        guard let route = selectedRouteDetail else { return nil }
        var parts = [route.label]
        if let pickupTime = selectedRouteStop?.pickupTime {
            parts.append(pickupTime)
        }
        if let selectedRouteStopIndex {
            parts.append("\(selectedRouteStopIndex + 1) / \(selectedRouteStops.count)")
        }
        return parts.joined(separator: " · ")
    }

    private func activateStopSearch() {
        selectedSearchPlace = nil
        selectedSearchCandidateId = nil
        isStopSearchActive = true
        withAnimation(.spring(response: 0.32, dampingFraction: 0.88)) {
            panelLevel = .expanded
        }
        Task { @MainActor in
            isStopSearchFocused = true
        }
    }

    private func openStopSearchFromSettings() {
        isSettingsSheetPresented = false
        stopSearchQuery = ""
        selectedSearchPlace = nil
        selectedSearchCandidateId = nil
        selectedHomeStopId = nil
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 250_000_000)
            activateStopSearch()
        }
    }

    private func dismissStopSearch() {
        stopSearchQuery = ""
        isStopSearchActive = false
        isStopSearchFocused = false
        selectedSearchPlace = nil
        selectedSearchCandidateId = nil
        withAnimation(.spring(response: 0.32, dampingFraction: 0.88)) {
            panelLevel = .medium
        }
    }

    private func openSearchStopDetail(_ place: PlaceSummary) {
        isStopSearchFocused = false
        isStopSearchActive = false
        selectedSearchPlace = place
        selectedSearchCandidateId = nil
        selectedHomeStopId = nil
        showingRoutes = true
        withAnimation(.spring(response: 0.32, dampingFraction: 0.88)) {
            panelLevel = .expanded
        }
        Task {
            await appModel.loadPlaceRoutes(googlePlaceId: place.googlePlaceId)
        }
    }

    private func showSearchResults() {
        selectedSearchPlace = nil
        selectedSearchCandidateId = nil
        isStopSearchActive = true
        isStopSearchFocused = false
        withAnimation(.spring(response: 0.32, dampingFraction: 0.88)) {
            panelLevel = .expanded
        }
    }

    private func openRouteDetail(routeCode: String) {
        isStopSearchFocused = false
        isStopSearchActive = false
        selectedSearchPlace = nil
        selectedSearchCandidateId = nil
        selectedHomeStopId = nil
        showingRoutes = false
        appModel.selectedRouteCode = routeCode
        keepMapVisibleForRouteDetail()
        Task { await appModel.selectRoute(routeCode: routeCode) }
    }

    private func applyNotificationNavigation(_ target: AppModel.NotificationNavigationTarget) {
        isSettingsSheetPresented = false
        isNotificationsSheetPresented = false
        isScanSheetPresented = false
        isScannerSheetPresented = false
        isStopSearchFocused = false
        isStopSearchActive = false
        selectedSearchPlace = nil
        selectedSearchCandidateId = nil
        selectedHomeStopId = target.routeStopId
        showingRoutes = false
        appModel.selectedRouteCode = target.routeCode
        keepMapVisibleForRouteDetail()
        Task { await appModel.selectRoute(routeCode: target.routeCode) }
        appModel.pendingNotificationNavigation = nil
    }

    private func applyScanNavigation(_ target: AppModel.ScanNavigationTarget) {
        isSettingsSheetPresented = false
        isNotificationsSheetPresented = false
        isScannerSheetPresented = false
        isStopSearchFocused = false
        isStopSearchActive = false
        selectedSearchPlace = nil
        selectedSearchCandidateId = nil
        pendingScanRouteCode = target.routeCode
        isScanSheetPresented = true
        Task { try? await appModel.loadRunInfo(routeCode: target.routeCode) }
        appModel.pendingScanNavigation = nil
    }

    private func showMyRouteDetail() {
        isStopSearchFocused = false
        isStopSearchActive = false
        selectedSearchPlace = nil
        selectedSearchCandidateId = nil
        showingRoutes = false
        selectedHomeStopId = appModel.registration?.registration?.routeStop.id
        keepMapVisibleForRouteDetail()
    }

    private func showRouteList() {
        isStopSearchFocused = false
        isStopSearchActive = false
        selectedSearchPlace = nil
        selectedSearchCandidateId = nil
        showingRoutes = true
        selectedHomeStopId = nil
        withAnimation(.spring(response: 0.32, dampingFraction: 0.88)) {
            panelLevel = .medium
        }
    }

    private func selectAdjacentStop(offset: Int) {
        guard !selectedRouteStops.isEmpty else { return }
        let currentIndex = selectedRouteStopIndex ?? 0
        let nextIndex = min(max(currentIndex + offset, 0), selectedRouteStops.count - 1)
        selectedHomeStopId = selectedRouteStops[nextIndex].id
    }

    private func keepMapVisibleForRouteDetail() {
        guard panelLevel == .compact else { return }
        withAnimation(.spring(response: 0.32, dampingFraction: 0.88)) {
            panelLevel = .medium
        }
    }

    private func saveSelectedStopAsMyStop() {
        guard
            let routeCode = selectedRouteDetail?.routeCode,
            let selectedStopId,
            !isSelectedStopMyStop
        else { return }
        Task {
            await appModel.registerStop(routeCode: routeCode, routeStopId: selectedStopId)
        }
    }

    private func saveSelectedSearchStopAsMyStop() {
        guard
            let selectedSearchCandidate,
            !isSelectedSearchCandidateMyStop
        else { return }
        Task {
            await appModel.registerStop(
                routeCode: selectedSearchCandidate.routeCode,
                routeStopId: selectedSearchCandidate.routeStopId
            )
        }
    }

    private func openSettingsSheet() {
        isStopSearchFocused = false
        isSettingsSheetPresented = true
    }

    private func distanceText(for place: PlaceSummary) -> String? {
        guard stopSortMode == .distance, let currentLocation else { return nil }
        let distance = CLLocation(latitude: place.lat, longitude: place.lng).distance(from: currentLocation) / 1000
        return String(format: "%.1f km", distance)
    }

    private func requestLocation() async {
        isLocatingStops = true
        defer { isLocatingStops = false }
        currentLocation = try? await OneShotLocationRequester().requestLocation()
    }

    private func focusCurrentLocation() async {
        isStopSearchFocused = false
        await requestLocation()
        if currentLocation != nil {
            currentLocationFocusRequestId += 1
        }
    }

    private func mapBottomPadding(for proxy: GeometryProxy) -> CGFloat {
        let sheetHeight = sheetHeight(for: proxy)
        let availableHeight = max(proxy.size.height, 1)
        return min(max(sheetHeight + 16, 108), max(120, availableHeight - 72))
    }

    private func mapControlBottomOffset(for proxy: GeometryProxy) -> CGFloat {
        sheetHeight(for: proxy) + 18
    }

    private func sheetHeight(for proxy: GeometryProxy) -> CGFloat {
        let safeBottom = proxy.safeAreaInsets.bottom
        let availableHeight = max(proxy.size.height, 1)

        switch panelLevel {
        case .compact:
            return 86 + safeBottom * 0.2
        case .medium:
            return min(max(availableHeight * 0.54, 320), max(120, availableHeight - 112))
        case .expanded:
            return min(max(availableHeight - min(max(8, safeBottom * 0.35), 16), 360), availableHeight)
        }
    }
}

private struct NotificationMapButton: View {
    let count: Int
    let language: AppLanguage
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "bell.fill")
                .font(.body.weight(.semibold))
                .foregroundStyle(.white)
                .frame(width: 44, height: 44)
                .background(.ultraThinMaterial, in: Circle())
                .overlay(alignment: .topTrailing) {
                    if count > 0 {
                        Text(count > 99 ? "99+" : "\(count)")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 5)
                            .frame(minWidth: 18, minHeight: 18)
                            .background(ShuttleTheme.danger, in: Capsule())
                            .offset(x: 4, y: -3)
                    }
                }
                .shadow(color: .black.opacity(0.16), radius: 10, y: 5)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(RiderStrings.tabsNotifications(language))
        .accessibilityValue(count > 0 ? "\(count) unread" : "No unread notifications")
    }
}

private struct CurrentLocationMapButton: View {
    let isLocating: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Group {
                if isLocating {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(.white)
                } else {
                    Image(systemName: "location.fill")
                        .font(.body.weight(.semibold))
                }
            }
            .foregroundStyle(.white)
            .frame(width: 44, height: 44)
            .background(.ultraThinMaterial, in: Circle())
            .shadow(color: .black.opacity(0.16), radius: 10, y: 5)
        }
        .buttonStyle(.plain)
        .disabled(isLocating)
        .accessibilityLabel("Current Location")
    }
}

private struct QRScanPrimaryActionBar: View {
    let language: AppLanguage
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label {
                Text(RiderStrings.scanTitle(language))
                    .font(.headline.weight(.semibold))
            } icon: {
                Image(systemName: "qrcode.viewfinder")
                    .font(.title3.weight(.semibold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 54)
            .background(ShuttleTheme.primary, in: Capsule())
            .shadow(color: .black.opacity(0.20), radius: 12, y: 6)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(RiderStrings.scanTitle(language))
    }
}

private struct StopDetailFloatingToolbar: View {
    let stopName: String
    let canGoPrevious: Bool
    let canGoNext: Bool
    let isSaved: Bool
    let onPrevious: () -> Void
    let onSave: () -> Void
    let onNext: () -> Void

    var body: some View {
        HStack(spacing: 4) {
            toolbarButton(
                systemImage: "arrow.down",
                title: "Next stop",
                isEnabled: canGoNext,
                action: onNext
            )

            toolbarButton(
                systemImage: "arrow.up",
                title: "Previous stop",
                isEnabled: canGoPrevious,
                action: onPrevious
            )

            saveButton
        }
        .padding(.horizontal, 7)
        .frame(height: 50)
        .background(.regularMaterial, in: Capsule())
        .overlay {
            Capsule()
                .stroke(ShuttleTheme.border.opacity(0.55), lineWidth: 0.5)
        }
        .shadow(color: .black.opacity(0.18), radius: 14, y: 8)
        .frame(maxWidth: .infinity)
    }

    private var saveButton: some View {
        Button {
            if !isSaved {
                onSave()
            }
        } label: {
            Label(isSaved ? "My Stop Saved" : "Save My Stop", systemImage: "location.fill")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(isSaved ? ShuttleTheme.primary : .white)
                .lineLimit(1)
                .minimumScaleFactor(0.82)
                .padding(.horizontal, 14)
                .frame(minWidth: 154)
                .frame(height: 38)
                .background(isSaved ? ShuttleTheme.surface.opacity(0.88) : ShuttleTheme.primary, in: Capsule())
                .overlay {
                    Capsule()
                        .stroke(isSaved ? ShuttleTheme.border.opacity(0.55) : Color.clear, lineWidth: 0.5)
                }
        }
        .buttonStyle(.plain)
        .layoutPriority(1)
        .accessibilityLabel(isSaved ? "\(stopName) is saved as my stop" : "Save \(stopName) as my stop")
    }

    private func toolbarButton(
        systemImage: String,
        title: String,
        isEnabled: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.title3.weight(.semibold))
                .foregroundStyle(isEnabled ? ShuttleTheme.text : ShuttleTheme.secondaryText.opacity(0.38))
                .frame(width: 48, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
        .accessibilityLabel(title)
    }
}

private struct DetailToolbarBackdrop: View {
    var body: some View {
        LinearGradient(
            colors: [
                ShuttleTheme.background.opacity(0),
                ShuttleTheme.background.opacity(0.82),
                ShuttleTheme.background.opacity(0.96)
            ],
            startPoint: .top,
            endPoint: .bottom
        )
        .ignoresSafeArea()
    }
}

private struct MapsStyleBottomSheet<Chrome: View, ActionBar: View, Content: View>: View {
    @Binding var level: HomePanelLevel
    let containerHeight: CGFloat
    let bottomSafeArea: CGFloat
    let showsActionBar: Bool
    let chrome: () -> Chrome
    let actionBar: () -> ActionBar
    let content: (_ isScrollEnabled: Bool) -> Content
    private let grabberHeight: CGFloat = 18
    private let chromeHeight: CGFloat = 46
    private let compactChromeBottomPadding: CGFloat = 4
    private let actionTopPadding: CGFloat = 6
    private let actionButtonHeight: CGFloat = 54
    private let actionBottomPadding: CGFloat = 8
    private let compactClippingAllowance: CGFloat = 4

    init(
        level: Binding<HomePanelLevel>,
        containerHeight: CGFloat,
        bottomSafeArea: CGFloat,
        showsActionBar: Bool,
        @ViewBuilder chrome: @escaping () -> Chrome,
        @ViewBuilder actionBar: @escaping () -> ActionBar,
        @ViewBuilder content: @escaping (_ isScrollEnabled: Bool) -> Content
    ) {
        self._level = level
        self.containerHeight = containerHeight
        self.bottomSafeArea = bottomSafeArea
        self.showsActionBar = showsActionBar
        self.chrome = chrome
        self.actionBar = actionBar
        self.content = content
    }

    private var actionAreaHeight: CGFloat {
        showsActionBar
            ? actionTopPadding + actionButtonHeight + max(bottomSafeArea * 0.32, actionBottomPadding) + compactClippingAllowance
            : 0
    }

    private var compactChromeHeight: CGFloat {
        grabberHeight + chromeHeight + compactChromeBottomPadding
    }

    private var isActionBarVisible: Bool {
        showsActionBar && level != .compact
    }

    private var height: CGFloat {
        let availableHeight = max(containerHeight, 1)
        switch level {
        case .compact:
            return compactChromeHeight
        case .medium:
            return min(max(availableHeight * 0.54, 320), max(120, availableHeight - 112))
        case .expanded:
            let expandedHeight = availableHeight - min(max(8, bottomSafeArea * 0.35), 16)
            return min(max(expandedHeight, 360), availableHeight)
        }
    }

    var body: some View {
        sheetBody
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .frame(height: height, alignment: .top)
        .glassSurface(RoundedRectangle(cornerRadius: 30, style: .continuous))
        .clipShape(RoundedRectangle(cornerRadius: 30, style: .continuous))
        .padding(.horizontal, level == .compact ? 10 : 8)
        .padding(.bottom, 0)
        .contentShape(Rectangle())
        .gesture(dragGesture, including: level == .expanded ? .gesture : .all)
        .animation(.spring(response: 0.32, dampingFraction: 0.88), value: level)
        .accessibilityElement(children: .contain)
    }

    @ViewBuilder
    private var sheetBody: some View {
        ZStack(alignment: .bottom) {
            VStack(spacing: 0) {
                grabber
                    .contentShape(Rectangle())
                    .gesture(dragGesture)

                chrome()
                    .padding(.horizontal, 12)
                    .padding(.bottom, level == .compact ? compactChromeBottomPadding : 10)

                content(level == .expanded)
                    .safeAreaInset(edge: .bottom) {
                        Color.clear.frame(height: level == .compact ? 0 : actionAreaHeight)
                    }
                    .frame(height: level == .compact ? 0 : nil)
                    .clipped()
                    .opacity(level == .compact ? 0 : 1)
                    .allowsHitTesting(level != .compact)
            }

            if isActionBarVisible {
                actionBar()
                    .padding(.horizontal, 12)
                    .padding(.top, actionTopPadding)
                    .padding(.bottom, actionBarBottomPadding)
                    .frame(maxWidth: .infinity)
                    .zIndex(1)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    private var actionBarBottomPadding: CGFloat {
        max(bottomSafeArea * 0.32, actionBottomPadding) + compactClippingAllowance
    }

    private var grabber: some View {
        VStack(spacing: 0) {
            Capsule()
                .fill(ShuttleTheme.border)
                .frame(width: 44, height: 5)
                .padding(.top, 7)
        }
        .frame(maxWidth: .infinity)
        .frame(height: grabberHeight, alignment: .top)
    }

    private var dragGesture: some Gesture {
        DragGesture(minimumDistance: 12)
            .onEnded { value in
                let upwardIntent = min(value.translation.height, value.predictedEndTranslation.height)
                let downwardIntent = max(value.translation.height, value.predictedEndTranslation.height)

                withAnimation(.spring(response: 0.32, dampingFraction: 0.88)) {
                    if upwardIntent < -46 {
                        level = level.expandedStep
                    } else if downwardIntent > 46 {
                        level = level.compactedStep
                    }
                }
            }
    }
}

private struct HomeStopSearchBar: View {
    @Binding var query: String
    let isActive: Bool
    let avatarURL: String?
    let language: AppLanguage
    @FocusState.Binding var isFocused: Bool
    let onActivate: () -> Void
    let onCancel: () -> Void
    let onAvatarTap: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(ShuttleTheme.secondaryText)

                TextField(RiderStrings.searchStopsTitle(language), text: $query)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .focused($isFocused)
                    .submitLabel(.search)
                    .onTapGesture(perform: onActivate)
                    .onChange(of: isFocused) { _, focused in
                        if focused {
                            onActivate()
                        }
                    }

                if !query.isEmpty {
                    Button {
                        query = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(ShuttleTheme.secondaryText)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Clear search")
                }
            }
            .padding(.horizontal, 12)
            .frame(height: 46)
            .background(.thinMaterial, in: Capsule())
            .overlay {
                Capsule()
                    .stroke(ShuttleTheme.border.opacity(0.7), lineWidth: 0.5)
            }

            if isActive {
                CloseIconButton(action: onCancel)
                    .transition(.move(edge: .trailing).combined(with: .opacity))
            } else {
                Button(action: onAvatarTap) {
                    ProfileAvatar(urlString: avatarURL)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(RiderStrings.homeProfileAriaLabel(language))
            }
        }
        .animation(.spring(response: 0.28, dampingFraction: 0.9), value: isActive)
    }
}

private struct ProfileAvatar: View {
    let urlString: String?

    var body: some View {
        Group {
            if let urlString, let url = URL(string: urlString) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case let .success(image):
                        image
                            .resizable()
                            .scaledToFill()
                    default:
                        fallbackAvatar
                    }
                }
            } else {
                fallbackAvatar
            }
        }
        .frame(width: 44, height: 44)
        .clipShape(Circle())
        .overlay {
            Circle()
                .stroke(ShuttleTheme.border.opacity(0.8), lineWidth: 1)
        }
        .shadow(color: .black.opacity(0.14), radius: 10, x: 0, y: 5)
    }

    private var fallbackAvatar: some View {
        ZStack {
            Circle()
                .fill(ShuttleTheme.surface)
            Image(systemName: "person.crop.circle.fill")
                .font(.system(size: 34))
                .foregroundStyle(ShuttleTheme.secondaryText)
        }
    }
}

private struct HomeStopSearchResults: View {
    @Bindable var appModel: AppModel
    let places: [PlaceSummary]
    let query: String
    @Binding var sortMode: StopSortMode
    let isScrollEnabled: Bool
    let isLocating: Bool
    let distanceText: (PlaceSummary) -> String?
    let onRequestLocation: () -> Void
    let onSelect: (PlaceSummary) -> Void

    private var language: AppLanguage {
        appModel.preferredLanguage
    }

    var body: some View {
        List {
            Section {
                Picker("Sort", selection: $sortMode) {
                    Text("A-Z").tag(StopSortMode.alphabetical)
                    Text(isLocating ? "Locating..." : "Nearby").tag(StopSortMode.distance)
                }
                .pickerStyle(.segmented)
                .disabled(isLocating)
            }

            Section(RiderStrings.searchStopsTitle(language)) {
                if appModel.isInitialDataLoading && appModel.places.isEmpty {
                    ForEach(0..<8, id: \.self) { _ in
                        SkeletonListRow()
                    }
                } else if places.isEmpty {
                    ContentUnavailableView(
                        query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                            ? "No stops are available yet."
                            : "No stops found.",
                        systemImage: "mappin.slash"
                    )
                } else {
                    ForEach(places) { place in
                        Button {
                            onSelect(place)
                        } label: {
                            SearchStopRow(
                                place: place,
                                distance: distanceText(place)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .scrollDisabled(!isScrollEnabled)
        .safeAreaInset(edge: .bottom) {
            Color.clear.frame(height: 24)
        }
        .refreshable {
            if sortMode == .distance {
                onRequestLocation()
            } else {
                try? await appModel.refreshAll()
            }
        }
    }
}

private struct HomeRouteList: View {
    @Bindable var appModel: AppModel
    let isScrollEnabled: Bool
    let onSelect: (String) -> Void
    let onSelectMyRoute: () -> Void

    private var registration: RegistrationRecord? {
        appModel.registration?.registration
    }

    private var routeSummaries: [RouteSummary] {
        guard let routeCode = registration?.route.routeCode else {
            return appModel.routeSummaries
        }
        return appModel.routeSummaries.filter { $0.routeCode != routeCode }
    }

    private var language: AppLanguage {
        appModel.preferredLanguage
    }

    var body: some View {
        if appModel.isInitialDataLoading && appModel.routeSummaries.isEmpty {
            HomeRouteListSkeleton(
                isScrollEnabled: isScrollEnabled,
                showsMyRoutePlaceholder: appModel.registration?.registration != nil || appModel.registration == nil,
                language: language
            )
        } else if appModel.routeSummaries.isEmpty && registration == nil {
            ContentUnavailableView("No active routes are available right now.", systemImage: "map")
                .frame(maxWidth: .infinity, minHeight: 180)
        } else {
            List {
                if let registration {
                    Section(RiderStrings.homeMyRouteHeader(language)) {
                        Button {
                            onSelectMyRoute()
                        } label: {
                            Label {
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(registration.route.label)
                                    Text(registration.routeStop.place.displayName ?? registration.routeStop.place.name)
                                        .font(.subheadline)
                                        .foregroundStyle(.secondary)
                                }
                            } icon: {
                                Image(systemName: "location.fill")
                            }
                        }
                    }
                }

                if !routeSummaries.isEmpty {
                    Section(RiderStrings.homeRoutesHeader(language)) {
                        ForEach(routeSummaries) { route in
                            Button {
                                onSelect(route.routeCode)
                            } label: {
                                RouteSummaryRow(route: route, language: language)
                            }
                        }
                    }
                }

                Section {
                    FooterText()
                        .frame(maxWidth: .infinity)
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .scrollDisabled(!isScrollEnabled)
            .safeAreaInset(edge: .bottom) {
                Color.clear.frame(height: 24)
            }
        }
    }
}

private struct HomeRouteListSkeleton: View {
    let isScrollEnabled: Bool
    let showsMyRoutePlaceholder: Bool
    let language: AppLanguage

    var body: some View {
        List {
            if showsMyRoutePlaceholder {
                Section(RiderStrings.homeMyRouteHeader(language)) {
                    SkeletonListRow()
                }
            }

            Section(RiderStrings.homeRoutesHeader(language)) {
                ForEach(0..<4, id: \.self) { _ in
                    SkeletonListRow()
                }
            }

            Section {
                SkeletonBlock(width: 220, height: 12)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .scrollDisabled(!isScrollEnabled)
        .accessibilityLabel("Loading routes")
    }
}

private struct RouteSummaryRow: View {
    let route: RouteSummary
    let language: AppLanguage

    var body: some View {
        Label {
            VStack(alignment: .leading, spacing: 3) {
                Text(route.label)
                Text(RiderStrings.homeStopCount(route.visibleStopCount, language: language))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        } icon: {
            Image(systemName: "location.north.line")
        }
    }
}

private struct DetailLoadingView: View {
    let title: String

    var body: some View {
        ProgressView(title)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(ShuttleTheme.background)
    }
}

private struct DetailSheetHeader: View {
    let backTitle: String
    let title: String
    let subtitle: String?
    let onBack: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button(action: onBack) {
                Label(backTitle, systemImage: "chevron.left")
                    .labelStyle(.titleAndIcon)
                    .font(.subheadline.weight(.semibold))
            }
            .buttonStyle(.plain)
            .foregroundStyle(ShuttleTheme.primary)

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.title2.weight(.bold))
                    .foregroundStyle(ShuttleTheme.text)
                    .lineLimit(2)

                if let subtitle {
                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundStyle(ShuttleTheme.secondaryText)
                        .lineLimit(2)
                }
            }
            .padding(.trailing, 44)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 20)
        .padding(.top, 22)
        .padding(.bottom, 10)
    }
}

private struct DetailChrome: View {
    let backTitle: String
    let title: String
    let subtitle: String?
    let onBack: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Button(action: onBack) {
                Label(backTitle, systemImage: "chevron.left")
                    .labelStyle(.iconOnly)
                    .font(.headline.weight(.semibold))
                    .frame(width: 34, height: 34)
                    .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .foregroundStyle(ShuttleTheme.primary)
            .accessibilityLabel(backTitle)

            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(ShuttleTheme.text)
                    .lineLimit(1)

                if let subtitle {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(ShuttleTheme.secondaryText)
                        .lineLimit(1)
                }
            }

            Spacer(minLength: 0)
        }
        .frame(height: 46)
    }
}

private struct RouteDetailContent: View {
    let route: RouteDetail
    let myStop: RouteStop?
    let selectedStop: RouteStop
    let selectedRouteStopId: String?
    let stopStates: [StopBoardingState]
    let isScrollEnabled: Bool
    let onStopSelect: (String) -> Void

    private var visibleStops: [RouteStop] {
        route.stops.filter(\.isPickupEnabled)
    }

    var body: some View {
        List {
            StopInfoSummary(data: stopInfoData(for: selectedStop.place))

            Section("Stops on this route") {
                RouteStepper(
                    stops: visibleStops,
                    myRouteStopId: myStop?.id,
                    selectedRouteStopId: selectedRouteStopId,
                    stopStates: stopStates,
                    onStopSelect: onStopSelect
                )
                .listRowInsets(EdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16))
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .scrollDisabled(!isScrollEnabled)
        .safeAreaInset(edge: .bottom) {
            Color.clear.frame(height: 24)
        }
    }
}

private struct RouteDetailSheet: View {
    let route: RouteDetail
    let myStop: RouteStop?
    let selectedStop: RouteStop
    let selectedIndex: Int?
    let totalStops: Int
    let selectedRouteStopId: String?
    let stopStates: [StopBoardingState]
    let canGoPrevious: Bool
    let canGoNext: Bool
    let isSaved: Bool
    let onPrevious: () -> Void
    let onSave: () -> Void
    let onNext: () -> Void
    let onBack: () -> Void
    let onStopSelect: (String) -> Void

    private var visibleStops: [RouteStop] {
        route.stops.filter(\.isPickupEnabled)
    }

    var body: some View {
        VStack(spacing: 0) {
            DetailSheetHeader(
                backTitle: "Routes",
                title: selectedStop.place.displayName ?? selectedStop.place.name,
                subtitle: subtitle,
                onBack: onBack
            )

            List {
                StopInfoSummary(data: stopInfoData(for: selectedStop.place))

                Section("Stops on this route") {
                    RouteStepper(
                        stops: visibleStops,
                        myRouteStopId: myStop?.id,
                        selectedRouteStopId: selectedRouteStopId,
                        stopStates: stopStates,
                        onStopSelect: onStopSelect
                    )
                    .listRowInsets(EdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16))
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
        }
        .background(ShuttleTheme.background)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            StopDetailFloatingToolbar(
                stopName: selectedStop.place.displayName ?? selectedStop.place.name,
                canGoPrevious: canGoPrevious,
                canGoNext: canGoNext,
                isSaved: isSaved,
                onPrevious: onPrevious,
                onSave: onSave,
                onNext: onNext
            )
            .padding(.horizontal, 20)
            .padding(.top, 12)
            .padding(.bottom, 12)
            .background(DetailToolbarBackdrop())
        }
    }

    private var subtitle: String {
        var parts = [route.label]
        if let pickupTime = selectedStop.pickupTime {
            parts.append(pickupTime)
        }
        if let selectedIndex {
            parts.append("\(selectedIndex + 1) / \(totalStops)")
        }
        return parts.joined(separator: " · ")
    }
}

private struct SearchStopDetailSheet: View {
    @Bindable var appModel: AppModel
    let place: PlaceSummary
    @Binding var selectedCandidateId: String?
    let selectedCandidate: StopCandidate?
    let isSaved: Bool
    let onBack: () -> Void
    let onSave: () -> Void

    private var routeCandidates: PlaceRoutesResponse? {
        appModel.routeCandidates[place.googlePlaceId]
    }

    private var sourceStop: StopCandidate? {
        routeCandidates?.sourceStop
    }

    var body: some View {
        VStack(spacing: 0) {
            DetailSheetHeader(
                backTitle: "Search",
                title: sourceStop?.name ?? place.name,
                subtitle: sourceStop?.stopId.map { "Bus Stop ID \($0)" } ?? "Choose a route and time",
                onBack: onBack
            )

            SearchStopDetail(
                appModel: appModel,
                place: place,
                selectedCandidateId: $selectedCandidateId,
                isScrollEnabled: true
            )
        }
        .background(ShuttleTheme.background)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            MyStopSaveActionBar(
                stopName: sourceStop?.name ?? place.name,
                isEnabled: selectedCandidate != nil && !isSaved,
                isSaved: isSaved,
                disabledTitle: selectedCandidate == nil ? "Choose Route First" : "My Stop Saved",
                onSave: onSave
            )
            .padding(.horizontal, 20)
            .padding(.top, 12)
            .padding(.bottom, 12)
            .background(DetailToolbarBackdrop())
        }
    }
}

private struct MyStopSaveActionBar: View {
    let stopName: String
    let isEnabled: Bool
    let isSaved: Bool
    let disabledTitle: String
    let onSave: () -> Void

    var body: some View {
        Button {
            if isEnabled {
                onSave()
            }
        } label: {
            Label(title, systemImage: isSaved ? "location.fill" : "location")
                .font(.headline.weight(.semibold))
                .foregroundStyle(isEnabled ? .white : ShuttleTheme.secondaryText)
                .frame(maxWidth: .infinity)
                .frame(height: 52)
                .background(isEnabled ? ShuttleTheme.primary : ShuttleTheme.surface.opacity(0.88), in: Capsule())
                .overlay {
                    Capsule()
                        .stroke(isEnabled ? Color.clear : ShuttleTheme.border.opacity(0.55), lineWidth: 0.5)
                }
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
        .accessibilityLabel(isEnabled ? "Save \(stopName) as my stop" : disabledTitle)
    }

    private var title: String {
        isEnabled ? "Save My Stop" : disabledTitle
    }
}

private struct SearchStopDetail: View {
    @Bindable var appModel: AppModel
    let place: PlaceSummary
    @Binding var selectedCandidateId: String?
    let isScrollEnabled: Bool

    private var routeCandidates: PlaceRoutesResponse? {
        appModel.routeCandidates[place.googlePlaceId]
    }

    private var sourceStop: StopCandidate? {
        routeCandidates?.sourceStop
    }

    var body: some View {
        List {
            if let sourceStop {
                StopInfoSummary(data: stopInfoData(for: sourceStop))
            }

            Section("Available Routes") {
                if let candidates = routeCandidates?.matchingStops, !candidates.isEmpty {
                    ForEach(candidates) { candidate in
                        Button {
                            selectedCandidateId = candidate.routeStopId
                        } label: {
                            SearchRouteCandidateRow(
                                candidate: candidate,
                                isSelected: candidate.routeStopId == selectedCandidateId
                            )
                        }
                        .buttonStyle(.plain)
                    }
                } else if routeCandidates == nil {
                    ForEach(0..<3, id: \.self) { _ in
                        SkeletonListRow()
                    }
                } else {
                    ContentUnavailableView("No route times were found for this stop.", systemImage: "bus")
                        .padding(.vertical, 18)
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .scrollDisabled(!isScrollEnabled)
        .safeAreaInset(edge: .bottom) {
            Color.clear.frame(height: 24)
        }
        .refreshable {
            await appModel.loadPlaceRoutes(googlePlaceId: place.googlePlaceId)
        }
    }
}

private struct StopInfoSummary: View {
    let data: StopInfoData

    var body: some View {
        if data.hasContent {
            VStack(alignment: .leading, spacing: 8) {
                if hasBadges {
                    HStack(spacing: 6) {
                        if data.isBusStop, let stopId = data.trimmedStopId {
                            StopInfoBadge(text: "Bus Stop \(stopId)", systemImage: "bus.fill")
                        }

                        if data.isTerminal {
                            StopInfoBadge(text: "Terminal", systemImage: "flag.checkered")
                        }
                    }
                }

                if let address = data.trimmedAddress {
                    Label {
                        Text(address)
                            .font(.subheadline)
                            .foregroundStyle(ShuttleTheme.secondaryText)
                            .fixedSize(horizontal: false, vertical: true)
                    } icon: {
                        Image(systemName: "location.fill")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(ShuttleTheme.primary)
                    }
                }
            }
        }
    }

    private var hasBadges: Bool {
        (data.isBusStop && data.trimmedStopId != nil) || data.isTerminal
    }
}

private struct StopInfoBadge: View {
    let text: String
    let systemImage: String

    var body: some View {
        Label(text, systemImage: systemImage)
            .font(.caption.weight(.semibold))
            .foregroundStyle(ShuttleTheme.primary)
            .lineLimit(1)
            .padding(.horizontal, 8)
            .padding(.vertical, 5)
            .background(ShuttleTheme.primary.opacity(0.10), in: Capsule())
            .overlay {
                Capsule()
                    .stroke(ShuttleTheme.primary.opacity(0.16), lineWidth: 0.5)
        }
    }
}

private struct SearchRouteCandidateRow: View {
    let candidate: StopCandidate
    let isSelected: Bool

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                .font(.title3)
                .foregroundStyle(isSelected ? ShuttleTheme.primary : ShuttleTheme.secondaryText)

            VStack(alignment: .leading, spacing: 3) {
                Text(routeCandidateShortTitle(candidate))
                    .font(.body.weight(.semibold))
                    .foregroundStyle(isSelected ? ShuttleTheme.primary : ShuttleTheme.text)
                    .lineLimit(1)

                Text("Stop \(candidate.stopOrder)")
                    .font(.subheadline)
                    .foregroundStyle(ShuttleTheme.secondaryText)
            }

            Spacer(minLength: 8)

            Text(candidate.pickupTime ?? "TBD")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(isSelected ? ShuttleTheme.primary : ShuttleTheme.secondaryText)
                .monospacedDigit()
        }
        .contentShape(Rectangle())
        .padding(.vertical, 2)
    }
}

private struct RouteStepper: View {
    let stops: [RouteStop]
    let myRouteStopId: String?
    let selectedRouteStopId: String?
    let stopStates: [StopBoardingState]
    let onStopSelect: (String) -> Void

    private var stateLookup: [String: StopBoardingState] {
        Dictionary(uniqueKeysWithValues: stopStates.map { ($0.routeStopId, $0) })
    }

    private var lastArrivedIndex: Int {
        stops.enumerated().reduce(-1) { partial, item in
            stateLookup[item.element.id]?.status == "arrived" ? item.offset : partial
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(stops.enumerated()), id: \.element.id) { index, stop in
                let state = stateLookup[stop.id]
                let isSelected = stop.id == selectedRouteStopId
                let isMine = stop.id == myRouteStopId
                let isArrived = state?.status == "arrived"
                let isCurrent = !stopStates.isEmpty && index == lastArrivedIndex + 1

                Button {
                    onStopSelect(stop.id)
                } label: {
                    HStack(alignment: .top, spacing: 12) {
                        TimelineDot(
                            label: stopStates.isEmpty ? "\(index + 1)" : "\(state?.totalPassengers ?? 0)",
                            isFilled: isSelected || isCurrent,
                            isArrived: isArrived,
                            showLine: index < stops.count - 1
                        )

                        VStack(alignment: .leading, spacing: 5) {
                            HStack(spacing: 8) {
                                Text(stop.place.displayName ?? stop.place.name)
                                    .font(.body.weight(isSelected || isMine ? .bold : .medium))
                                    .foregroundStyle(isSelected ? ShuttleTheme.primary : ShuttleTheme.text)
                                    .lineLimit(2)
                                if isMine {
                                    Text("Selected")
                                        .font(.caption2.weight(.bold))
                                        .foregroundStyle(ShuttleTheme.primary)
                                        .padding(.horizontal, 7)
                                        .padding(.vertical, 3)
                                        .glassSurface(Capsule())
                                }
                                Spacer(minLength: 0)
                                Text(stop.pickupTime ?? "TBD")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(isSelected ? ShuttleTheme.primary : ShuttleTheme.secondaryText)
                                    .monospacedDigit()
                            }

                            if let description = stepDescription(stop: stop, state: state, isArrived: isArrived) {
                                Text(description)
                                    .font(.subheadline)
                                    .foregroundStyle(ShuttleTheme.secondaryText)
                                    .lineLimit(1)
                            }
                        }
                        .padding(.bottom, index < stops.count - 1 ? 12 : 4)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func stepDescription(stop: RouteStop, state: StopBoardingState?, isArrived: Bool) -> String? {
        var parts: [String] = []
        if let notes = stop.notes?.trimmingCharacters(in: .whitespacesAndNewlines), !notes.isEmpty {
            parts.append(notes)
        }
        if let state {
            parts.append("\(isArrived ? "Arrived" : "Waiting") · \(state.totalPassengers) boarded")
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}

private struct TimelineDot: View {
    let label: String
    let isFilled: Bool
    let isArrived: Bool
    let showLine: Bool

    var body: some View {
        VStack(spacing: 0) {
            ZStack {
                Circle()
                    .fill(isFilled ? ShuttleTheme.primary : ShuttleTheme.surface)
                    .overlay {
                        Circle()
                            .stroke(isArrived ? ShuttleTheme.success : ShuttleTheme.border, lineWidth: 2)
                    }
                Text(label)
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(isFilled ? .white : ShuttleTheme.primary)
            }
            .frame(width: 28, height: 28)

            if showLine {
                Rectangle()
                    .fill(ShuttleTheme.border)
                    .frame(width: 2, height: 48)
            }
        }
    }
}

private struct StatusPill: View {
    let title: String
    let systemImage: String
    let color: Color

    var body: some View {
        Label(title, systemImage: systemImage)
            .font(.caption.weight(.semibold))
            .foregroundStyle(color)
            .padding(.horizontal, 9)
            .padding(.vertical, 4)
            .glassSurface(Capsule())
    }
}

private struct FooterText: View {
    var body: some View {
        VStack(spacing: 4) {
            Text("NaNum and SeomKim Church")
                .font(.footnote.weight(.semibold))
            Text("KPC(SINGAPORE) LTD. 12 Shelford Road Singapore 288370")
                .font(.caption)
                .multilineTextAlignment(.center)
        }
        .foregroundStyle(ShuttleTheme.secondaryText)
        .frame(maxWidth: .infinity)
    }
}

private final class OneShotLocationRequester: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private var continuation: CheckedContinuation<CLLocation, Error>?

    func requestLocation() async throws -> CLLocation {
        try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            manager.delegate = self
            manager.requestWhenInUseAuthorization()
            manager.requestLocation()
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.first else { return }
        continuation?.resume(returning: location)
        continuation = nil
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        continuation?.resume(throwing: error)
        continuation = nil
    }
}
