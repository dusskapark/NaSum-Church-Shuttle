import CoreLocation
import Observation
import SwiftUI
import UIKit
#if canImport(VisionKit)
import VisionKit
#endif

struct RootView: View {
    @Bindable var appModel: AppModel

    var body: some View {
        Group {
            if appModel.isBootstrapping {
                ProgressView("Loading...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if appModel.isAuthenticated {
                RiderShellView(appModel: appModel)
            } else {
                LoginView(appModel: appModel)
            }
        }
        .tint(ShuttleTheme.primary)
        .background(ShuttleTheme.background)
    }
}

private struct LoginView: View {
    @Bindable var appModel: AppModel
    @State private var presentingViewController: UIViewController?
    @State private var isEmailLoginPresented = false

    var body: some View {
        ZStack {
            ShuttleTheme.background.ignoresSafeArea()

            VStack(spacing: 26) {
                Spacer(minLength: 56)

                VStack(spacing: 22) {
                    Image(systemName: "bus.doubledecker.fill")
                        .font(.system(size: 68, weight: .semibold))
                        .foregroundStyle(ShuttleTheme.success)

                    Text(AppConfiguration.appName)
                        .font(.system(size: 42, weight: .bold, design: .rounded))
                        .foregroundStyle(ShuttleTheme.text)
                        .multilineTextAlignment(.center)

                    Text("NaSum Church Shuttle")
                        .font(.callout.weight(.semibold))
                        .foregroundStyle(ShuttleTheme.secondaryText)
                }

                VStack(spacing: 12) {
                    Button {
                        Task {
                            await appModel.signIn(presentingViewController: presentingViewController)
                        }
                    } label: {
                        HStack(spacing: 10) {
                            if appModel.isAuthenticating {
                                ProgressView()
                                    .progressViewStyle(.circular)
                            }
                            Text(appModel.isAuthenticating ? "Signing In..." : "Continue with LINE")
                                .fontWeight(.semibold)
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .shuttleButtonStyle(prominent: true)
                    .controlSize(.large)
                    .tint(ShuttleTheme.success)
                    .disabled(appModel.isAuthenticating)

                    Button {
                        isEmailLoginPresented = true
                    } label: {
                        Label("Continue with Email", systemImage: "envelope.fill")
                            .fontWeight(.semibold)
                            .frame(maxWidth: .infinity)
                    }
                    .shuttleButtonStyle(prominent: false)
                    .controlSize(.large)
                    .disabled(appModel.isAuthenticating)
                }
                .padding(.horizontal, 28)

                Spacer(minLength: 72)
            }
            .background {
                ViewControllerResolver { presentingViewController = $0 }
                    .allowsHitTesting(false)
            }
        }
        .sheet(isPresented: $isEmailLoginPresented) {
            EmailLoginSheet(appModel: appModel)
        }
    }
}

private struct EmailLoginSheet: View {
    @Bindable var appModel: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var email = ""
    @State private var password = ""

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Email", text: $email)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                        .textContentType(.username)
                    SecureField("Password", text: $password)
                        .textContentType(.password)
                } footer: {
                    Text("For Apple App Review admin access only.")
                }
            }
            .navigationTitle("Email Login")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(appModel.isAuthenticating ? "Signing In..." : "Sign In") {
                        Task {
                            await appModel.signInWithEmail(
                                email: email.trimmingCharacters(in: .whitespacesAndNewlines),
                                password: password
                            )
                            if appModel.isAuthenticated {
                                dismiss()
                            }
                        }
                    }
                    .disabled(appModel.isAuthenticating || email.isEmpty || password.isEmpty)
                }
            }
        }
    }
}

private enum RiderTab: Hashable {
    case home
    case stops
    case scan
    case notifications
    case settings
    case admin

    var title: String {
        switch self {
        case .home: "Home"
        case .stops: "Stops"
        case .scan: "Scan"
        case .notifications: "Alerts"
        case .settings: "Settings"
        case .admin: "Admin"
        }
    }

    var systemImage: String {
        switch self {
        case .home: "location.north.line.fill"
        case .stops: "magnifyingglass"
        case .scan: "qrcode.viewfinder"
        case .notifications: "bell.fill"
        case .settings: "gearshape.fill"
        case .admin: "person.2.crop.square.stack.fill"
        }
    }
}

private struct RiderShellView: View {
    @Bindable var appModel: AppModel
    @State private var selectedTab: RiderTab = .home

    private var tabs: [RiderTab] {
        var value: [RiderTab] = [.home, .stops, .scan, .notifications, .settings]
        if appModel.isAdminSurfaceEnabled {
            value.append(.admin)
        }
        return value
    }

    var body: some View {
        ZStack {
            switch selectedTab {
            case .home:
                NavigationStack {
                    ShuttleHome(appModel: appModel)
                }
            case .stops:
                NavigationStack {
                    SearchPage(appModel: appModel)
                }
            case .scan:
                NavigationStack {
                    ScanPage(appModel: appModel)
                }
            case .notifications:
                NavigationStack {
                    NotificationsPage(appModel: appModel)
                }
            case .settings:
                NavigationStack {
                    SettingsPage(appModel: appModel)
                }
            case .admin:
                NavigationStack {
                    AdminPlaceholderView(appModel: appModel)
                }
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            ShuttleTabBar(
                tabs: tabs,
                selectedTab: $selectedTab,
                unreadCount: appModel.unreadCount
            )
        }
    }
}

private struct ShuttleTabBar: View {
    let tabs: [RiderTab]
    @Binding var selectedTab: RiderTab
    let unreadCount: Int

    var body: some View {
        HStack(spacing: 0) {
            ForEach(tabs, id: \.self) { tab in
                Button {
                    selectedTab = tab
                } label: {
                    VStack(spacing: 4) {
                        ZStack(alignment: .topTrailing) {
                            Image(systemName: tab.systemImage)
                                .font(.system(size: 20, weight: tab == .scan ? .semibold : .medium))
                            if tab == .notifications && unreadCount > 0 {
                                Text("\(unreadCount)")
                                    .font(.caption2.weight(.bold))
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 5)
                                    .frame(minWidth: 18, minHeight: 18)
                                    .background(ShuttleTheme.primary, in: Capsule())
                                    .offset(x: 12, y: -8)
                            }
                        }
                        Text(tab.title)
                            .font(.caption2.weight(.medium))
                    }
                    .frame(maxWidth: .infinity)
                    .foregroundStyle(selectedTab == tab ? ShuttleTheme.primary : ShuttleTheme.text)
                    .padding(.vertical, tab == .scan ? 7 : 9)
                    .background {
                        if tab == .scan {
                            RoundedRectangle(cornerRadius: 8, style: .continuous)
                                .stroke(ShuttleTheme.border, lineWidth: 1.5)
                                .padding(.horizontal, 4)
                        }
                    }
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 6)
        .padding(.top, 5)
        .padding(.bottom, 8)
        .frame(height: 64)
        .glassSurface()
        .overlay(alignment: .top) {
            Rectangle()
                .fill(ShuttleTheme.border)
                .frame(height: 0.5)
        }
    }
}

private enum HomePanelLevel: CaseIterable {
    case compact
    case medium
    case expanded
}

private struct ShuttleHome: View {
    @Bindable var appModel: AppModel
    @State private var panelLevel: HomePanelLevel = .medium
    @State private var showingRoutes = false
    @State private var selectedHomeStopId: String?

    private var selectedRouteDetail: RouteDetail? {
        guard let routeCode = appModel.selectedRouteCode else { return nil }
        return appModel.routeDetails[routeCode] ?? appModel.registration?.registration?.route
    }

    private var selectedStopId: String? {
        selectedHomeStopId ?? appModel.registration?.registration?.routeStop.id
    }

    private var activeStates: [StopBoardingState] {
        appModel.runInfoByRouteCode[appModel.selectedRouteCode ?? ""]?.stopStates ?? []
    }

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .bottom) {
                ShuttleMap(
                    route: selectedRouteDetail,
                    selectedStopId: selectedStopId,
                    activeStates: activeStates
                )

                HomeFloatingPanel(
                    height: panelHeight(in: proxy.size.height),
                    level: $panelLevel
                ) {
                    if showingRoutes || selectedRouteDetail == nil {
                        HomeRouteList(
                            appModel: appModel,
                            onSelect: { routeCode in
                                showingRoutes = false
                                selectedHomeStopId = nil
                                Task { await appModel.selectRoute(routeCode: routeCode) }
                            },
                            onShowMyStop: {
                                showingRoutes = false
                                selectedHomeStopId = appModel.registration?.registration?.routeStop.id
                                if let routeCode = appModel.registration?.registration?.route.routeCode {
                                    Task { await appModel.selectRoute(routeCode: routeCode) }
                                }
                            }
                        )
                    } else if let route = selectedRouteDetail {
                        HomeRouteDetail(
                            route: route,
                            myStop: appModel.registration?.registration?.routeStop,
                            selectedRouteStopId: selectedStopId,
                            stopStates: activeStates,
                            onBack: { showingRoutes = true },
                            onStopSelect: { stopId in
                                selectedHomeStopId = stopId
                                panelLevel = .expanded
                                appModel.routeDetails[route.routeCode] = route
                            }
                        )
                    }
                }
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
    }

    private func panelHeight(in totalHeight: CGFloat) -> CGFloat {
        switch panelLevel {
        case .compact:
            min(330, totalHeight * 0.44)
        case .medium:
            totalHeight * 0.66
        case .expanded:
            totalHeight * 0.88
        }
    }
}

private struct HomeFloatingPanel<Content: View>: View {
    let height: CGFloat
    @Binding var level: HomePanelLevel
    @ViewBuilder var content: Content

    var body: some View {
        VStack(spacing: 0) {
            Capsule()
                .fill(ShuttleTheme.border)
                .frame(width: 38, height: 5)
                .padding(.top, 9)
                .padding(.bottom, 3)

            content
        }
        .frame(maxWidth: .infinity)
        .frame(height: height, alignment: .top)
        .glassSurface(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .padding(.horizontal, 0)
        .gesture(
            DragGesture(minimumDistance: 18).onEnded { value in
                withAnimation(.spring(response: 0.28, dampingFraction: 0.9)) {
                    if value.translation.height < -40 {
                        level = level == .compact ? .medium : .expanded
                    } else if value.translation.height > 40 {
                        level = level == .expanded ? .medium : .compact
                    }
                }
            }
        )
        .animation(.spring(response: 0.28, dampingFraction: 0.9), value: height)
        .ignoresSafeArea(edges: .bottom)
    }
}

private struct HomeRouteList: View {
    @Bindable var appModel: AppModel
    let onSelect: (String) -> Void
    let onShowMyStop: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            AppHeader(
                title: "Shuttle Routes",
                trailingTitle: appModel.registration == nil ? nil : "My",
                trailingAction: onShowMyStop
            )

            if appModel.routeSummaries.isEmpty {
                ContentUnavailableView("No active routes are available right now.", systemImage: "map")
                    .frame(maxWidth: .infinity, minHeight: 180)
            } else {
                ScrollView {
                    AppSection(title: "Routes") {
                        ForEach(appModel.routeSummaries) { route in
                            AppRow(
                                title: route.label,
                                subtitle: "\(route.visibleStopCount) stops",
                                systemImage: "location.north.line",
                                trailingSystemImage: "chevron.right"
                            ) {
                                onSelect(route.routeCode)
                            }
                        }
                    }

                    FooterText()
                        .padding(.horizontal, 16)
                        .padding(.top, 8)
                        .padding(.bottom, 96)
                }
            }
        }
    }
}

private struct HomeRouteDetail: View {
    let route: RouteDetail
    let myStop: RouteStop?
    let selectedRouteStopId: String?
    let stopStates: [StopBoardingState]
    let onBack: () -> Void
    let onStopSelect: (String) -> Void

    private var visibleStops: [RouteStop] {
        route.stops.filter(\.isPickupEnabled)
    }

    private var totalPassengers: Int {
        stopStates.reduce(0) { $0 + $1.totalPassengers }
    }

    var body: some View {
        VStack(spacing: 0) {
            AppHeader(title: route.label, leadingTitle: "Routes", leadingAction: onBack)

            HStack(spacing: 8) {
                if !stopStates.isEmpty {
                    StatusPill(title: "In Service", systemImage: "circle.fill", color: ShuttleTheme.success)
                    Text("\(totalPassengers) boarded")
                        .font(.subheadline)
                        .foregroundStyle(ShuttleTheme.secondaryText)
                } else {
                    Text("\(visibleStops.count) stops")
                        .font(.subheadline)
                        .foregroundStyle(ShuttleTheme.secondaryText)
                }
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 12)
            .overlay(alignment: .bottom) {
                Rectangle()
                    .fill(ShuttleTheme.border)
                    .frame(height: 0.5)
            }

            ScrollView {
                RouteStepper(
                    stops: visibleStops,
                    myRouteStopId: myStop?.id,
                    selectedRouteStopId: selectedRouteStopId,
                    stopStates: stopStates,
                    onStopSelect: onStopSelect
                )
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .padding(.bottom, 96)
            }
        }
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
                                Text("Detail")
                                    .font(.caption)
                                    .foregroundStyle(ShuttleTheme.secondaryText)
                                Image(systemName: "chevron.right")
                                    .font(.caption2.weight(.semibold))
                                    .foregroundStyle(ShuttleTheme.secondaryText)
                            }

                            Text(stepDescription(stop: stop, state: state, isArrived: isArrived))
                                .font(.subheadline)
                                .foregroundStyle(ShuttleTheme.secondaryText)
                                .lineLimit(2)
                        }
                        .padding(.bottom, index < stops.count - 1 ? 18 : 4)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func stepDescription(stop: RouteStop, state: StopBoardingState?, isArrived: Bool) -> String {
        var parts: [String] = []
        if let pickupTime = stop.pickupTime {
            parts.append(pickupTime)
        }
        if let notes = stop.notes, !notes.isEmpty {
            parts.append(notes)
        }
        if let state {
            parts.append("\(isArrived ? "Arrived" : "Waiting") · \(state.totalPassengers) boarded")
        }
        return parts.isEmpty ? "Pickup time TBD" : parts.joined(separator: " · ")
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

private enum SearchViewMode: String, CaseIterable {
    case list
    case map
}

private enum StopSortMode: String, CaseIterable {
    case alphabetical
    case distance
}

private struct SearchPage: View {
    @Bindable var appModel: AppModel
    @State private var query = ""
    @State private var viewMode: SearchViewMode = .list
    @State private var sortMode: StopSortMode = .alphabetical
    @State private var currentLocation: CLLocation?
    @State private var isLocating = false
    @State private var selectedMapPlace: PlaceSummary?

    private var filteredPlaces: [PlaceSummary] {
        appModel.places.filter {
            query.isEmpty || $0.name.localizedCaseInsensitiveContains(query)
        }
    }

    private var visiblePlaces: [PlaceSummary] {
        guard sortMode == .distance, let currentLocation else { return filteredPlaces }
        return filteredPlaces.sorted {
            CLLocation(latitude: $0.lat, longitude: $0.lng).distance(from: currentLocation)
                < CLLocation(latitude: $1.lat, longitude: $1.lng).distance(from: currentLocation)
        }
    }

    var body: some View {
        ZStack {
            ShuttleTheme.background.ignoresSafeArea()

            VStack(spacing: 0) {
                SearchToolbar(
                    query: $query,
                    viewMode: $viewMode,
                    onRequestLocation: { Task { await requestLocation() } }
                )

                if viewMode == .list {
                    SegmentControl(selection: $sortMode)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .background(ShuttleTheme.surface)
                        .overlay(alignment: .bottom) {
                            Rectangle().fill(ShuttleTheme.border).frame(height: 0.5)
                        }
                }

                if viewMode == .map {
                    ZStack(alignment: .bottomTrailing) {
                        StationBrowserMap(places: filteredPlaces) { place in
                            selectedMapPlace = place
                        }

                        VStack(spacing: 8) {
                            MapControlButton(systemImage: "plus") {}
                            MapControlButton(systemImage: "minus") {}
                            MapControlButton(systemImage: "location") {
                                Task { await requestLocation() }
                            }
                        }
                        .padding(.trailing, 12)
                        .padding(.bottom, 18)
                    }
                } else {
                    ScrollView {
                        AppSection(title: "Stops") {
                            ForEach(visiblePlaces) { place in
                                NavigationLink {
                                    StopDetailPage(appModel: appModel, place: place)
                                } label: {
                                    SearchStopRow(
                                        place: place,
                                        distance: distanceText(for: place)
                                    )
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.top, 12)
                        .padding(.bottom, 96)
                    }
                    .refreshable {
                        if sortMode == .distance {
                            await requestLocation()
                        } else {
                            try? await appModel.refreshAll()
                        }
                    }
                }
            }
        }
        .navigationTitle("Search Stops")
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(item: $selectedMapPlace) { place in
            StopDetailPage(appModel: appModel, place: place)
        }
        .task {
            if sortMode == .distance, currentLocation == nil {
                await requestLocation()
            }
        }
    }

    private func distanceText(for place: PlaceSummary) -> String? {
        guard sortMode == .distance, let currentLocation else { return nil }
        let distance = CLLocation(latitude: place.lat, longitude: place.lng).distance(from: currentLocation) / 1000
        return String(format: "%.1f km", distance)
    }

    private func requestLocation() async {
        isLocating = true
        defer { isLocating = false }
        currentLocation = try? await OneShotLocationRequester().requestLocation()
    }
}

private struct SearchToolbar: View {
    @Binding var query: String
    @Binding var viewMode: SearchViewMode
    let onRequestLocation: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(ShuttleTheme.secondaryText)
                TextField("Search stops", text: $query)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            }
            .font(.body)
            .padding(.horizontal, 12)
            .frame(height: 42)
            .background(ShuttleTheme.background, in: RoundedRectangle(cornerRadius: 10, style: .continuous))

            Button {
                viewMode = viewMode == .list ? .map : .list
            } label: {
                Label(viewMode == .list ? "Map" : "List", systemImage: viewMode == .list ? "map" : "list.bullet")
                    .labelStyle(.titleAndIcon)
                    .font(.subheadline.weight(.semibold))
            }
            .buttonStyle(.plain)
            .foregroundStyle(ShuttleTheme.primary)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(ShuttleTheme.surface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(ShuttleTheme.border).frame(height: 0.5)
        }
    }
}

private struct SegmentControl: View {
    @Binding var selection: StopSortMode

    var body: some View {
        Picker("Sort", selection: $selection) {
            Text("A-Z").tag(StopSortMode.alphabetical)
            Text("Nearby").tag(StopSortMode.distance)
        }
        .pickerStyle(.segmented)
    }
}

private struct SearchStopRow: View {
    let place: PlaceSummary
    let distance: String?

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: place.isTerminal ? "bus.fill" : "mappin.circle.fill")
                .foregroundStyle(place.isTerminal ? ShuttleTheme.success : ShuttleTheme.primary)
                .frame(width: 22)
            VStack(alignment: .leading, spacing: 3) {
                Text(place.name)
                    .font(.body)
                    .foregroundStyle(ShuttleTheme.text)
                    .lineLimit(1)
                if let distance {
                    Text(distance)
                        .font(.caption)
                        .foregroundStyle(ShuttleTheme.secondaryText)
                }
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(ShuttleTheme.secondaryText)
        }
        .padding(.vertical, 2)
    }
}

private struct StopDetailPage: View {
    @Bindable var appModel: AppModel
    let place: PlaceSummary
    @Environment(\.dismiss) private var dismiss
    @State private var selectedCandidateId: String?

    private var routeCandidates: PlaceRoutesResponse? {
        appModel.routeCandidates[place.googlePlaceId]
    }

    private var sourceStop: StopCandidate? {
        routeCandidates?.sourceStop
    }

    private var selectedStop: StopCandidate? {
        guard let selectedCandidateId else { return nil }
        return routeCandidates?.matchingStops.first { $0.routeStopId == selectedCandidateId }
    }

    var body: some View {
        ZStack {
            ShuttleTheme.background.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    stopHeader

                    StopPreviewMap(stop: selectedStop ?? sourceStop)
                        .frame(height: 220)

                    if let address = sourceStop?.formattedAddress ?? sourceStop?.address {
                        Label(address, systemImage: "location")
                            .font(.subheadline)
                            .foregroundStyle(ShuttleTheme.primary)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 10)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(ShuttleTheme.surface)
                            .overlay(alignment: .bottom) {
                                Rectangle().fill(ShuttleTheme.border).frame(height: 0.5)
                            }
                    }

                    routeSelection
                        .padding(.top, 12)

                    Spacer(minLength: 148)
                }
            }
        }
        .navigationTitle("Stop Details")
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            VStack(spacing: 6) {
                Button(selectedStop == nil ? "Choose route and time." : "Register Stop") {
                    guard let selectedStop else { return }
                    Task {
                        await appModel.registerStop(
                            routeCode: selectedStop.routeCode,
                            routeStopId: selectedStop.routeStopId
                        )
                        dismiss()
                    }
                }
                .shuttleButtonStyle(prominent: true)
                .controlSize(.large)
                .disabled(selectedStop == nil)

                Button("Cancel") {
                    dismiss()
                }
                    .shuttleButtonStyle(prominent: false)
                    .controlSize(.large)
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 12)
            .glassSurface()
        }
        .task {
            await appModel.loadPlaceRoutes(googlePlaceId: place.googlePlaceId)
            selectedCandidateId = appModel.registration?.registration?.routeStop.id
        }
    }

    private var stopHeader: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(sourceStop?.name ?? place.name)
                    .font(.title2.weight(.bold))
                    .foregroundStyle(ShuttleTheme.text)
                    .lineLimit(2)
                Spacer()
                if let primaryType = sourceStop?.primaryTypeDisplayName {
                    Text(primaryType)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(ShuttleTheme.primary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .glassSurface(Capsule())
                }
                if sourceStop?.stopId != nil {
                    Text("Terminal")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(ShuttleTheme.success)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .glassSurface(Capsule())
                }
            }
            Text(sourceStop?.stopId.map { "Stop ID: \($0)" } ?? "Choose the route for this stop")
                .font(.subheadline)
                .foregroundStyle(ShuttleTheme.secondaryText)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(ShuttleTheme.surface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(ShuttleTheme.border).frame(height: 0.5)
        }
    }

    private var routeSelection: some View {
        AppSection(title: "Available routes") {
            if let candidates = routeCandidates?.matchingStops, !candidates.isEmpty {
                ForEach(candidates) { candidate in
                    Button {
                        selectedCandidateId = candidate.routeStopId
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: selectedCandidateId == candidate.routeStopId ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(selectedCandidateId == candidate.routeStopId ? ShuttleTheme.primary : ShuttleTheme.secondaryText)
                            VStack(alignment: .leading, spacing: 5) {
                                Text(candidate.routeLabel)
                                    .font(.body.weight(.semibold))
                                    .foregroundStyle(ShuttleTheme.text)
                                Text("Stop \(candidate.stopOrder)\(candidate.pickupTime.map { " · Board at \($0)" } ?? "")")
                                    .font(.subheadline)
                                    .foregroundStyle(ShuttleTheme.secondaryText)
                            }
                            Spacer()
                        }
                    }
                    .buttonStyle(.plain)
                }
            } else {
                ContentUnavailableView("No matching stop details were found.", systemImage: "bus")
                    .padding(.vertical, 24)
            }
        }
    }
}

private struct ScanPage: View {
    @Bindable var appModel: AppModel
    @State private var routeCodeInput = ""
    @State private var selectedStopId: String?
    @State private var additionalPassengers = 0
    @State private var isScannerPresented = false

    private var currentRouteCode: String? {
        let trimmed = routeCodeInput.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private var currentRunInfo: CheckInRunInfoResponse? {
        guard let currentRouteCode else { return nil }
        return appModel.runInfoByRouteCode[currentRouteCode]
    }

    private var selectedStop: RouteStop? {
        guard let selectedStopId else { return nil }
        return currentRunInfo?.route.stops.first { $0.id == selectedStopId }
    }

    var body: some View {
        ZStack {
            ShuttleTheme.background.ignoresSafeArea()

            if let response = appModel.lastCheckInResponse, selectedStop != nil {
                ResultPage(
                    status: .success,
                    title: "Welcome onboard!",
                    description: "\(response.stopState.totalPassengers) boarded",
                    primaryButtonTitle: "Home",
                    primaryAction: { routeCodeInput = "" }
                ) {
                    EmptyView()
                }
            } else if let currentRouteCode, let currentRunInfo {
                checkInConfirm(routeCode: currentRouteCode, runInfo: currentRunInfo)
            } else if currentRouteCode != nil {
                ResultPage(
                    status: .info,
                    title: "Loading run info...",
                    description: currentRouteCode ?? "",
                    primaryButtonTitle: "Load Route",
                    primaryAction: {
                        guard let currentRouteCode else { return }
                        Task { try? await appModel.loadRunInfo(routeCode: currentRouteCode) }
                    }
                ) {
                    ProgressView()
                        .padding(.vertical, 24)
                }
            } else {
                scannerStart
            }
        }
        .navigationTitle("QR Check-in")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $isScannerPresented) {
            QRScannerSheet { payload in
                if let routeCode = appModel.parseRouteCode(from: payload) {
                    routeCodeInput = routeCode
                    Task { try? await appModel.loadRunInfo(routeCode: routeCode) }
                }
                isScannerPresented = false
            }
        }
        .onChange(of: currentRunInfo?.route.stops.map(\.id) ?? []) { _, ids in
            if selectedStopId == nil {
                selectedStopId = appModel.registration?.registration?.routeStop.id ?? ids.first
            }
        }
    }

    private var scannerStart: some View {
        VStack(spacing: 22) {
            Spacer()
            Image(systemName: "qrcode.viewfinder")
                .font(.system(size: 78, weight: .semibold))
                .foregroundStyle(ShuttleTheme.primary)
            Text("QR Check-in")
                .font(.largeTitle.weight(.bold))
            Text("Tap the button below to scan the shuttle bus QR code and check in.")
                .font(.body)
                .foregroundStyle(ShuttleTheme.secondaryText)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 28)

            VStack(spacing: 12) {
                Button("QR Scan") {
                    isScannerPresented = true
                }
                .shuttleButtonStyle(prominent: true)
                .controlSize(.large)

                TextField("Paste route code or QR URL", text: $routeCodeInput)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .padding(14)
                    .background(ShuttleTheme.surface, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .stroke(ShuttleTheme.border, lineWidth: 1)
                    }

                Button("Load Route") {
                    guard let currentRouteCode else { return }
                    Task { try? await appModel.loadRunInfo(routeCode: currentRouteCode) }
                }
                .shuttleButtonStyle(prominent: false)
                .controlSize(.large)
            }
            .padding(.horizontal, 24)
            Spacer()
        }
    }

    private func checkInConfirm(routeCode: String, runInfo: CheckInRunInfoResponse) -> some View {
        ResultPage(
            status: .info,
            title: "Ready to board?",
            description: runInfo.route.label,
            primaryButtonTitle: "Check In",
            primaryAction: {
                guard let selectedStopId else { return }
                Task {
                    await appModel.checkIn(
                        routeCode: routeCode,
                        routeStopId: selectedStopId,
                        additionalPassengers: additionalPassengers
                    )
                }
            },
            secondaryButtonTitle: "Scan Again",
            secondaryAction: {
                routeCodeInput = ""
                selectedStopId = nil
                additionalPassengers = 0
            }
        ) {
            AppSection(title: "Check-in") {
                AppInfoRow(label: "Route", value: runInfo.route.label)

                Menu {
                    ForEach(runInfo.route.stops.filter(\.isPickupEnabled)) { stop in
                        Button(stop.place.displayName ?? stop.place.name) {
                            selectedStopId = stop.id
                        }
                    }
                } label: {
                    HStack {
                        Text("Stop")
                            .foregroundStyle(ShuttleTheme.text)
                        Spacer()
                        Text(selectedStop.map { $0.place.displayName ?? $0.place.name } ?? "Choose stop")
                            .foregroundStyle(ShuttleTheme.secondaryText)
                            .lineLimit(1)
                        Image(systemName: "chevron.up.chevron.down")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(ShuttleTheme.secondaryText)
                    }
                }
                .buttonStyle(.plain)

                Stepper(value: $additionalPassengers, in: 0 ... 9) {
                    HStack {
                        Text("Passengers")
                        Spacer()
                        Text("\(additionalPassengers)")
                            .foregroundStyle(ShuttleTheme.secondaryText)
                    }
                }
            }
        }
    }
}

private enum ResultStatus {
    case info
    case success
    case error

    var systemImage: String {
        switch self {
        case .info: "qrcode.viewfinder"
        case .success: "checkmark.circle.fill"
        case .error: "xmark.circle.fill"
        }
    }

    var color: Color {
        switch self {
        case .info: ShuttleTheme.primary
        case .success: ShuttleTheme.success
        case .error: ShuttleTheme.danger
        }
    }
}

private struct ResultPage<Content: View>: View {
    let status: ResultStatus
    let title: String
    let description: String
    let primaryButtonTitle: String
    let primaryAction: () -> Void
    var secondaryButtonTitle: String?
    var secondaryAction: (() -> Void)?
    @ViewBuilder var content: Content

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                Image(systemName: status.systemImage)
                    .font(.system(size: 66, weight: .semibold))
                    .foregroundStyle(status.color)
                    .padding(.top, 56)

                Text(title)
                    .font(.largeTitle.weight(.bold))
                    .multilineTextAlignment(.center)

                Text(description)
                    .font(.body)
                    .foregroundStyle(ShuttleTheme.secondaryText)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 18)

                content
                    .padding(.top, 12)

                Button(primaryButtonTitle, action: primaryAction)
                    .shuttleButtonStyle(prominent: true)
                    .controlSize(.large)
                    .padding(.top, 8)

                if let secondaryButtonTitle, let secondaryAction {
                    Button(secondaryButtonTitle, action: secondaryAction)
                        .shuttleButtonStyle(prominent: false)
                        .controlSize(.large)
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 96)
        }
    }
}

private struct NotificationsPage: View {
    @Bindable var appModel: AppModel

    private var unreadCount: Int {
        appModel.notifications.filter { !$0.isRead }.count
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Text("Notifications")
                    .font(.headline)
                if unreadCount > 0 {
                    Text("\(unreadCount)")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 7)
                        .frame(minHeight: 20)
                        .background(ShuttleTheme.primary, in: Capsule())
                }
                Spacer()
                if unreadCount > 0 {
                    Button("Mark all read") {
                        Task { await appModel.markAllNotificationsRead() }
                    }
                    .font(.subheadline.weight(.semibold))
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(ShuttleTheme.surface)
            .overlay(alignment: .bottom) {
                Rectangle().fill(ShuttleTheme.border).frame(height: 0.5)
            }

            if appModel.notifications.isEmpty {
                ContentUnavailableView("No notifications yet.", systemImage: "bell.slash")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(ShuttleTheme.background)
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(appModel.notifications) { notification in
                            Button {
                                if !notification.isRead {
                                    Task { await appModel.markNotificationRead(notification) }
                                }
                            } label: {
                                NotificationRow(notification: notification, language: appModel.preferredLanguage)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .background(ShuttleTheme.surface)
                    .padding(.bottom, 96)
                }
                .background(ShuttleTheme.background)
                .refreshable {
                    await appModel.reloadNotifications()
                }
            }
        }
        .navigationBarHidden(true)
    }
}

private struct NotificationRow: View {
    let notification: AppNotification
    let language: AppLanguage

    var body: some View {
        HStack(spacing: 0) {
            Rectangle()
                .fill(notification.isRead ? Color.clear : ShuttleTheme.primary)
                .frame(width: 3)

            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .firstTextBaseline) {
                    Text(notification.title(for: language))
                        .font(.body.weight(notification.isRead ? .regular : .semibold))
                        .foregroundStyle(notification.isRead ? ShuttleTheme.secondaryText : ShuttleTheme.text)
                        .lineLimit(2)
                    Spacer()
                    Text(relativeTime(notification.createdAt, language: language))
                        .font(.caption2)
                        .foregroundStyle(ShuttleTheme.secondaryText)
                }
                Text(notification.body(for: language))
                    .font(.subheadline)
                    .foregroundStyle(ShuttleTheme.secondaryText)
                    .lineLimit(3)
            }
            .padding(.horizontal, 13)
            .padding(.vertical, 12)
        }
        .overlay(alignment: .bottom) {
            Rectangle().fill(ShuttleTheme.border).frame(height: 0.5)
        }
    }

    private func relativeTime(_ value: String, language: AppLanguage) -> String {
        guard let date = Self.notificationDate(from: value) else { return value }
        let seconds = max(0, Int(Date().timeIntervalSince(date)))
        let minutes = seconds / 60
        let hours = minutes / 60
        let days = hours / 24

        if language == .ko {
            if minutes < 1 { return "방금 전" }
            if minutes < 60 { return "\(minutes)분 전" }
            if hours < 24 { return "\(hours)시간 전" }
            return "\(days)일 전"
        }

        if minutes < 1 { return "Just now" }
        if minutes < 60 { return "\(minutes)m ago" }
        if hours < 24 { return "\(hours)h ago" }
        return "\(days)d ago"
    }

    private static func notificationDate(from value: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: value) {
            return date
        }

        let standard = ISO8601DateFormatter()
        standard.formatOptions = [.withInternetDateTime]
        return standard.date(from: value)
    }
}

private struct SettingsPage: View {
    @Bindable var appModel: AppModel

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                AppSection(title: "Profile") {
                    AppRow(
                        title: appModel.currentUser?.displayName ?? "Unknown user",
                        subtitle: appModel.currentUser?.email,
                        systemImage: "person.crop.circle.fill",
                        trailingTitle: "Refresh"
                    ) {
                        Task { try? await appModel.refreshAll() }
                    }
                    AppInfoRow(label: "User ID", value: appModel.currentUser?.providerUid ?? "No LINE profile")
                }

                AppSection(title: "Route") {
                    AppInfoRow(label: "Current Route", value: appModel.registration?.registration?.route.label ?? "No route selected yet")
                    AppInfoRow(
                        label: "Current Stop",
                        value: appModel.registration?.registration.map { $0.routeStop.place.displayName ?? $0.routeStop.place.name } ?? "-"
                    )
                }

                AppSection(title: "Preferences") {
                    Picker("Language", selection: Binding(
                        get: { appModel.preferredLanguage },
                        set: { newValue in
                            Task { await appModel.updatePreferences(preferredLanguage: newValue) }
                        }
                    )) {
                        ForEach(AppLanguage.allCases, id: \.self) { language in
                            Text(language.label).tag(language)
                        }
                    }

                    Toggle(
                        "Push Notifications",
                        isOn: Binding(
                            get: { appModel.currentUser?.pushNotificationsEnabled ?? false },
                            set: { newValue in
                                Task { await appModel.updatePreferences(pushNotificationsEnabled: newValue) }
                            }
                        )
                    )

                    AppInfoRow(label: "Dark Mode", value: "Follows iOS")
                }

                if appModel.isAdminSurfaceEnabled {
                    AppSection(title: "Developer") {
                        AppInfoRow(label: "Role", value: appModel.currentUser?.role.rawValue ?? "unknown")
                    }
                }

                Button("Log Out", role: .destructive) {
                    Task { await appModel.logout() }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)

                Spacer(minLength: 96)
            }
            .padding(.top, 12)
        }
        .background(ShuttleTheme.background)
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct AdminPlaceholderView: View {
    @Bindable var appModel: AppModel

    var body: some View {
        ScrollView {
            AppSection(title: "Admin") {
                AppRow(title: "Run start / end", subtitle: "Manage active boarding.", systemImage: "playpause.fill")
                AppRow(title: "Stop override", subtitle: "Monitor live passenger counts.", systemImage: "slider.horizontal.3")
                AppRow(title: "Schedules and users", subtitle: "Use the web admin for full controls.", systemImage: "list.bullet.rectangle.portrait")
                AppInfoRow(label: "Role", value: appModel.currentUser?.role.rawValue ?? "unknown")
            }
            .padding(.top, 12)
            .padding(.bottom, 96)
        }
        .background(ShuttleTheme.background)
        .navigationTitle("Admin")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct AppHeader: View {
    let title: String
    var leadingTitle: String?
    var leadingAction: (() -> Void)?
    var trailingTitle: String?
    var trailingAction: (() -> Void)?

    var body: some View {
        HStack {
            if let leadingTitle, let leadingAction {
                Button(leadingTitle, action: leadingAction)
                    .font(.body.weight(.semibold))
            } else {
                Color.clear.frame(width: 44, height: 1)
            }

            Spacer()

            Text(title)
                .font(.headline)
                .lineLimit(1)

            Spacer()

            if let trailingTitle, let trailingAction {
                Button(trailingTitle, action: trailingAction)
                    .font(.body.weight(.semibold))
            } else {
                Color.clear.frame(width: 44, height: 1)
            }
        }
        .padding(.horizontal, 12)
        .frame(height: 48)
    }
}

private struct AppSection<Content: View>: View {
    let title: String
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(ShuttleTheme.secondaryText)
                .textCase(.uppercase)
                .padding(.horizontal, 16)

            VStack(spacing: 0) {
                content
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(ShuttleTheme.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(ShuttleTheme.border, lineWidth: 0.5)
            }
        }
        .padding(.horizontal, 12)
    }
}

private struct AppRow: View {
    let title: String
    var subtitle: String?
    var systemImage: String?
    var trailingTitle: String?
    var trailingSystemImage: String?
    var action: (() -> Void)?

    var body: some View {
        Button {
            action?()
        } label: {
            HStack(spacing: 12) {
                if let systemImage {
                    Image(systemName: systemImage)
                        .foregroundStyle(ShuttleTheme.primary)
                        .frame(width: 22)
                }

                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(.body)
                        .foregroundStyle(ShuttleTheme.text)
                        .lineLimit(1)
                    if let subtitle {
                        Text(subtitle)
                            .font(.subheadline)
                            .foregroundStyle(ShuttleTheme.secondaryText)
                            .lineLimit(2)
                    }
                }

                Spacer()

                if let trailingTitle {
                    Text(trailingTitle)
                        .font(.subheadline)
                        .foregroundStyle(ShuttleTheme.secondaryText)
                        .lineLimit(1)
                }
                if let trailingSystemImage {
                    Image(systemName: trailingSystemImage)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(ShuttleTheme.secondaryText)
                }
            }
            .contentShape(Rectangle())
            .padding(.vertical, 8)
        }
        .buttonStyle(.plain)
        .disabled(action == nil)
    }
}

private struct AppInfoRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label)
                .foregroundStyle(ShuttleTheme.text)
            Spacer()
            Text(value)
                .foregroundStyle(ShuttleTheme.secondaryText)
                .multilineTextAlignment(.trailing)
                .lineLimit(2)
        }
        .font(.body)
        .padding(.vertical, 8)
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

private struct MapControlButton: View {
    let systemImage: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 18, weight: .semibold))
                .frame(width: 38, height: 38)
        }
        .buttonStyle(.plain)
        .foregroundStyle(ShuttleTheme.text)
        .glassSurface(RoundedRectangle(cornerRadius: 8, style: .continuous))
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

private struct ViewControllerResolver: UIViewControllerRepresentable {
    let onResolve: (UIViewController) -> Void

    func makeUIViewController(context: Context) -> ResolverViewController {
        ResolverViewController(onResolve: onResolve)
    }

    func updateUIViewController(_ uiViewController: ResolverViewController, context: Context) {}

    final class ResolverViewController: UIViewController {
        private let onResolve: (UIViewController) -> Void

        init(onResolve: @escaping (UIViewController) -> Void) {
            self.onResolve = onResolve
            super.init(nibName: nil, bundle: nil)
        }

        @available(*, unavailable)
        required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }

        override func viewDidAppear(_ animated: Bool) {
            super.viewDidAppear(animated)
            onResolve(self)
        }
    }
}

private struct QRScannerSheet: View {
    let onScan: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var manualPayload = ""

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                #if canImport(VisionKit)
                if DataScannerViewController.isSupported && DataScannerViewController.isAvailable {
                    NativeQRScannerView { payload in
                        onScan(payload)
                    }
                    .frame(maxWidth: .infinity, maxHeight: 320)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                #endif

                TextField("Fallback manual QR payload", text: $manualPayload)
                    .textFieldStyle(.roundedBorder)

                Button("Use Manual Payload") {
                    onScan(manualPayload)
                }
                .shuttleButtonStyle(prominent: true)

                Spacer()
            }
            .padding()
            .navigationTitle("QR Scanner")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Close") {
                        dismiss()
                    }
                }
            }
        }
    }
}

#if canImport(VisionKit)
private struct NativeQRScannerView: UIViewControllerRepresentable {
    let onScan: (String) -> Void

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let scanner = DataScannerViewController(
            recognizedDataTypes: [.barcode(symbologies: [.qr])],
            qualityLevel: .balanced,
            recognizesMultipleItems: false,
            isHighFrameRateTrackingEnabled: false,
            isHighlightingEnabled: true
        )
        scanner.delegate = context.coordinator
        try? scanner.startScanning()
        return scanner
    }

    func updateUIViewController(_ uiViewController: DataScannerViewController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(onScan: onScan)
    }

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        let onScan: (String) -> Void

        init(onScan: @escaping (String) -> Void) {
            self.onScan = onScan
        }

        func dataScanner(
            _ dataScanner: DataScannerViewController,
            didAdd addedItems: [RecognizedItem],
            allItems: [RecognizedItem]
        ) {
            guard let first = addedItems.first else { return }
            emitPayload(from: first)
        }

        func dataScanner(
            _ dataScanner: DataScannerViewController,
            didTapOn item: RecognizedItem
        ) {
            emitPayload(from: item)
        }

        private func emitPayload(from item: RecognizedItem) {
            guard case let .barcode(barcode) = item, let payload = barcode.payloadStringValue else { return }
            onScan(payload)
        }
    }
}
#endif

private enum ShuttleTheme {
    static let primary = Color.dynamic(light: 0x1f6feb, dark: 0x58a6ff)
    static let success = Color.dynamic(light: 0x1a7f37, dark: 0x3fb950)
    static let danger = Color.dynamic(light: 0xcf222e, dark: 0xf85149)
    static let text = Color.dynamic(light: 0x1f2328, dark: 0xf0f6fc)
    static let secondaryText = Color.dynamic(light: 0x6e7781, dark: 0x8b949e)
    static let background = Color.dynamic(light: 0xf6f8fa, dark: 0x0d1117)
    static let surface = Color.dynamic(light: 0xffffff, dark: 0x161b22)
    static let border = Color.dynamic(light: 0xd0d7de, dark: 0x30363d)
}

private extension Color {
    static func dynamic(light: UInt32, dark: UInt32) -> Color {
        Color(UIColor { trait in
            let value = trait.userInterfaceStyle == .dark ? dark : light
            return UIColor(
                red: CGFloat((value >> 16) & 0xff) / 255,
                green: CGFloat((value >> 8) & 0xff) / 255,
                blue: CGFloat(value & 0xff) / 255,
                alpha: 1
            )
        })
    }
}

private extension View {
    @ViewBuilder
    func glassSurface<S: Shape>(_ shape: S) -> some View {
        if #available(iOS 26.0, *) {
            self.glassEffect(.regular, in: shape)
        } else {
            self.background(.regularMaterial, in: shape)
        }
    }

    func glassSurface() -> some View {
        glassSurface(Rectangle())
    }

    @ViewBuilder
    func shuttleButtonStyle(prominent: Bool) -> some View {
        if #available(iOS 26.0, *) {
            if prominent {
                self.buttonStyle(.glassProminent)
            } else {
                self.buttonStyle(.glass)
            }
        } else {
            if prominent {
                self.buttonStyle(.borderedProminent)
            } else {
                self.buttonStyle(.bordered)
            }
        }
    }
}

private extension AppModel {
    func loadPlaceRoutesIfNeeded(_ googlePlaceId: String) {
        Task {
            await loadPlaceRoutes(googlePlaceId: googlePlaceId)
        }
    }
}

#Preview("Logged Out") {
    RootView(appModel: AppModel(mode: .previewLoggedOut))
}

#Preview("Logged In") {
    RootView(appModel: AppModel(mode: .previewLoggedIn))
}
