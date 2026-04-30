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
                ProgressView("Loading…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if appModel.isAuthenticated {
                RiderShellView(appModel: appModel)
            } else {
                LoginView(appModel: appModel)
            }
        }
        .background(Color(.systemGroupedBackground))
    }
}

private struct LoginView: View {
    @Bindable var appModel: AppModel
    @State private var presentingViewController: UIViewController?
    @State private var isEmailLoginPresented = false

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            Image(systemName: "bus.doubledecker.fill")
                .font(.system(size: 60))
                .foregroundStyle(.green)

            Text(AppConfiguration.appName)
                .font(.largeTitle.weight(.bold))

            Text("LINE 네이티브 로그인으로 서버 세션을 발급받고, 이후 모든 API는 앱 전용 JWT로 호출합니다.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 32)

            Button {
                Task {
                    await appModel.signIn(presentingViewController: presentingViewController)
                }
            } label: {
                HStack {
                    if appModel.isAuthenticating {
                        ProgressView()
                            .progressViewStyle(.circular)
                    }
                    Text(appModel.isAuthenticating ? "Signing In…" : "Continue with LINE")
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(.green)
            .controlSize(.large)
            .padding(.horizontal, 32)

            Button {
                isEmailLoginPresented = true
            } label: {
                Label("Continue with Email", systemImage: "envelope.fill")
                    .fontWeight(.semibold)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .controlSize(.large)
            .padding(.horizontal, 32)
            .disabled(appModel.isAuthenticating)

            VStack(alignment: .leading, spacing: 8) {
                Label("Xcode Preview works from this native project.", systemImage: "eye")
                Label("API base URL: \(AppConfiguration.apiBaseURL?.absoluteString ?? "missing")", systemImage: "network")
                Label("Auth mode: \(AppConfiguration.authMode)", systemImage: "lock.shield")
                Label("LINE channel: \(AppConfiguration.lineChannelID ?? "missing")", systemImage: "link")
                Label(
                    "LINE app available on this device: \(AppConfiguration.isLineAppAvailable ? "yes" : "no")",
                    systemImage: AppConfiguration.isLineAppAvailable ? "checkmark.circle" : "xmark.circle"
                )
            }
            .font(.footnote)
            .foregroundStyle(.secondary)
            .padding(20)
            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
            .padding(.horizontal, 24)

            Spacer()
        }
        .background {
            ViewControllerResolver { presentingViewController = $0 }
                .allowsHitTesting(false)
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
                    Button(appModel.isAuthenticating ? "Signing In…" : "Sign In") {
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

private struct RiderShellView: View {
    @Bindable var appModel: AppModel
    private var unreadBadge: Int? {
        appModel.unreadCount > 0 ? appModel.unreadCount : nil
    }

    var body: some View {
        TabView {
            NavigationStack {
                HomeView(appModel: appModel)
            }
            .tabItem {
                Label("Home", systemImage: "house.fill")
            }

            NavigationStack {
                SearchStopsView(appModel: appModel)
            }
            .tabItem {
                Label("Stops", systemImage: "magnifyingglass")
            }

            NavigationStack {
                ScanView(appModel: appModel)
            }
            .tabItem {
                Label("Scan", systemImage: "qrcode.viewfinder")
            }

            if let unreadBadge {
                NavigationStack {
                    NotificationsView(appModel: appModel)
                }
                .badge(unreadBadge)
                .tabItem {
                    Label("Alerts", systemImage: "bell.fill")
                }
            } else {
                NavigationStack {
                    NotificationsView(appModel: appModel)
                }
                .tabItem {
                    Label("Alerts", systemImage: "bell.fill")
                }
            }

            NavigationStack {
                SettingsView(appModel: appModel)
            }
            .tabItem {
                Label("Settings", systemImage: "gearshape.fill")
            }

            if appModel.isAdminSurfaceEnabled {
                NavigationStack {
                    AdminPlaceholderView(appModel: appModel)
                }
                .tabItem {
                    Label("Admin", systemImage: "person.2.crop.square.stack.fill")
                }
            }
        }
    }
}

private struct HomeView: View {
    @Bindable var appModel: AppModel

    var selectedRouteDetail: RouteDetail? {
        guard let routeCode = appModel.selectedRouteCode else { return nil }
        return appModel.routeDetails[routeCode]
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                routePickerCard

                RouteMapCard(
                    route: selectedRouteDetail,
                    selectedStopId: appModel.registration?.registration?.routeStop.id,
                    activeStates: appModel.runInfoByRouteCode[appModel.selectedRouteCode ?? ""]?.stopStates ?? []
                )

                registrationCard
                stopsCard
            }
            .padding(20)
        }
        .navigationTitle("Shuttle")
        .refreshable {
            try? await appModel.refreshAll()
        }
    }

    private var routePickerCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Current Route")
                .font(.headline)

            if appModel.routeSummaries.isEmpty {
                ContentUnavailableView("No routes", systemImage: "map")
            } else {
                Picker("Route", selection: Binding(
                    get: { appModel.selectedRouteCode ?? appModel.routeSummaries.first?.routeCode ?? "" },
                    set: { nextValue in
                        Task { await appModel.selectRoute(routeCode: nextValue) }
                    }
                )) {
                    ForEach(appModel.routeSummaries) { route in
                        Text(route.label).tag(route.routeCode)
                    }
                }
                .pickerStyle(.menu)
            }
        }
        .cardStyle()
    }

    private var registrationCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("My Stop")
                .font(.headline)

            if let registration = appModel.registration?.registration {
                Text(registration.routeStop.place.displayName ?? registration.routeStop.place.name)
                    .font(.title3.weight(.semibold))
                Text(registration.route.label)
                    .foregroundStyle(.secondary)
                if let pickupTime = registration.routeStop.pickupTime {
                    Label(pickupTime, systemImage: "clock")
                        .foregroundStyle(.secondary)
                }

                Button("Remove Registration", role: .destructive) {
                    Task { await appModel.removeRegistration() }
                }
                .buttonStyle(.bordered)
            } else {
                ContentUnavailableView("No stop selected", systemImage: "mappin.and.ellipse")
            }
        }
        .cardStyle()
    }

    private var stopsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Stops")
                .font(.headline)

            if let route = selectedRouteDetail {
                ForEach(route.stops) { stop in
                    HStack(alignment: .top, spacing: 12) {
                        Circle()
                            .fill(stop.id == appModel.registration?.registration?.routeStop.id ? Color.green : Color.secondary.opacity(0.3))
                            .frame(width: 10, height: 10)
                            .padding(.top, 7)

                        VStack(alignment: .leading, spacing: 4) {
                            Text(stop.place.displayName ?? stop.place.name)
                                .fontWeight(.medium)
                            Text(stop.pickupTime ?? "Pickup time TBD")
                                .foregroundStyle(.secondary)
                            if let state = appModel.runInfoByRouteCode[route.routeCode]?.stopStates.first(where: { $0.routeStopId == stop.id }) {
                                Text("Passengers: \(state.totalPassengers)")
                                    .font(.caption)
                                    .foregroundStyle(.orange)
                            }
                        }

                        Spacer()
                    }
                }
            } else {
                ContentUnavailableView("Choose a route", systemImage: "list.bullet")
            }
        }
        .cardStyle()
    }
}

private struct SearchStopsView: View {
    @Bindable var appModel: AppModel
    @State private var query = ""
    @State private var sortByDistance = false
    @State private var currentLocation: CLLocation?
    @State private var isLocating = false

    private var visiblePlaces: [PlaceSummary] {
        let filtered = appModel.places.filter {
            query.isEmpty ||
            $0.name.localizedCaseInsensitiveContains(query)
        }

        guard sortByDistance, let currentLocation else { return filtered }
        return filtered.sorted {
            CLLocation(latitude: $0.lat, longitude: $0.lng).distance(from: currentLocation)
                < CLLocation(latitude: $1.lat, longitude: $1.lng).distance(from: currentLocation)
        }
    }

    var body: some View {
        List {
            Section {
                TextField("Search stops", text: $query)

                Toggle("Sort by my location", isOn: $sortByDistance)
                    .onChange(of: sortByDistance) { _, enabled in
                        guard enabled else { return }
                        Task { await requestLocation() }
                    }

                if isLocating {
                    ProgressView("Getting current location…")
                }
            }

            Section("Stops") {
                ForEach(visiblePlaces) { place in
                    NavigationLink {
                        StopDetailView(appModel: appModel, place: place)
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(place.name)
                            if sortByDistance, let currentLocation {
                                let distance = CLLocation(latitude: place.lat, longitude: place.lng).distance(from: currentLocation) / 1000
                                Text(String(format: "%.1f km away", distance))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Stops")
        .refreshable {
            try? await appModel.refreshAll()
        }
    }

    private func requestLocation() async {
        isLocating = true
        defer { isLocating = false }
        currentLocation = try? await OneShotLocationRequester().requestLocation()
    }
}

private struct StopDetailView: View {
    @Bindable var appModel: AppModel
    let place: PlaceSummary

    @State private var selectedCandidateId: String?

    var routeCandidates: PlaceRoutesResponse? {
        appModel.routeCandidates[place.googlePlaceId]
    }

    var body: some View {
        List {
            Section {
                SingleStopMapCard(title: place.name, coordinate: (place.lat, place.lng))
                    .listRowInsets(.init())
                    .listRowBackground(Color.clear)

                VStack(alignment: .leading, spacing: 6) {
                    Text(place.name)
                        .font(.title3.weight(.semibold))
                    Text("Google Place ID: \(place.googlePlaceId)")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 8)
            }

            Section("Available Routes") {
                if let candidates = routeCandidates?.matchingStops, !candidates.isEmpty {
                    ForEach(candidates) { candidate in
                        Button {
                            selectedCandidateId = candidate.routeStopId
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(candidate.routeLabel)
                                        .fontWeight(.medium)
                                    Text(candidate.pickupTime ?? "Pickup time TBD")
                                        .foregroundStyle(.secondary)
                                }

                                Spacer()

                                if selectedCandidateId == candidate.routeStopId {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(.green)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                } else {
                    ContentUnavailableView("No routes found", systemImage: "bus")
                }
            }
        }
        .navigationTitle(place.name)
        .safeAreaInset(edge: .bottom) {
            Button("Save Stop") {
                guard
                    let selectedCandidateId,
                    let candidate = routeCandidates?.matchingStops.first(where: { $0.routeStopId == selectedCandidateId })
                else {
                    return
                }

                Task {
                    await appModel.registerStop(routeCode: candidate.routeCode, routeStopId: selectedCandidateId)
                }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .padding()
            .background(.regularMaterial)
        }
        .task {
            await appModel.loadPlaceRoutes(googlePlaceId: place.googlePlaceId)
            selectedCandidateId = appModel.registration?.registration?.routeStop.id
        }
    }
}

private struct ScanView: View {
    @Bindable var appModel: AppModel
    @State private var routeCodeInput = ""
    @State private var selectedStopId: String?
    @State private var additionalPassengers = 0
    @State private var isScannerPresented = false

    var currentRouteCode: String? {
        let trimmed = routeCodeInput.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    var currentRunInfo: CheckInRunInfoResponse? {
        guard let currentRouteCode else { return nil }
        return appModel.runInfoByRouteCode[currentRouteCode]
    }

    var body: some View {
        List {
            Section("Route QR") {
                TextField("Paste route code or QR URL", text: $routeCodeInput)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()

                Button("Open Native QR Scanner") {
                    isScannerPresented = true
                }

                Button("Load Route") {
                    guard let routeCode = currentRouteCode else { return }
                    Task {
                        try? await appModel.loadRunInfo(routeCode: routeCode)
                    }
                }
            }

            if let currentRunInfo {
                Section("Run") {
                    Text(currentRunInfo.route.label)
                    Text("Status: \(currentRunInfo.run.status)")
                        .foregroundStyle(.secondary)
                }

                Section("Choose Stop") {
                    ForEach(currentRunInfo.route.stops) { stop in
                        Button {
                            selectedStopId = stop.id
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(stop.place.displayName ?? stop.place.name)
                                    Text(stop.pickupTime ?? "Pickup time TBD")
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                if selectedStopId == stop.id {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(.green)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }

                Section("Additional Passengers") {
                    Stepper(value: $additionalPassengers, in: 0 ... 9) {
                        Text("\(additionalPassengers)")
                    }
                }

                if let response = appModel.lastCheckInResponse {
                    Section("Latest Result") {
                        Text("Check-in ID: \(response.checkinId)")
                        Text("Passengers at stop: \(response.stopState.totalPassengers)")
                    }
                }
            }
        }
        .navigationTitle("Check-In")
        .sheet(isPresented: $isScannerPresented) {
            QRScannerSheet { payload in
                if let routeCode = appModel.parseRouteCode(from: payload) {
                    routeCodeInput = routeCode
                    Task {
                        try? await appModel.loadRunInfo(routeCode: routeCode)
                    }
                }
                isScannerPresented = false
            }
        }
        .safeAreaInset(edge: .bottom) {
            Button("Complete Check-In") {
                guard let routeCode = currentRouteCode, let selectedStopId else { return }
                Task {
                    await appModel.checkIn(routeCode: routeCode, routeStopId: selectedStopId, additionalPassengers: additionalPassengers)
                }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(selectedStopId == nil || currentRouteCode == nil)
            .padding()
            .background(.regularMaterial)
        }
    }
}

private struct NotificationsView: View {
    @Bindable var appModel: AppModel

    var body: some View {
        List {
            if appModel.notifications.isEmpty {
                ContentUnavailableView("No notifications yet", systemImage: "bell.slash")
                    .listRowBackground(Color.clear)
            } else {
                ForEach(appModel.notifications) { notification in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(notification.title(for: appModel.preferredLanguage))
                                .font(.headline)
                            Spacer()
                            if !notification.isRead {
                                Circle()
                                    .fill(.green)
                                    .frame(width: 8, height: 8)
                            }
                        }

                        Text(notification.body(for: appModel.preferredLanguage))
                            .foregroundStyle(.secondary)

                        HStack {
                            Text(notification.createdAt)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Spacer()
                            if !notification.isRead {
                                Button("Mark Read") {
                                    Task { await appModel.markNotificationRead(notification) }
                                }
                                .buttonStyle(.bordered)
                            }
                        }
                    }
                    .padding(.vertical, 6)
                }
            }
        }
        .navigationTitle("Alerts")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Read All") {
                    Task { await appModel.markAllNotificationsRead() }
                }
                .disabled(appModel.notifications.allSatisfy(\.isRead))
            }
        }
        .refreshable {
            await appModel.reloadNotifications()
        }
    }
}

private struct SettingsView: View {
    @Bindable var appModel: AppModel

    var body: some View {
        List {
            Section("Profile") {
                Text(appModel.currentUser?.displayName ?? "Unknown user")
                    .font(.headline)
                if let email = appModel.currentUser?.email {
                    Text(email)
                        .foregroundStyle(.secondary)
                }
                Text(appModel.currentUser?.providerUid ?? "No LINE profile")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Section("Preferences") {
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
                    "Push notifications",
                    isOn: Binding(
                        get: { appModel.currentUser?.pushNotificationsEnabled ?? false },
                        set: { newValue in
                            Task { await appModel.updatePreferences(pushNotificationsEnabled: newValue) }
                        }
                    )
                )

                Label(
                    appModel.pushManager.authorizationStatus == .authorized ? "APNS authorized" : "APNS not authorized",
                    systemImage: appModel.pushManager.authorizationStatus == .authorized ? "checkmark.shield.fill" : "shield.slash"
                )
            }

            Section("Session") {
                Button("Refresh Data") {
                    Task { try? await appModel.refreshAll() }
                }
                Button("Log Out", role: .destructive) {
                    Task { await appModel.logout() }
                }
            }
        }
        .navigationTitle("Settings")
    }
}

private struct AdminPlaceholderView: View {
    @Bindable var appModel: AppModel

    var body: some View {
        List {
            Section("Phase 2") {
                Label("Run start / end", systemImage: "playpause.fill")
                Label("Stop override and live passenger counts", systemImage: "slider.horizontal.3")
                Label("Schedules, routes, registrations, and users", systemImage: "list.bullet.rectangle.portrait")
            }

            Section("Current Session") {
                Text("Role: \(appModel.currentUser?.role.rawValue ?? "unknown")")
                Text("This app shell already reserves a dedicated admin surface in the same target.")
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Admin")
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

private extension View {
    func cardStyle() -> some View {
        padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.background, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
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
                    .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                }
                #endif

                TextField("Fallback manual QR payload", text: $manualPayload)
                    .textFieldStyle(.roundedBorder)

                Button("Use Manual Payload") {
                    onScan(manualPayload)
                }
                .buttonStyle(.borderedProminent)

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

#Preview("Logged Out") {
    RootView(appModel: AppModel(mode: .previewLoggedOut))
}

#Preview("Logged In") {
    RootView(appModel: AppModel(mode: .previewLoggedIn))
}
