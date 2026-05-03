import CoreImage.CIFilterBuiltins
import Observation
import SwiftUI
import UIKit

private func adminCopy(_ language: AppLanguage, _ en: String, _ ko: String) -> String {
    language == .ko ? ko : en
}

private struct AdminFeedbackBanner: View {
    let message: AdminFeedbackMessage
    let dismiss: () -> Void

    private var tint: Color {
        switch message.style {
        case .success:
            return ShuttleTheme.success
        case .error:
            return ShuttleTheme.danger
        case .info:
            return ShuttleTheme.primary
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Circle()
                .fill(tint)
                .frame(width: 10, height: 10)
                .padding(.top, 6)

            VStack(alignment: .leading, spacing: 3) {
                Text(message.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(ShuttleTheme.text)
                    .fixedSize(horizontal: false, vertical: true)

                if let body = message.body {
                    Text(body)
                        .font(.footnote)
                        .foregroundStyle(ShuttleTheme.secondaryText)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            Spacer(minLength: 8)

            if message.duration == nil || message.style == .error {
                Button(action: dismiss) {
                    Image(systemName: "xmark")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(ShuttleTheme.secondaryText)
                        .frame(width: 24, height: 24)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(ShuttleTheme.surface.opacity(0.96), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .glassSurface(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(tint.opacity(0.28), lineWidth: 1)
        }
        .shadow(color: .black.opacity(0.12), radius: 18, x: 0, y: 10)
    }
}

private struct AdminFeedbackOverlay: ViewModifier {
    @Bindable var store: AdminStore

    func body(content: Content) -> some View {
        content
            .overlay(alignment: .bottom) {
                if let message = store.feedbackMessage {
                    AdminFeedbackBanner(message: message) {
                        store.clearFeedback()
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 14)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
    }
}

private extension View {
    func adminFeedbackOverlay(store: AdminStore) -> some View {
        modifier(AdminFeedbackOverlay(store: store))
    }
}

struct AdminDashboardView: View {
    @Bindable var appModel: AppModel

    private var store: AdminStore { appModel.adminStore }
    private var language: AppLanguage { appModel.preferredLanguage }
    private var role: UserRole { appModel.currentUser?.role ?? .rider }

    var body: some View {
        List {
            Section {
                NavigationLink {
                    AdminRunsView(appModel: appModel, store: store)
                } label: {
                    AdminMenuRow(
                        icon: "bus.fill",
                        title: adminText("Run Management", "운행 관리"),
                        subtitle: RiderStringsGenerated.text("admin.runsDescription", language: language)
                    )
                }

                if role == .admin {
                    NavigationLink {
                        AdminRegistrationsView(store: store, language: language)
                    } label: {
                        AdminMenuRow(
                            icon: "list.clipboard.fill",
                            title: RiderStringsGenerated.text("admin.subtitle", language: language),
                            subtitle: RiderStringsGenerated.text("admin.registrationsDescription", language: language)
                        )
                    }

                    NavigationLink {
                        AdminUsersView(store: store, language: language)
                    } label: {
                        AdminMenuRow(
                            icon: "person.2.badge.gearshape.fill",
                            title: RiderStringsGenerated.text("admin.usersSection", language: language),
                            subtitle: RiderStringsGenerated.text("admin.usersDescription", language: language)
                        )
                    }

                    NavigationLink {
                        AdminRoutesView(store: store, language: language)
                    } label: {
                        AdminMenuRow(
                            icon: "map.fill",
                            title: RiderStringsGenerated.text("admin.routesAndStopsTitle", language: language),
                            subtitle: adminText(
                                "Register routes, manage stops, and sync from Google Maps.",
                                "노선 등록, 정류장 관리 및 Google Maps 동기화"
                            )
                        )
                    }
                }
            }

            Section(adminText("Current Access", "현재 권한")) {
                LabeledContent("Role", value: role.rawValue)
            }
        }
        .navigationTitle(RiderStringsGenerated.text("admin.title", language: language))
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            store.language = language
        }
        .onChange(of: language) { _, next in
            store.language = next
        }
        .adminFeedbackOverlay(store: store)
    }

    private func adminText(_ en: String, _ ko: String) -> String {
        language == .ko ? ko : en
    }
}

private struct AdminMenuRow: View {
    let icon: String
    let title: String
    let subtitle: String

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.title3.weight(.semibold))
                .foregroundStyle(ShuttleTheme.primary)
                .frame(width: 42, height: 42)
                .glassSurface(RoundedRectangle(cornerRadius: 12, style: .continuous))

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(ShuttleTheme.text)
                Text(subtitle)
                    .font(.footnote)
                    .foregroundStyle(ShuttleTheme.secondaryText)
                    .lineLimit(2)
            }
        }
        .padding(.vertical, 4)
    }
}

private struct AdminPlaceholderRows: View {
    let count: Int

    var body: some View {
        ForEach(0..<count, id: \.self) { _ in
            HStack(spacing: 12) {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(ShuttleTheme.surface)
                    .frame(width: 36, height: 36)
                VStack(alignment: .leading, spacing: 8) {
                    RoundedRectangle(cornerRadius: 4, style: .continuous)
                        .fill(ShuttleTheme.surface)
                        .frame(width: 160, height: 13)
                    RoundedRectangle(cornerRadius: 4, style: .continuous)
                        .fill(ShuttleTheme.surface.opacity(0.72))
                        .frame(width: 220, height: 11)
                }
            }
            .redacted(reason: .placeholder)
            .padding(.vertical, 5)
        }
    }
}

private struct AdminInlineProgressLabel: View {
    let title: String
    var systemImage: String?
    var isLoading: Bool

    var body: some View {
        Label {
            Text(title)
        } icon: {
            if isLoading {
                ProgressView()
            } else if let systemImage {
                Image(systemName: systemImage)
            }
        }
    }
}

private enum AdminFloatingActionRole {
    case primary
    case secondary
    case destructive
}

private struct AdminFloatingAction: Identifiable {
    let id: String
    let title: String
    var systemImage: String?
    var role: AdminFloatingActionRole = .secondary
    var isLoading = false
    var isDisabled = false
    let action: () -> Void
}

private struct AdminFloatingActionBar: View {
    let primary: AdminFloatingAction?
    var actions: [AdminFloatingAction] = []

    var body: some View {
        HStack(spacing: 10) {
            ForEach(actions) { action in
                floatingButton(for: action, compact: true)
            }

            if let primary {
                floatingButton(for: primary, compact: false)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 10)
        .padding(.bottom, 12)
        .frame(maxWidth: .infinity)
        .background(.ultraThinMaterial)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(ShuttleTheme.border.opacity(0.28))
                .frame(height: 0.5)
        }
    }

    @ViewBuilder
    private func floatingButton(for action: AdminFloatingAction, compact: Bool) -> some View {
        Button(action: action.action) {
            HStack(spacing: 8) {
                if action.isLoading {
                    ProgressView()
                } else if let systemImage = action.systemImage {
                    Image(systemName: systemImage)
                }

                if !compact || action.systemImage == nil {
                    Text(action.title)
                        .lineLimit(1)
                }
            }
            .font(.headline.weight(.semibold))
            .foregroundStyle(foregroundColor(for: action))
            .frame(maxWidth: compact ? nil : .infinity)
            .frame(width: compact ? 52 : nil, height: 52)
            .background(backgroundColor(for: action), in: Capsule())
            .overlay {
                Capsule()
                    .stroke(borderColor(for: action), lineWidth: 0.5)
            }
        }
        .buttonStyle(.plain)
        .disabled(action.isDisabled)
        .accessibilityLabel(action.title)
    }

    private func foregroundColor(for action: AdminFloatingAction) -> Color {
        if action.isDisabled { return ShuttleTheme.secondaryText }
        switch action.role {
        case .primary:
            return .white
        case .secondary:
            return ShuttleTheme.text
        case .destructive:
            return ShuttleTheme.danger
        }
    }

    private func backgroundColor(for action: AdminFloatingAction) -> Color {
        if action.isDisabled { return ShuttleTheme.surface.opacity(0.88) }
        switch action.role {
        case .primary:
            return ShuttleTheme.primary
        case .secondary, .destructive:
            return ShuttleTheme.surface.opacity(0.92)
        }
    }

    private func borderColor(for action: AdminFloatingAction) -> Color {
        action.role == .primary && !action.isDisabled ? Color.clear : ShuttleTheme.border.opacity(0.55)
    }
}

private struct AdminRunCSVExport: Identifiable {
    let id = UUID()
    let url: URL
}

private struct AdminScheduleMarkdownExport: Identifiable {
    let id = UUID()
    let url: URL
}

private struct AdminActivityView: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

private struct AdminFloatingActionBarModifier: ViewModifier {
    let primary: AdminFloatingAction?
    var actions: [AdminFloatingAction]

    func body(content: Content) -> some View {
        content.safeAreaInset(edge: .bottom, spacing: 0) {
            if primary != nil || !actions.isEmpty {
                AdminFloatingActionBar(primary: primary, actions: actions)
            }
        }
    }
}

private extension View {
    func adminFloatingActionBar(
        primary: AdminFloatingAction? = nil,
        actions: [AdminFloatingAction] = []
    ) -> some View {
        modifier(AdminFloatingActionBarModifier(primary: primary, actions: actions))
    }
}

struct AdminRunsView: View {
    @Bindable var appModel: AppModel
    @Bindable var store: AdminStore
    let language: AppLanguage
    @State private var tab: AdminRunTab = .active
    @State private var resultLoadingRunId: String?
    @State private var expandedRouteCodes: Set<String> = []
    @State private var csvExport: AdminRunCSVExport?
    @State private var autoRunDraft = AdminAutoRunConfig(
        enabled: false,
        daysOfWeek: [0],
        startTime: "08:00",
        endTime: "12:00",
        updatedAt: nil
    )

    init(appModel: AppModel, store: AdminStore) {
        self.appModel = appModel
        self.store = store
        self.language = appModel.preferredLanguage
    }

    var body: some View {
        VStack(spacing: 16) {
            Picker("", selection: $tab) {
                ForEach(AdminRunTab.allCases) { tab in
                    Text(tab.label(language)).tag(tab)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 16)
            .padding(.top, 8)

            Group {
                switch tab {
                case .active:
                    activeRunsContent
                case .history:
                    historyContent
                case .schedule:
                    scheduleContent
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .background(ShuttleTheme.background.ignoresSafeArea())
        .navigationTitle(RiderStringsGenerated.text("admin.runsSection", language: language))
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            store.language = appModel.preferredLanguage
        }
        .onChange(of: appModel.preferredLanguage) { _, next in
            store.language = next
        }
        .task { await store.loadRuns() }
        .refreshable { await store.loadRuns() }
        .onChange(of: store.activeRuns.keys.sorted()) { _, routeCodes in
            expandedRouteCodes.formUnion(routeCodes)
        }
        .onChange(of: tab) { _, next in
            Task {
                if next == .history { await store.loadRunHistory() }
                if next == .schedule {
                    await store.loadAutoRunConfig()
                    autoRunDraft = store.autoRunConfig
                }
            }
        }
        .onChange(of: store.autoRunConfig.updatedAt) { _, _ in
            autoRunDraft = store.autoRunConfig
        }
        .sheet(item: $csvExport) { export in
            AdminActivityView(activityItems: [export.url])
        }
        .adminFloatingActionBar(primary: runsPrimaryAction)
        .adminFeedbackOverlay(store: store)
    }

    private var activeRoutes: [RouteSummary] {
        store.routeSummaries
            .filter { store.activeRuns[$0.routeCode] != nil }
            .sorted { $0.label.localizedCaseInsensitiveCompare($1.label) == .orderedAscending }
    }

    private var idleRoutes: [RouteSummary] {
        store.routeSummaries
            .filter { store.activeRuns[$0.routeCode] == nil }
            .sorted { $0.label.localizedCaseInsensitiveCompare($1.label) == .orderedAscending }
    }

    private var activeRunsContent: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 18) {
                if store.isLoading && store.routeSummaries.isEmpty {
                    AdminConsoleSection(title: adminCopy(language, "Loading", "불러오는 중")) {
                        AdminPlaceholderRows(count: 5)
                    }
                } else if store.routeSummaries.isEmpty {
                    AdminConsoleSection(title: adminCopy(language, "Run Status", "운행 현황")) {
                        Text(RiderStringsGenerated.text("admin.noRuns", language: language))
                            .foregroundStyle(ShuttleTheme.secondaryText)
                            .padding(.vertical, 8)
                    }
                } else {
                    AdminSummaryStrip(
                        title: "\(activeRoutes.count) active · \(idleRoutes.count) ready",
                        subtitle: adminCopy(language, "Tap a route to inspect stop progress or preview its stops.", "노선을 눌러 정류장 진행 상태 또는 출발 전 정류장 목록을 확인하세요.")
                    )

                    AdminRunSection(
                        title: adminCopy(language, "In Service", "현재 운행중"),
                        emptyText: adminCopy(language, "No active runs right now.", "현재 운행중인 노선이 없습니다."),
                        routes: activeRoutes,
                        appModel: appModel,
                        store: store,
                        language: language,
                        resultLoadingRunId: resultLoadingRunId,
                        expandedRouteCodes: $expandedRouteCodes,
                        onViewResults: { run, title in
                            Task { await exportRunResultCSV(runId: run.id, title: title) }
                        }
                    )

                    AdminRunSection(
                        title: adminCopy(language, "Ready To Start", "운행 가능"),
                        emptyText: adminCopy(language, "All available routes are already in service.", "운행 가능한 노선이 모두 시작되었습니다."),
                        routes: idleRoutes,
                        appModel: appModel,
                        store: store,
                        language: language,
                        resultLoadingRunId: resultLoadingRunId,
                        expandedRouteCodes: $expandedRouteCodes,
                        onViewResults: { run, title in
                            Task { await exportRunResultCSV(runId: run.id, title: title) }
                        }
                    )
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 28)
        }
    }

    private var historyContent: some View {
        List {
            if store.isLoading(.runHistory) && store.runHistory.isEmpty {
                AdminPlaceholderRows(count: 4)
            } else if store.runHistory.isEmpty {
                Text(RiderStringsGenerated.text("admin.historyNoRuns", language: language))
                    .foregroundStyle(ShuttleTheme.secondaryText)
            } else {
                ForEach(store.runHistory) { run in
                    let routeTitle = historyRouteTitle(for: run)
                    Button {
                        Task { await exportRunResultCSV(runId: run.id, title: routeTitle) }
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(routeTitle)
                                    .font(.body.weight(.semibold))
                                Text("\(formatAdminDate(run.startedAt)) - \(formatAdminDate(run.endedAt))")
                                    .font(.footnote)
                                    .foregroundStyle(ShuttleTheme.secondaryText)
                            }
                            Spacer()
                            if resultLoadingRunId == run.id {
                                ProgressView()
                            }
                        }
                    }
                    .disabled(resultLoadingRunId != nil)
                }
            }
        }
        .listStyle(.plain)
    }

    private var scheduleContent: some View {
        List {
            AdminAutoRunEditor(store: store, language: language, draft: $autoRunDraft)
        }
        .listStyle(.insetGrouped)
    }

    private var runsPrimaryAction: AdminFloatingAction? {
        switch tab {
        case .active:
            AdminFloatingAction(
                id: "startAllRuns",
                title: RiderStringsGenerated.text("admin.startAllRuns", language: language),
                systemImage: "play.fill",
                role: .primary,
                isLoading: store.isMutating(AdminMutationScope.startAllRuns),
                isDisabled: store.isMutating || idleRoutes.isEmpty
            ) {
                Task { await store.startAllRuns() }
            }
        case .history:
            nil
        case .schedule:
            AdminFloatingAction(
                id: "saveAutoRunConfig",
                title: RiderStringsGenerated.text("admin.scheduleSave", language: language),
                systemImage: "checkmark",
                role: .primary,
                isLoading: store.isMutating(AdminMutationScope.autoRunConfig),
                isDisabled: autoRunDraft.daysOfWeek.isEmpty || store.isMutating(AdminMutationScope.autoRunConfig)
            ) {
                Task { await store.saveAutoRunConfig(autoRunDraft) }
            }
        }
    }

    private func exportRunResultCSV(runId: String, title: String) async {
        resultLoadingRunId = runId
        defer { resultLoadingRunId = nil }
        do {
            let result = try await store.apiClient.fetchAdminRunResult(runId: runId)
            let csv = makeRunResultCSV(result: result, title: title)
            let filename = "\(csvFilenameComponent(title))-\(runId.prefix(8)).csv"
            let fileURL = FileManager.default.temporaryDirectory.appendingPathComponent(filename)
            try csv.write(to: fileURL, atomically: true, encoding: .utf8)
            csvExport = AdminRunCSVExport(url: fileURL)
        } catch {
            store.showFeedback(AdminFeedbackMessage(
                style: .error,
                title: RiderStringsGenerated.text("admin.feedbackError", language: language),
                duration: 4.5
            ))
        }
    }

    private func makeRunResultCSV(result: AdminRunResult, title: String) -> String {
        var rows = [[
            "Route",
            "Run ID",
            "Started At",
            "Ended At",
            "Stop",
            "Status",
            "Total Passengers",
            "User ID",
            "Display Name",
            "Additional Passengers",
            "Scanned At"
        ]]

        for stop in result.stopResults {
            if stop.riders.isEmpty {
                rows.append([
                    title,
                    result.run.id,
                    result.run.startedAt ?? "",
                    result.run.endedAt ?? "",
                    stop.stopName ?? stop.routeStopId,
                    stop.status,
                    "\(stop.totalPassengers)",
                    "",
                    "",
                    "",
                    ""
                ])
            } else {
                for rider in stop.riders {
                    rows.append([
                        title,
                        result.run.id,
                        result.run.startedAt ?? "",
                        result.run.endedAt ?? "",
                        stop.stopName ?? stop.routeStopId,
                        stop.status,
                        "\(stop.totalPassengers)",
                        rider.userId,
                        rider.displayName ?? "",
                        "\(rider.additionalPassengers)",
                        rider.scannedAt
                    ])
                }
            }
        }

        return rows.map { row in
            row.map(csvEscape).joined(separator: ",")
        }
        .joined(separator: "\n") + "\n"
    }

    private func csvEscape(_ value: String) -> String {
        let escaped = value.replacingOccurrences(of: "\"", with: "\"\"")
        if escaped.contains(",") || escaped.contains("\"") || escaped.contains("\n") || escaped.contains("\r") {
            return "\"\(escaped)\""
        }
        return escaped
    }

    private func csvFilenameComponent(_ value: String) -> String {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_"))
        let normalized = value
            .replacingOccurrences(of: " ", with: "-")
            .unicodeScalars
            .map { allowed.contains($0) ? Character($0) : "-" }
        let filename = String(normalized)
            .split(separator: "-")
            .joined(separator: "-")
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
        return filename.isEmpty ? "run-results" : filename
    }

    private func historyRouteTitle(for run: AdminRun) -> String {
        if let routeCode = run.routeCode,
           let route = store.routeSummaries.first(where: { $0.routeCode == routeCode }) {
            return route.label
        }
        return adminCopy(language, "Route", "노선")
    }
}

private enum AdminRunTab: String, CaseIterable, Identifiable {
    case active
    case history
    case schedule

    var id: String { rawValue }

    func label(_ language: AppLanguage) -> String {
        switch self {
        case .active: RiderStringsGenerated.text("admin.scheduleActiveTab", language: language)
        case .history: RiderStringsGenerated.text("admin.scheduleHistoryTab", language: language)
        case .schedule: RiderStringsGenerated.text("admin.scheduleTabTitle", language: language)
        }
    }
}

private struct AdminSummaryStrip: View {
    let title: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.title3.weight(.semibold))
                .foregroundStyle(ShuttleTheme.text)
            Text(subtitle)
                .font(.footnote)
                .foregroundStyle(ShuttleTheme.secondaryText)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(ShuttleTheme.surface.opacity(0.92), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .glassSurface(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .stroke(ShuttleTheme.border.opacity(0.42), lineWidth: 1)
        }
    }
}

private struct AdminConsoleSection<Content: View>: View {
    let title: String
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(ShuttleTheme.secondaryText)
                .textCase(.uppercase)
                .padding(.horizontal, 4)

            VStack(alignment: .leading, spacing: 12) {
                content
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(ShuttleTheme.surface.opacity(0.94), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
            .glassSurface(RoundedRectangle(cornerRadius: 24, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(ShuttleTheme.border.opacity(0.38), lineWidth: 1)
            }
        }
    }
}

private struct AdminRunSection: View {
    let title: String
    let emptyText: String
    let routes: [RouteSummary]
    @Bindable var appModel: AppModel
    @Bindable var store: AdminStore
    let language: AppLanguage
    let resultLoadingRunId: String?
    @Binding var expandedRouteCodes: Set<String>
    let onViewResults: (AdminRun, String) -> Void

    var body: some View {
        AdminConsoleSection(title: title) {
            if routes.isEmpty {
                Text(emptyText)
                    .font(.footnote)
                    .foregroundStyle(ShuttleTheme.secondaryText)
                    .padding(.vertical, 8)
            } else {
                ForEach(routes) { route in
                    AdminRunRouteCard(
                        appModel: appModel,
                        store: store,
                        route: route,
                        activeRun: store.activeRuns[route.routeCode],
                        isExpanded: expandedRouteCodes.contains(route.routeCode),
                        resultLoadingRunId: resultLoadingRunId,
                        language: language,
                        onToggleExpanded: {
                            if expandedRouteCodes.contains(route.routeCode) {
                                expandedRouteCodes.remove(route.routeCode)
                            } else {
                                expandedRouteCodes.insert(route.routeCode)
                            }
                        },
                        onViewResults: onViewResults
                    )
                }
            }
        }
    }
}

private struct AdminRunRouteCard: View {
    @Bindable var appModel: AppModel
    @Bindable var store: AdminStore
    let route: RouteSummary
    let activeRun: AdminRun?
    let isExpanded: Bool
    let resultLoadingRunId: String?
    let language: AppLanguage
    let onToggleExpanded: () -> Void
    let onViewResults: (AdminRun, String) -> Void
    @State private var overrideState: AdminStopOverrideSheetState?
    @State private var activeStatus: AdminActiveRun?
    @State private var isLoadingStatus = false

    private var routeDetail: RouteDetail? {
        appModel.routeDetails[route.routeCode]
    }

    private var visibleStops: [RouteStop] {
        routeDetail?.stops.filter { $0.isPickupEnabled && !$0.place.isTerminal } ?? []
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                routeHeader

                Spacer(minLength: 12)

                routeActions
            }

            if isExpanded {
                expandedContent
            }
        }
        .padding(16)
        .background(ShuttleTheme.background.opacity(0.16), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(ShuttleTheme.border.opacity(0.26), lineWidth: 1)
        }
        .task(id: statusTaskKey) {
            if (isExpanded || activeRun != nil), routeDetail == nil {
                try? await appModel.loadRouteDetail(routeCode: route.routeCode)
            }
            if activeRun != nil {
                await loadActiveStatusIfNeeded()
            } else {
                activeStatus = nil
                isLoadingStatus = false
            }
        }
        .sheet(item: $overrideState) { state in
            AdminStopOverrideSheet(store: store, state: state, language: language)
                .adminFeedbackOverlay(store: store)
        }
    }

    private var routeHeader: some View {
        HStack(alignment: .top, spacing: 10) {
            Button(action: onToggleExpanded) {
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(ShuttleTheme.secondaryText)
                    .rotationEffect(.degrees(isExpanded ? 90 : 0))
                    .animation(.snappy(duration: 0.18), value: isExpanded)
                    .frame(width: 16)
                    .padding(.top, 3)
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: 5) {
                Text(route.label)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(ShuttleTheme.text)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                    .contentShape(Rectangle())
                    .onTapGesture(perform: onToggleExpanded)

                if let activeRun {
                    activeSubtitle(activeRun)
                } else {
                    Text(inactiveSubtitleText)
                        .font(.caption)
                        .foregroundStyle(ShuttleTheme.secondaryText)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    private var inactiveSubtitleText: String {
        adminCopy(language, "\(route.visibleStopCount) stops", "\(route.visibleStopCount)개 정류장")
    }

    private func activeSubtitle(_ activeRun: AdminRun) -> some View {
        let startedAt = activeStatus?.startedAt ?? activeRun.startedAt
        let detail = "\(adminCopy(language, "In service", "운행중")) · \(activeSummary) · \(formatAdminDate(startedAt))"

        return ViewThatFits(in: .horizontal) {
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text("\(detail) ·")
                    .font(.caption)
                    .foregroundStyle(ShuttleTheme.secondaryText)

                viewResultsLink(activeRun)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(ShuttleTheme.secondaryText)
                    .fixedSize(horizontal: false, vertical: true)

                viewResultsLink(activeRun)
            }
        }
    }

    private func viewResultsLink(_ activeRun: AdminRun) -> some View {
        Button {
            onViewResults(activeRun, route.label)
        } label: {
            if resultIsLoading {
                ProgressView()
                    .controlSize(.small)
            } else {
                Text(RiderStringsGenerated.text("admin.viewResults", language: language))
                    .font(.caption.weight(.semibold))
            }
        }
        .buttonStyle(.plain)
        .foregroundStyle(ShuttleTheme.primary)
        .disabled(resultIsLoading || store.isMutating)
    }

    @ViewBuilder
    private var expandedContent: some View {
        if routeDetail == nil || (activeRun != nil && activeStatus == nil && isLoadingStatus) {
            HStack(spacing: 10) {
                ProgressView()
                Text(adminCopy(language, "Loading route detail…", "노선 정보를 불러오는 중…"))
                    .font(.footnote)
                    .foregroundStyle(ShuttleTheme.secondaryText)
            }
            .padding(.leading, 26)
        } else if activeRun != nil, let activeStatus {
            let stateMap = Dictionary(uniqueKeysWithValues: activeStatus.stopStates.map { ($0.routeStopId, $0) })
            let lastArrivedIndex = visibleStops.lastIndex { stop in
                stateMap[stop.id]?.status == "arrived"
            } ?? -1

            ForEach(Array(visibleStops.enumerated()), id: \.element.id) { index, stop in
                let state = stateMap[stop.id]
                Button {
                    overrideState = AdminStopOverrideSheetState(
                        runId: activeStatus.runId,
                        stopId: stop.id,
                        stopName: stop.place.displayName ?? stop.place.name,
                        status: state?.status ?? "waiting",
                        passengers: state?.totalPassengers ?? 0
                    )
                } label: {
                    AdminStopTimelineRow(
                        index: index + 1,
                        title: stop.place.displayName ?? stop.place.name,
                        statusText: stopStatusText(index: index, lastArrivedIndex: lastArrivedIndex, rawStatus: state?.status),
                        passengers: state?.totalPassengers ?? 0,
                        isArrived: state?.status == "arrived",
                        emphasizesProgress: index == lastArrivedIndex + 1 && state?.status != "arrived",
                        passengerText: adminCopy(language, "{count} boarded", "{count}명 탑승")
                    )
                }
                .buttonStyle(.plain)
            }
        } else if visibleStops.isEmpty {
            Text(adminCopy(language, "No pickup stops are configured for this route.", "이 노선에는 탑승 정류장이 없습니다."))
                .font(.footnote)
                .foregroundStyle(ShuttleTheme.secondaryText)
                .padding(.leading, 26)
        } else {
            ForEach(Array(visibleStops.enumerated()), id: \.element.id) { index, stop in
                AdminIdleStopPreviewRow(
                    index: index + 1,
                    title: stop.place.displayName ?? stop.place.name,
                    pickupTime: stop.pickupTime
                )
            }
        }
    }

    @ViewBuilder
    private var routeActions: some View {
        if let activeRun {
            Button(RiderStringsGenerated.text("admin.endRun", language: language)) {
                Task { await store.endRun(activeRun) }
            }
            .font(.callout)
            .foregroundStyle(Color.red)
            .disabled(store.isMutating)
            .fixedSize(horizontal: true, vertical: false)
        } else {
            Button {
                Task { await store.startRun(routeCode: route.routeCode) }
            } label: {
                AdminInlineProgressLabel(
                    title: RiderStringsGenerated.text("admin.createRun", language: language),
                    isLoading: store.isMutating(AdminMutationScope.startRun(route.routeCode))
                )
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.small)
            .disabled(store.isMutating)
            .fixedSize(horizontal: true, vertical: false)
        }
    }

    private var resultIsLoading: Bool {
        guard let activeRun else { return false }
        return resultLoadingRunId == activeRun.id
    }

    private var activeSummary: String {
        let totalPassengers = activeStatus?.stopStates.reduce(0) { $0 + $1.totalPassengers } ?? 0
        return adminCopy(language, "\(totalPassengers) boarded", "\(totalPassengers)명 탑승")
    }

    private var statusTaskKey: String {
        "\(route.routeCode)-\(activeRun?.id ?? "idle")-\(isExpanded)"
    }

    private func loadActiveStatusIfNeeded() async {
        guard activeRun != nil else { return }
        if !isExpanded, activeStatus != nil { return }

        isLoadingStatus = true
        defer { isLoadingStatus = false }
        do {
            activeStatus = try await store.apiClient.fetchAdminActiveRun(routeCode: route.routeCode)
        } catch {
            store.showFeedback(AdminFeedbackMessage(
                style: .error,
                title: RiderStringsGenerated.text("admin.feedbackError", language: language),
                duration: 4.5
            ))
        }
    }

    private func stopStatusText(index: Int, lastArrivedIndex: Int, rawStatus: String?) -> String {
        if rawStatus == "arrived" {
            return adminCopy(language, "Arrived", "도착")
        }
        if lastArrivedIndex >= 0 && index == lastArrivedIndex + 1 {
            return adminCopy(language, "In progress", "진행")
        }
        return adminCopy(language, "Waiting", "대기")
    }
}

private struct AdminStopTimelineRow: View {
    let index: Int
    let title: String
    let statusText: String
    let passengers: Int
    let isArrived: Bool
    let emphasizesProgress: Bool
    let passengerText: String

    var body: some View {
        HStack(spacing: 10) {
            Circle()
                .fill(emphasizesProgress ? ShuttleTheme.primary : ShuttleTheme.secondaryText.opacity(0.22))
                .overlay {
                    if isArrived {
                        Image(systemName: "checkmark")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(.white)
                    } else {
                        Text("\(index)")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(emphasizesProgress ? .white : ShuttleTheme.secondaryText)
                    }
                }
                .frame(width: 24, height: 24)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline)
                    .lineLimit(1)
                Text("\(statusText) · \(passengerText.replacingOccurrences(of: "{count}", with: "\(passengers)"))")
                    .font(.caption)
                    .foregroundStyle(ShuttleTheme.secondaryText)
            }
            Spacer()
        }
        .padding(.vertical, 3)
    }
}

private struct AdminIdleStopPreviewRow: View {
    let index: Int
    let title: String
    let pickupTime: String?

    var body: some View {
        HStack(spacing: 10) {
            Text("\(index)")
                .font(.caption.monospacedDigit())
                .foregroundStyle(ShuttleTheme.secondaryText)
                .frame(width: 24)

            Text(title)
                .font(.subheadline)
                .foregroundStyle(ShuttleTheme.text)
                .lineLimit(1)

            Spacer(minLength: 8)

            Text(pickupTime ?? "--:--")
                .font(.caption.monospacedDigit())
                .foregroundStyle(ShuttleTheme.secondaryText)
        }
        .padding(.vertical, 2)
    }
}

private struct AdminStopOverrideSheetState: Identifiable {
    var id: String { "\(runId)-\(stopId)" }
    let runId: String
    let stopId: String
    let stopName: String
    let status: String
    let passengers: Int
}

private struct AdminStopOverrideSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Bindable var store: AdminStore
    let state: AdminStopOverrideSheetState
    let language: AppLanguage
    @State private var status: String
    @State private var overridePassengers = false
    @State private var passengers: Int

    private var isSaving: Bool {
        store.isMutating(AdminMutationScope.stopOverride(state.runId, state.stopId))
    }

    init(store: AdminStore, state: AdminStopOverrideSheetState, language: AppLanguage) {
        self.store = store
        self.state = state
        self.language = language
        self._status = State(initialValue: state.status)
        self._passengers = State(initialValue: state.passengers)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(state.stopName) {
                    Picker("Status", selection: $status) {
                        Text(RiderStringsGenerated.text("checkin.arrived", language: language)).tag("arrived")
                        Text(RiderStringsGenerated.text("checkin.waiting", language: language)).tag("waiting")
                    }
                    Toggle("Override passenger count", isOn: $overridePassengers)
                    if overridePassengers {
                        Stepper("\(passengers)", value: $passengers, in: 0...99)
                    } else {
                        Text("Using actual scan count (\(state.passengers))")
                            .foregroundStyle(ShuttleTheme.secondaryText)
                    }
                }
            }
            .navigationTitle("Stop Override")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .adminFloatingActionBar(primary: applyAction, actions: [resetAction])
        }
    }

    private var applyAction: AdminFloatingAction {
        return AdminFloatingAction(
            id: "applyStopOverride",
            title: "Apply",
            systemImage: "checkmark",
            role: .primary,
            isLoading: isSaving,
            isDisabled: isSaving
        ) {
            Task {
                let saved = await store.overrideStop(
                    runId: state.runId,
                    stopId: state.stopId,
                    status: status,
                    passengerOverride: overridePassengers ? passengers : nil
                )
                if saved {
                    dismiss()
                }
            }
        }
    }

    private var resetAction: AdminFloatingAction {
        AdminFloatingAction(
            id: "resetStopOverride",
            title: "Reset",
            systemImage: "arrow.counterclockwise",
            role: .destructive,
            isLoading: isSaving,
            isDisabled: isSaving
        ) {
            Task {
                let reset = await store.resetStopOverride(runId: state.runId, stopId: state.stopId)
                if reset {
                    dismiss()
                }
            }
        }
    }
}

private struct AdminAutoRunEditor: View {
    @Bindable var store: AdminStore
    let language: AppLanguage
    @Binding var draft: AdminAutoRunConfig

    var body: some View {
        Section {
            Toggle(RiderStringsGenerated.text("admin.scheduleEnabled", language: language), isOn: Binding(
                get: { draft.enabled },
                set: { draft = AdminAutoRunConfig(enabled: $0, daysOfWeek: draft.daysOfWeek, startTime: draft.startTime, endTime: draft.endTime, updatedAt: draft.updatedAt) }
            ))
            AdminWeekdayPicker(days: $draft.daysOfWeek, language: language)
                .disabled(!draft.enabled)
            TextField("HH:MM", text: $draft.startTime)
            TextField("HH:MM", text: $draft.endTime)
            if let updatedAt = draft.updatedAt {
                Text(formatAdminDate(updatedAt))
                    .font(.footnote)
                    .foregroundStyle(ShuttleTheme.secondaryText)
            }
        } header: {
            Text(RiderStringsGenerated.text("admin.scheduleHeader", language: language))
        }
        .onAppear { draft = store.autoRunConfig }
        .onChange(of: store.autoRunConfig.updatedAt) { _, _ in draft = store.autoRunConfig }
    }
}

private struct AdminWeekdayPicker: View {
    @Binding var days: [Int]
    let language: AppLanguage
    private let labelsEN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    private let labelsKO = ["일", "월", "화", "수", "목", "금", "토"]

    var body: some View {
        let labels = language == .ko ? labelsKO : labelsEN
        HStack {
            ForEach(0..<7, id: \.self) { day in
                Button(labels[day]) {
                    if days.contains(day) {
                        days.removeAll { $0 == day }
                    } else {
                        days.append(day)
                        days.sort()
                    }
                }
                .font(.caption.weight(.semibold))
                .foregroundStyle(days.contains(day) ? .white : ShuttleTheme.text)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 7)
                .background(days.contains(day) ? ShuttleTheme.primary : ShuttleTheme.surface, in: Capsule())
            }
        }
    }
}

struct AdminRegistrationsView: View {
    @Bindable var store: AdminStore
    let language: AppLanguage
    @State private var appliedStatus: AdminRegistrationStatus = .active
    @State private var appliedGroup: AdminRegistrationGroup = .route
    @State private var draftStatus: AdminRegistrationStatus = .active
    @State private var draftGroup: AdminRegistrationGroup = .route
    @State private var filtersExpanded = false
    @State private var search = ""
    @State private var deleteTarget: AdminRegistrationRow?

    private var filtered: [AdminRegistrationRow] {
        let q = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return store.registrations }
        return store.registrations.filter {
            $0.userTitle.lowercased().contains(q)
                || $0.userId.lowercased().contains(q)
                || $0.stopTitle.lowercased().contains(q)
                || $0.routeCode.lowercased().contains(q)
        }
    }

    var body: some View {
        List {
            Section {
                HStack(spacing: 10) {
                    HStack(spacing: 8) {
                        Image(systemName: "magnifyingglass")
                            .foregroundStyle(ShuttleTheme.secondaryText)

                        TextField("Search by name, stop, or route", text: $search)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()

                        if !search.isEmpty {
                            Button {
                                search = ""
                            } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundStyle(ShuttleTheme.secondaryText)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Clear search")
                        }
                    }
                    .padding(.horizontal, 12)
                    .frame(height: 44)
                    .background(ShuttleTheme.surface, in: Capsule())
                    .overlay {
                        Capsule()
                            .stroke(ShuttleTheme.border.opacity(0.65), lineWidth: 0.5)
                    }

                    Button {
                        if !filtersExpanded {
                            draftStatus = appliedStatus
                            draftGroup = appliedGroup
                        }
                        withAnimation(.spring(response: 0.25, dampingFraction: 0.9)) {
                            filtersExpanded.toggle()
                        }
                    } label: {
                        Image(systemName: filtersExpanded ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease.circle")
                            .font(.title3.weight(.semibold))
                            .foregroundStyle(ShuttleTheme.primary)
                            .frame(width: 44, height: 44)
                            .background(ShuttleTheme.surface, in: Circle())
                            .overlay {
                                Circle()
                                    .stroke(ShuttleTheme.border.opacity(0.65), lineWidth: 0.5)
                            }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Filters")
                }

                if filtersExpanded {
                    Picker("Status", selection: $draftStatus) {
                        ForEach(AdminRegistrationStatus.allCases) { status in
                            Text(registrationStatusLabel(status)).tag(status)
                        }
                    }
                    .pickerStyle(.menu)

                    Picker("Group", selection: $draftGroup) {
                        Text("By Route").tag(AdminRegistrationGroup.route)
                        Text("By User").tag(AdminRegistrationGroup.user)
                    }
                    .pickerStyle(.menu)

                    Button {
                        let nextStatus = draftStatus
                        appliedGroup = draftGroup
                        if appliedStatus != nextStatus {
                            appliedStatus = nextStatus
                        }
                        withAnimation(.spring(response: 0.25, dampingFraction: 0.9)) {
                            filtersExpanded = false
                        }
                    } label: {
                        Label("Apply", systemImage: "checkmark")
                    }
                    .font(.headline.weight(.semibold))
                }
            }

            if store.isLoading(.registrations) && store.registrations.isEmpty {
                AdminPlaceholderRows(count: 6)
            } else if filtered.isEmpty {
                Text(RiderStringsGenerated.text("admin.empty", language: language))
                    .foregroundStyle(ShuttleTheme.secondaryText)
            } else if appliedGroup == .route {
                ForEach(groupedRows(filtered, by: \.routeCode), id: \.key) { key, rows in
                    Section("\(rows.first?.routeTitle ?? key) (\(rows.count))") {
                        ForEach(rows) { row in registrationRow(row) }
                    }
                }
            } else {
                ForEach(groupedRows(filtered, by: \.userId), id: \.key) { key, rows in
                    Section("\(rows.first?.userTitle ?? key) (\(rows.count))") {
                        ForEach(rows) { row in registrationRow(row, showRoute: true) }
                    }
                }
            }
        }
        .navigationTitle(RiderStringsGenerated.text("admin.subtitle", language: language))
        .navigationBarTitleDisplayMode(.inline)
        .task { await store.loadRegistrations(status: appliedStatus) }
        .refreshable { await store.loadRegistrations(status: appliedStatus) }
        .onChange(of: appliedStatus) { _, newValue in Task { await store.loadRegistrations(status: newValue) } }
        .confirmationDialog("Delete Registration", isPresented: Binding(
            get: { deleteTarget != nil },
            set: { if !$0 { deleteTarget = nil } }
        )) {
            Button("Delete", role: .destructive) {
                guard let row = deleteTarget else { return }
                deleteTarget = nil
                Task { await store.deleteRegistration(row.registrationId, status: appliedStatus) }
            }
        } message: {
            if let row = deleteTarget {
                Text("\(row.userTitle) · \(row.stopTitle)")
            }
        }
        .adminFeedbackOverlay(store: store)
    }

    private func registrationStatusLabel(_ status: AdminRegistrationStatus) -> String {
        switch status {
        case .active: "Active"
        case .inactive: "Inactive"
        case .all: "All"
        }
    }

    private func registrationRow(_ row: AdminRegistrationRow, showRoute: Bool = false) -> some View {
        HStack(spacing: 12) {
            AdminAvatar(urlString: row.pictureUrl, fallback: row.userTitle)
            VStack(alignment: .leading, spacing: 4) {
                Text(row.userTitle)
                    .font(.body.weight(.semibold))
                    .lineLimit(1)
                Text("\(showRoute ? "\(row.routeTitle) · " : "")\(row.stopTitle)\(row.pickupTime.map { " · \($0)" } ?? "")")
                    .font(.footnote)
                    .foregroundStyle(ShuttleTheme.secondaryText)
                    .lineLimit(2)
            }
            Spacer()
            Button(role: .destructive) { deleteTarget = row } label: {
                AdminInlineProgressLabel(
                    title: "Delete",
                    isLoading: store.isMutating(AdminMutationScope.registration(row.registrationId))
                )
            }
                .buttonStyle(.borderless)
                .disabled(store.isMutating(AdminMutationScope.registration(row.registrationId)))
        }
    }
}

struct AdminUsersView: View {
    @Bindable var store: AdminStore
    let language: AppLanguage
    @State private var providerUid = ""
    @State private var provider: AdminProvider = .line
    @State private var role: UserRole = .driver
    @State private var revokeTarget: AdminPrivilegedUser?

    var body: some View {
        Form {
            Section(RiderStringsGenerated.text("admin.assignRole", language: language)) {
                TextField(RiderStringsGenerated.text("admin.userIdPlaceholder", language: language), text: $providerUid)
                    .textInputAutocapitalization(.never)
                    .font(.body.monospaced())
                Picker("Provider", selection: $provider) {
                    ForEach(AdminProvider.allCases) { provider in
                        Text(provider.label).tag(provider)
                    }
                }
                Picker("Role", selection: $role) {
                    Text(RiderStringsGenerated.text("admin.roleDriver", language: language)).tag(UserRole.driver)
                    Text(RiderStringsGenerated.text("admin.roleAdmin", language: language)).tag(UserRole.admin)
                }
            }

            Section(RiderStringsGenerated.text("admin.usersSection", language: language)) {
                if store.isLoading(.users) && store.users.isEmpty {
                    AdminPlaceholderRows(count: 4)
                } else if store.users.isEmpty {
                    Text(RiderStringsGenerated.text("admin.noPrivilegedUsers", language: language))
                        .foregroundStyle(ShuttleTheme.secondaryText)
                } else {
                    ForEach(store.users) { user in
                        HStack(spacing: 12) {
                            AdminAvatar(urlString: user.pictureUrl, fallback: user.displayName ?? user.userId)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(user.displayName ?? user.userId)
                                Text("\(user.role.rawValue) · \(user.provider)")
                                    .font(.footnote)
                                    .foregroundStyle(ShuttleTheme.secondaryText)
                            }
                            Spacer()
                            Button(role: .destructive) {
                                revokeTarget = user
                            } label: {
                                AdminInlineProgressLabel(
                                    title: RiderStringsGenerated.text("admin.removeRole", language: language),
                                    isLoading: store.isMutating(AdminMutationScope.revokeUser(user.userId))
                                )
                            }
                            .buttonStyle(.borderless)
                            .disabled(store.isMutating(AdminMutationScope.revokeUser(user.userId)))
                        }
                    }
                }
            }
        }
        .navigationTitle(RiderStringsGenerated.text("admin.usersSection", language: language))
        .navigationBarTitleDisplayMode(.inline)
        .task { await store.loadUsers() }
        .refreshable { await store.loadUsers() }
        .adminFloatingActionBar(primary: assignRoleAction)
        .alert(RiderStringsGenerated.text("admin.removeRole", language: language), isPresented: Binding(
            get: { revokeTarget != nil },
            set: { if !$0 { revokeTarget = nil } }
        )) {
            Button("Cancel", role: .cancel) {
                revokeTarget = nil
            }
            Button(RiderStringsGenerated.text("admin.removeRole", language: language), role: .destructive) {
                guard let user = revokeTarget else { return }
                let userId = user.userId
                revokeTarget = nil
                Task { await store.revokeUser(userId) }
            }
        } message: {
            if let user = revokeTarget {
                Text("\(user.displayName ?? user.userId)\n\(user.role.rawValue) · \(user.provider)")
            }
        }
        .adminFeedbackOverlay(store: store)
    }

    private var assignRoleAction: AdminFloatingAction {
        AdminFloatingAction(
            id: "assignRole",
            title: RiderStringsGenerated.text("admin.assignRole", language: language),
            systemImage: "person.badge.plus",
            role: .primary,
            isLoading: store.isMutating(AdminMutationScope.assignUser),
            isDisabled: providerUid.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || store.isMutating(AdminMutationScope.assignUser)
        ) {
            Task {
                await store.assignUser(
                    providerUid: providerUid.trimmingCharacters(in: .whitespacesAndNewlines),
                    provider: provider,
                    role: role
                )
                providerUid = ""
            }
        }
    }
}

struct AdminRoutesView: View {
    @Bindable var store: AdminStore
    let language: AppLanguage
    @State private var tab: AdminRoutesTab = .routes
    @State private var showingAddRoute = false
    @State private var deleteDraftConfirm = false
    @State private var downloadingScheduleId: String?
    @State private var scheduleMarkdownExport: AdminScheduleMarkdownExport?
    @State private var stopSearch = ""
    @State private var stopsDuplicatesOnly = false

    private var publishedSchedule: AdminScheduleSummary? {
        store.routeBundle.schedules.first { $0.status == .published }
    }

    private var draftSchedule: AdminScheduleSummary? {
        store.routeBundle.schedules.first { $0.status == .draft }
    }

    private var archivedSchedules: [AdminScheduleSummary] {
        store.routeBundle.schedules.filter { $0.status == .archived }
    }

    private var historySchedules: [AdminScheduleSummary] {
        ([publishedSchedule].compactMap { $0 } + archivedSchedules)
            .sorted { lhs, rhs in
                (lhs.publishedAt ?? "") > (rhs.publishedAt ?? "")
            }
    }

    private var draftScheduleDetail: AdminScheduleWithRouteDetails? {
        guard let draftSchedule, store.schedule?.id == draftSchedule.id else { return nil }
        return store.schedule
    }

    private var draftIncompleteCount: Int {
        draftScheduleDetail?.routes.reduce(0) { total, route in
            total + route.stopsSnapshot.filter {
                ($0.changeType == "updated" || $0.changeType == "added")
                    && $0.isPickupEnabled
                    && ($0.pickupTime ?? "").isEmpty
            }.count
        } ?? 0
    }

    var body: some View {
        VStack(spacing: 0) {
            Picker("", selection: $tab) {
                ForEach(AdminRoutesTab.allCases) { tab in
                    Text(tab.label(language)).tag(tab)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 10)

            Group {
                switch tab {
                case .routes:
                    routesContent
                case .stops:
                    stopsContent
                case .draft:
                    draftContent
                case .history:
                    historyContent
                }
            }
        }
        .background(ShuttleTheme.background.ignoresSafeArea())
        .navigationTitle(RiderStringsGenerated.text("admin.routesAndStopsTitle", language: language))
        .navigationBarTitleDisplayMode(.inline)
        .task { await store.loadRouteBundle() }
        .refreshable { await store.loadRouteBundle() }
        .onChange(of: tab) { _, next in
            if next == .draft, let draftSchedule {
                Task { await store.loadSchedule(draftSchedule.id) }
            }
        }
        .onChange(of: draftSchedule?.id) { _, next in
            if tab == .draft, let next {
                Task { await store.loadSchedule(next) }
            }
        }
        .sheet(isPresented: $showingAddRoute) {
            if let draftSchedule {
                AdminAddRouteSheet(store: store, scheduleId: draftSchedule.id, language: language)
            }
        }
        .sheet(item: $scheduleMarkdownExport) { export in
            AdminActivityView(activityItems: [export.url])
        }
        .confirmationDialog(adminCopy(language, "Discard this draft?", "Draft를 폐기할까요?"), isPresented: $deleteDraftConfirm) {
            Button(adminCopy(language, "Discard", "폐기"), role: .destructive) {
                guard let draftSchedule else { return }
                Task { await store.deleteSchedule(draftSchedule.id) }
            }
        }
        .adminFloatingActionBar(primary: routesPrimaryAction, actions: routesSecondaryActions)
        .adminFeedbackOverlay(store: store)
    }

    private var routesContent: some View {
        List {
            Section {
                if store.isLoading && store.routeBundle.routes.isEmpty {
                    AdminPlaceholderRows(count: 6)
                } else if store.routeBundle.routes.isEmpty {
                    Text(RiderStringsGenerated.text("admin.noRoutesYet", language: language))
                        .foregroundStyle(ShuttleTheme.secondaryText)
                } else {
                    ForEach(store.routeBundle.routes) { route in
                        NavigationLink {
                            AdminLiveRouteDetailView(store: store, routeId: route.id, language: language)
                        } label: {
                            AdminRouteListRow(route: route, language: language)
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    private var stopsContent: some View {
        List {
            Section {
                TextField(RiderStringsGenerated.text("admin.searchMasterStops", language: language), text: $stopSearch)
                    .textInputAutocapitalization(.never)
                Toggle(RiderStringsGenerated.text("admin.duplicatesOnly", language: language), isOn: $stopsDuplicatesOnly)
            }

            Section {
                if store.isLoading(.places) && store.places.isEmpty {
                    AdminPlaceholderRows(count: 6)
                } else if store.places.isEmpty {
                    Text(RiderStringsGenerated.text("admin.noMasterStopsYet", language: language))
                        .foregroundStyle(ShuttleTheme.secondaryText)
                } else {
                    ForEach(store.places) { place in
                        NavigationLink {
                            AdminStopMasterDetailView(store: store, placeId: place.id, language: language)
                        } label: {
                            AdminStopMasterRow(place: place, language: language)
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .task(id: "\(stopSearch)|\(stopsDuplicatesOnly)") {
            await store.loadPlaces(query: stopSearch, duplicatesOnly: stopsDuplicatesOnly)
        }
        .refreshable {
            await store.loadPlaces(query: stopSearch, duplicatesOnly: stopsDuplicatesOnly)
        }
    }

    private var draftContent: some View {
        List {
            if let draftSchedule {
                if let schedule = draftScheduleDetail {
                    if draftIncompleteCount > 0 {
                        Section {
                            Label("\(adminCopy(language, "Missing pickup time", "탑승 시간 미입력")): \(draftIncompleteCount)", systemImage: "exclamationmark.triangle.fill")
                                .foregroundStyle(.orange)
                        }
                    }

                    Section {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(RiderStringsGenerated.text("admin.draftInProgress", language: language))
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(ShuttleTheme.secondaryText)
                            Text(schedule.name)
                                .font(.headline)
                        }
                    }

                    Section(RiderStringsGenerated.text("admin.routesTab", language: language)) {
                        ForEach(schedule.routes) { route in
                            NavigationLink {
                                AdminScheduleRouteDetailView(
                                    store: store,
                                    scheduleId: draftSchedule.id,
                                    routeId: route.routeId,
                                    language: language
                                )
                            } label: {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(route.title)
                                        .font(.body.weight(.semibold))
                                    Text("\(RiderStringsGenerated.text("admin.stopCount", language: language, values: ["count": "\(route.stopsSnapshot.count)"])) · \(route.syncStatus)")
                                        .font(.footnote)
                                        .foregroundStyle(ShuttleTheme.secondaryText)
                                }
                            }
                        }
                    }
                } else {
                    AdminPlaceholderRows(count: 5)
                }
            } else {
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(RiderStringsGenerated.text("admin.draftEmptyTitle", language: language))
                            .font(.headline)
                        Text(RiderStringsGenerated.text("admin.draftEmptyBody", language: language))
                            .font(.footnote)
                            .foregroundStyle(ShuttleTheme.secondaryText)
                    }
                    .padding(.vertical, 8)
                }
            }
        }
        .listStyle(.insetGrouped)
        .task(id: draftSchedule?.id) {
            if let draftSchedule {
                await store.loadSchedule(draftSchedule.id)
            }
        }
    }

    private var historyContent: some View {
        List {
            if store.isLoading && store.routeBundle.schedules.isEmpty {
                AdminPlaceholderRows(count: 5)
            } else if historySchedules.isEmpty {
                Text(RiderStringsGenerated.text("admin.historyNoRuns", language: language))
                    .foregroundStyle(ShuttleTheme.secondaryText)
            } else {
                Section {
                    ForEach(historySchedules) { schedule in
                        AdminScheduleHistoryRow(
                            store: store,
                            schedule: schedule,
                            isLatest: schedule.id == publishedSchedule?.id,
                            isDownloading: downloadingScheduleId == schedule.id,
                            isRestoring: store.isMutating(AdminMutationScope.restoreSchedule(schedule.id)),
                            language: language,
                            onDownload: {
                                Task { await exportScheduleMarkdown(schedule) }
                            },
                            onRestore: {
                                Task { await store.restoreSchedule(schedule.id) }
                            }
                        )
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    private var routesPrimaryAction: AdminFloatingAction? {
        guard tab == .draft else { return nil }
        if let draftSchedule {
            return AdminFloatingAction(
                id: "publishDraftSchedule",
                title: adminCopy(language, "Save & Deploy", "저장 & 배포"),
                systemImage: "paperplane.fill",
                role: .primary,
                isLoading: store.isMutating(AdminMutationScope.publishSchedule(draftSchedule.id)),
                isDisabled: draftIncompleteCount > 0 || store.isMutating(AdminMutationScope.publishSchedule(draftSchedule.id))
            ) {
                Task { await store.publishSchedule(draftSchedule.id) }
            }
        }

        return AdminFloatingAction(
            id: "newSchedule",
            title: RiderStringsGenerated.text("admin.newSchedule", language: language),
            systemImage: "plus.circle.fill",
            role: .primary,
            isLoading: store.isMutating(AdminMutationScope.createSchedule),
            isDisabled: store.isMutating(AdminMutationScope.createSchedule)
        ) {
            Task { _ = await store.createSchedule() }
        }
    }

    private var routesSecondaryActions: [AdminFloatingAction] {
        guard tab == .draft, let draftSchedule else { return [] }
        return [
            AdminFloatingAction(
                id: "syncDraftSchedule",
                title: "Sync All",
                systemImage: "arrow.triangle.2.circlepath",
                role: .secondary,
                isLoading: store.isMutating(AdminMutationScope.syncSchedule(draftSchedule.id)),
                isDisabled: store.isMutating(AdminMutationScope.syncSchedule(draftSchedule.id))
            ) {
                Task { await store.syncSchedule(draftSchedule.id) }
            },
            AdminFloatingAction(
                id: "addDraftRoute",
                title: adminCopy(language, "Add Route", "새 노선 추가"),
                systemImage: "plus",
                role: .secondary
            ) {
                showingAddRoute = true
            },
            AdminFloatingAction(
                id: "discardDraftSchedule",
                title: adminCopy(language, "Discard", "폐기"),
                systemImage: "trash",
                role: .destructive,
                isLoading: store.isMutating(AdminMutationScope.deleteSchedule(draftSchedule.id)),
                isDisabled: store.isMutating(AdminMutationScope.deleteSchedule(draftSchedule.id))
            ) {
                deleteDraftConfirm = true
            }
        ]
    }

    private func exportScheduleMarkdown(_ schedule: AdminScheduleSummary) async {
        downloadingScheduleId = schedule.id
        defer { downloadingScheduleId = nil }

        do {
            let detail = try await store.apiClient.fetchAdminSchedule(scheduleId: schedule.id)
            let markdown = makeScheduleMarkdown(detail)
            let filename = "\(scheduleFilenameComponent(schedule.name)).md"
            let fileURL = FileManager.default.temporaryDirectory.appendingPathComponent(filename)
            try markdown.write(to: fileURL, atomically: true, encoding: .utf8)
            scheduleMarkdownExport = AdminScheduleMarkdownExport(url: fileURL)
        } catch {
            store.showFeedback(AdminFeedbackMessage(
                style: .error,
                title: RiderStringsGenerated.text("admin.feedbackError", language: language),
                duration: 4.5
            ))
        }
    }

    private func makeScheduleMarkdown(_ schedule: AdminScheduleWithRouteDetails) -> String {
        var lines = ["# Shuttle Schedule - \(schedule.name)", ""]
        for route in schedule.routes {
            lines.append("## \(route.title)")
            lines.append("")
            let stops = route.stopsSnapshot.sorted { $0.sequence < $1.sequence }
            if stops.isEmpty {
                lines.append("- \(RiderStringsGenerated.text("admin.noStopsYet", language: language))")
            } else {
                for stop in stops where stop.changeType != "removed" {
                    let time = stop.pickupTime?.nilIfBlank ?? "--:--"
                    let stopId = stop.stopId.map { " #\($0)" } ?? ""
                    lines.append("\(stop.sequence). \(time) - \(stop.title)\(stopId)")
                }
            }
            lines.append("")
        }
        return lines.joined(separator: "\n")
    }

    private func scheduleFilenameComponent(_ value: String) -> String {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_"))
        let scalars = value.unicodeScalars.map { allowed.contains($0) ? Character($0) : "-" }
        let filename = String(scalars).trimmingCharacters(in: CharacterSet(charactersIn: "-"))
        return filename.isEmpty ? "schedule" : filename
    }
}

private enum AdminRoutesTab: String, CaseIterable, Identifiable {
    case routes
    case stops
    case draft
    case history

    var id: String { rawValue }

    func label(_ language: AppLanguage) -> String {
        switch self {
        case .routes:
            RiderStringsGenerated.text("admin.routesTab", language: language)
        case .stops:
            RiderStringsGenerated.text("admin.stopsTab", language: language)
        case .draft:
            RiderStringsGenerated.text("admin.draftTab", language: language)
        case .history:
            RiderStringsGenerated.text("admin.historyTab", language: language)
        }
    }

}

private struct AdminRouteListRow: View {
    let route: AdminRouteListItem
    let language: AppLanguage

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(route.title)
                .font(.body.weight(.semibold))
                .lineLimit(2)

            HStack(spacing: 6) {
                Text("\(route.line) · \(route.service)")
                Text(RiderStringsGenerated.text("admin.stopCount", language: language, values: ["count": "\(route.stopCount)"]))
                Text(route.syncStatus)
                if route.incompleteStopCount > 0 {
                    Text(RiderStringsGenerated.text("admin.incompleteStops", language: language, values: ["count": "\(route.incompleteStopCount)"]))
                        .foregroundStyle(.orange)
                }
                if !route.active {
                    Text(RiderStringsGenerated.text("admin.inactive", language: language))
                }
            }
            .font(.caption)
            .foregroundStyle(ShuttleTheme.secondaryText)
            .lineLimit(2)
        }
        .padding(.vertical, 3)
    }
}

private struct AdminStopMasterRow: View {
    let place: AdminPlaceListItem
    let language: AppLanguage

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(place.title)
                    .font(.body.weight(.semibold))
                    .lineLimit(2)
                if place.isTerminal {
                    Text(RiderStringsGenerated.text("admin.terminalStop", language: language))
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(ShuttleTheme.secondaryText)
                }
            }

            Text([place.stopId.map { "#\($0)" }, place.googlePlaceId].compactMap { $0 }.joined(separator: " · "))
                .font(.caption)
                .foregroundStyle(ShuttleTheme.secondaryText)
                .lineLimit(1)

            HStack(spacing: 8) {
                Text(RiderStringsGenerated.text("admin.routeUsageCount", language: language, values: ["count": "\(place.routeStopCount)"]))
                Text(RiderStringsGenerated.text("admin.scheduleUsageCount", language: language, values: ["count": "\(place.scheduleSnapshotCount)"]))
                if place.duplicateCandidateCount > 0 {
                    Text(RiderStringsGenerated.text("admin.duplicateCount", language: language, values: ["count": "\(place.duplicateCandidateCount)"]))
                        .foregroundStyle(.orange)
                }
            }
            .font(.caption2)
            .foregroundStyle(ShuttleTheme.secondaryText)
        }
        .padding(.vertical, 3)
    }
}

struct AdminStopMasterDetailView: View {
    @Bindable var store: AdminStore
    let placeId: String
    let language: AppLanguage
    @State private var values = AdminEditablePlaceValues()
    @State private var mergeTarget: AdminPlaceListItem?

    private var place: AdminPlaceDetail? {
        store.placeDetails[placeId]
    }

    private var duplicates: [AdminPlaceListItem] {
        store.placeDuplicates[placeId] ?? []
    }

    var body: some View {
        List {
            if let place {
                Section(RiderStringsGenerated.text("admin.masterStopInfo", language: language)) {
                    LabeledContent(RiderStringsGenerated.text("admin.canonicalStop", language: language), value: place.name)
                    TextField(RiderStringsGenerated.text("admin.displayName", language: language), text: $values.displayName)
                    TextField(adminCopy(language, "Stop ID", "정류장 ID"), text: $values.stopId)
                        .textInputAutocapitalization(.never)
                    TextField(RiderStringsGenerated.text("admin.notes", language: language), text: $values.notes)
                    Toggle(RiderStringsGenerated.text("admin.terminalStop", language: language), isOn: $values.isTerminal)
                    LabeledContent(RiderStringsGenerated.text("admin.googlePlaceId", language: language), value: place.googlePlaceId)
                    if let address = place.formattedAddress {
                        Text(address)
                            .font(.footnote)
                            .foregroundStyle(ShuttleTheme.secondaryText)
                    }
                }

                Section(RiderStringsGenerated.text("admin.usage", language: language)) {
                    if place.routeUsages.isEmpty && place.scheduleUsages.isEmpty {
                        Text(adminCopy(language, "Not used by any route yet.", "아직 노선에서 사용되지 않습니다."))
                            .foregroundStyle(ShuttleTheme.secondaryText)
                    }

                    ForEach(place.routeUsages) { usage in
                        NavigationLink {
                            AdminLiveRouteDetailView(store: store, routeId: usage.routeId, language: language)
                        } label: {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(usage.routeTitle)
                                    .font(.body.weight(.semibold))
                                Text("\(usage.routeCode) · #\(usage.sequence)\(usage.pickupTime.map { " · \($0)" } ?? "")")
                                    .font(.caption)
                                    .foregroundStyle(ShuttleTheme.secondaryText)
                            }
                        }
                    }

                    ForEach(place.scheduleUsages) { usage in
                        VStack(alignment: .leading, spacing: 3) {
                            Text(usage.scheduleName)
                                .font(.body.weight(.semibold))
                            Text("\(usage.status.rawValue) · \(usage.routeCode) · #\(usage.sequence) · \(usage.changeType)")
                                .font(.caption)
                                .foregroundStyle(ShuttleTheme.secondaryText)
                        }
                    }
                }

                Section(RiderStringsGenerated.text("admin.duplicates", language: language)) {
                    if store.isLoading(.placeDuplicates) && duplicates.isEmpty {
                        AdminPlaceholderRows(count: 3)
                    } else if duplicates.isEmpty {
                        Text(adminCopy(language, "No duplicate candidates.", "중복 후보가 없습니다."))
                            .foregroundStyle(ShuttleTheme.secondaryText)
                    } else {
                        ForEach(duplicates) { duplicate in
                            AdminStopDuplicateRow(
                                duplicate: duplicate,
                                isMerging: store.isMutating(AdminMutationScope.mergePlace(placeId, duplicate.id)),
                                language: language
                            ) {
                                mergeTarget = duplicate
                            }
                        }
                    }
                }
            } else {
                AdminPlaceholderRows(count: 6)
            }
        }
        .navigationTitle(place?.title ?? RiderStringsGenerated.text("admin.stopsTab", language: language))
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await store.loadPlaceDetail(placeId)
            await store.loadPlaceDuplicates(placeId)
            syncValues()
        }
        .refreshable {
            await store.loadPlaceDetail(placeId)
            await store.loadPlaceDuplicates(placeId)
        }
        .onChange(of: place?.id) { _, _ in
            syncValues()
        }
        .confirmationDialog(RiderStringsGenerated.text("admin.mergeStopConfirm", language: language), isPresented: Binding(
            get: { mergeTarget != nil },
            set: { if !$0 { mergeTarget = nil } }
        )) {
            Button(RiderStringsGenerated.text("admin.mergeIntoThis", language: language), role: .destructive) {
                guard let mergeTarget else { return }
                self.mergeTarget = nil
                Task { await store.mergePlace(canonicalPlaceId: placeId, duplicatePlaceId: mergeTarget.id) }
            }
        } message: {
            if let mergeTarget {
                Text("\(mergeTarget.title) → \(place?.title ?? "")")
            }
        }
        .adminFloatingActionBar(primary: saveAction)
        .adminFeedbackOverlay(store: store)
    }

    private func syncValues() {
        guard let place else { return }
        values = AdminEditablePlaceValues(
            displayName: place.displayName ?? "",
            stopId: place.stopId ?? "",
            notes: place.notes ?? "",
            isTerminal: place.isTerminal
        )
    }

    private var saveAction: AdminFloatingAction? {
        guard place != nil else { return nil }
        return AdminFloatingAction(
            id: "savePlace",
            title: RiderStringsGenerated.text("admin.scheduleSave", language: language),
            systemImage: "checkmark",
            role: .primary,
            isLoading: store.isMutating(AdminMutationScope.savePlace(placeId)),
            isDisabled: store.isMutating(AdminMutationScope.savePlace(placeId))
        ) {
            Task { await store.savePlace(placeId, values: values) }
        }
    }
}

private struct AdminStopDuplicateRow: View {
    let duplicate: AdminPlaceListItem
    let isMerging: Bool
    let language: AppLanguage
    let onMerge: () -> Void

    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            VStack(alignment: .leading, spacing: 4) {
                Text(duplicate.title)
                    .font(.body.weight(.semibold))
                Text([duplicate.stopId.map { "#\($0)" }, duplicate.googlePlaceId].compactMap { $0 }.joined(separator: " · "))
                    .font(.caption)
                    .foregroundStyle(ShuttleTheme.secondaryText)
                Text("\(RiderStringsGenerated.text("admin.routeUsageCount", language: language, values: ["count": "\(duplicate.routeStopCount)"])) · \(RiderStringsGenerated.text("admin.scheduleUsageCount", language: language, values: ["count": "\(duplicate.scheduleSnapshotCount)"]))")
                    .font(.caption2)
                    .foregroundStyle(ShuttleTheme.secondaryText)
            }

            Spacer()

            if isMerging {
                ProgressView()
            } else {
                Button(action: onMerge) {
                    Image(systemName: "arrow.triangle.2.circlepath")
                        .font(.title3)
                }
                .buttonStyle(.borderless)
                .accessibilityLabel(RiderStringsGenerated.text("admin.mergeIntoThis", language: language))
            }
        }
    }
}

private struct AdminScheduleHistoryRow: View {
    @Bindable var store: AdminStore
    let schedule: AdminScheduleSummary
    let isLatest: Bool
    let isDownloading: Bool
    let isRestoring: Bool
    let language: AppLanguage
    let onDownload: () -> Void
    let onRestore: () -> Void

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            NavigationLink {
                AdminScheduleDetailView(store: store, scheduleId: schedule.id, language: language)
            } label: {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Text(schedule.name)
                            .font(.body.weight(.semibold))
                        if isLatest {
                            Text(RiderStringsGenerated.text("admin.latestTag", language: language))
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(ShuttleTheme.primary)
                        }
                    }
                    Text(formatAdminDate(schedule.publishedAt))
                        .font(.footnote)
                        .foregroundStyle(ShuttleTheme.secondaryText)
                }
            }

            Menu {
                Button {
                    onDownload()
                } label: {
                    Label(RiderStringsGenerated.text("admin.downloadMarkdown", language: language), systemImage: "square.and.arrow.down")
                }
                if schedule.status == .archived {
                    Button {
                        onRestore()
                    } label: {
                        Label(RiderStringsGenerated.text("admin.restore", language: language), systemImage: "arrow.clockwise")
                    }
                }
            } label: {
                if isDownloading || isRestoring {
                    ProgressView()
                } else {
                    Image(systemName: "ellipsis.circle")
                        .font(.title3)
                }
            }
            .buttonStyle(.borderless)
            .disabled(isDownloading || isRestoring)
        }
    }
}

struct AdminLiveRouteDetailView: View {
    @Bindable var store: AdminStore
    let routeId: String
    let language: AppLanguage
    @State private var routeValues = AdminEditableRouteValues()
    @State private var search = ""
    @State private var editingStop: AdminLiveStopEditState?
    @State private var deleteTarget: AdminStop?
    @State private var qrRoute: AdminRouteListItem?

    private var route: AdminRouteListItem? {
        store.routeBundle.routes.first { $0.id == routeId }
    }

    private var stops: [AdminStop] {
        store.routeStops[routeId] ?? []
    }

    private var filteredStops: [AdminStop] {
        let q = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return stops.sorted { $0.sequence < $1.sequence } }
        return stops.filter {
            $0.title.lowercased().contains(q)
                || $0.googlePlaceId.lowercased().contains(q)
                || ($0.stopId ?? "").lowercased().contains(q)
        }
        .sorted { $0.sequence < $1.sequence }
    }

    var body: some View {
        List {
            if let route {
                Section(RiderStringsGenerated.text("admin.routeInfo", language: language)) {
                    Text(route.routeCode)
                        .font(.body.monospaced())
                    TextField(RiderStringsGenerated.text("admin.displayName", language: language), text: $routeValues.displayName)
                    TextField("Google Maps URL", text: $routeValues.googleMapsUrl)
                        .textInputAutocapitalization(.never)
                    Toggle(RiderStringsGenerated.text("admin.active", language: language), isOn: $routeValues.active)
                    LabeledContent("Sync", value: route.syncStatus)
                    if let syncError = route.syncError {
                        Text(syncError)
                            .foregroundStyle(ShuttleTheme.danger)
                    }
                }

                Section(RiderStringsGenerated.text("admin.stopsHeader", language: language)) {
                    TextField(RiderStringsGenerated.text("admin.searchStops", language: language), text: $search)

                    if store.isLoading(.routeStops) && stops.isEmpty {
                        AdminPlaceholderRows(count: 6)
                    } else if filteredStops.isEmpty {
                        Text(RiderStringsGenerated.text("admin.noStopsYet", language: language))
                            .foregroundStyle(ShuttleTheme.secondaryText)
                    } else {
                        ForEach(filteredStops) { stop in
                            AdminLiveStopRow(
                                stop: stop,
                                isMutating: store.isMutating(AdminMutationScope.liveStop(stop.id))
                                    || store.isMutating(AdminMutationScope.deleteLiveStop(stop.id)),
                                language: language,
                                onEdit: { editingStop = AdminLiveStopEditState(routeId: routeId, stop: stop) },
                                onDelete: { deleteTarget = stop }
                            )
                        }
                    }
                }
            } else {
                AdminPlaceholderRows(count: 6)
            }
        }
        .navigationTitle(route?.title ?? RiderStringsGenerated.text("admin.routesTab", language: language))
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await store.loadRouteBundle()
            await store.loadRouteStops(routeId: routeId)
            syncRouteValues()
        }
        .refreshable {
            await store.loadRouteBundle()
            await store.loadRouteStops(routeId: routeId)
        }
        .onChange(of: route?.id) { _, _ in
            syncRouteValues()
        }
        .sheet(item: $editingStop) { state in
            AdminLiveStopEditSheet(store: store, state: state, language: language)
        }
        .sheet(item: $qrRoute) { route in
            AdminQRCodeSheet(route: route, language: language)
        }
        .confirmationDialog(RiderStringsGenerated.text("admin.deleteStopConfirm", language: language), isPresented: Binding(
            get: { deleteTarget != nil },
            set: { if !$0 { deleteTarget = nil } }
        )) {
            Button(adminCopy(language, "Delete", "삭제"), role: .destructive) {
                guard let stop = deleteTarget else { return }
                deleteTarget = nil
                Task { await store.deleteLiveStop(routeId: routeId, stopId: stop.id) }
            }
        }
        .adminFloatingActionBar(primary: routePrimaryAction, actions: routeSecondaryActions)
        .adminFeedbackOverlay(store: store)
    }

    private func syncRouteValues() {
        guard let route else { return }
        routeValues = AdminEditableRouteValues(
            displayName: route.displayName ?? "",
            googleMapsUrl: route.googleMapsUrl ?? "",
            active: route.active
        )
    }

    private var routePrimaryAction: AdminFloatingAction? {
        guard route != nil else { return nil }
        return AdminFloatingAction(
            id: "saveLiveRoute",
            title: RiderStringsGenerated.text("admin.scheduleSave", language: language),
            systemImage: "checkmark",
            role: .primary,
            isLoading: store.isMutating(AdminMutationScope.saveLiveRoute(routeId)),
            isDisabled: store.isMutating(AdminMutationScope.saveLiveRoute(routeId))
        ) {
            Task { await store.saveLiveRoute(routeId: routeId, values: routeValues) }
        }
    }

    private var routeSecondaryActions: [AdminFloatingAction] {
        guard let route else { return [] }
        return [
            AdminFloatingAction(
                id: "syncLiveRoute",
                title: RiderStringsGenerated.text("admin.sync", language: language),
                systemImage: "arrow.triangle.2.circlepath",
                role: .secondary,
                isLoading: store.isMutating(AdminMutationScope.syncLiveRoute(routeId)),
                isDisabled: store.isMutating(AdminMutationScope.syncLiveRoute(routeId))
            ) {
                Task { await store.syncLiveRoute(routeId: routeId) }
            },
            AdminFloatingAction(
                id: "showRouteQR",
                title: RiderStringsGenerated.text("admin.qr", language: language),
                systemImage: "qrcode",
                role: .secondary
            ) {
                qrRoute = route
            }
        ]
    }
}

private struct AdminLiveStopRow: View {
    let stop: AdminStop
    let isMutating: Bool
    let language: AppLanguage
    let onEdit: () -> Void
    let onDelete: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Text("\(stop.sequence)")
                .font(.caption.monospacedDigit())
                .frame(width: 28, height: 28)
                .background(ShuttleTheme.surface, in: Circle())

            VStack(alignment: .leading, spacing: 3) {
                Text(stop.title)
                    .foregroundStyle(stop.isPickupEnabled ? ShuttleTheme.text : ShuttleTheme.secondaryText)
                Text([stop.pickupTime ?? RiderStringsGenerated.text("admin.noPickupTime", language: language), stop.stopId.map { "#\($0)" }]
                    .compactMap { $0 }
                    .joined(separator: " · "))
                    .font(.caption)
                    .foregroundStyle(ShuttleTheme.secondaryText)
            }

            Spacer()

            if isMutating {
                ProgressView()
            } else {
                Menu {
                    Button(adminCopy(language, "Edit", "편집"), action: onEdit)
                    Button(adminCopy(language, "Delete", "삭제"), role: .destructive, action: onDelete)
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
                .buttonStyle(.borderless)
            }
        }
    }
}

private struct AdminLiveStopEditState: Identifiable {
    var id: String { "\(routeId)-\(stop.id)" }
    let routeId: String
    let stop: AdminStop
}

private struct AdminLiveStopEditSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Bindable var store: AdminStore
    let state: AdminLiveStopEditState
    let language: AppLanguage
    @State private var values: AdminEditableStopValues

    private var isSaving: Bool {
        store.isMutating(AdminMutationScope.liveStop(state.stop.id))
    }

    init(store: AdminStore, state: AdminLiveStopEditState, language: AppLanguage) {
        self.store = store
        self.state = state
        self.language = language
        self._values = State(initialValue: AdminEditableStopValues(
            displayName: state.stop.placeDisplayName ?? "",
            googlePlaceId: state.stop.googlePlaceId,
            stopId: state.stop.stopId ?? "",
            pickupTime: state.stop.pickupTime ?? "",
            notes: state.stop.routeStopNotes ?? "",
            isPickupEnabled: state.stop.isPickupEnabled,
            isTerminal: state.stop.isTerminal
        ))
    }

    var body: some View {
        NavigationStack {
            AdminStopForm(values: $values, originalName: state.stop.placeName, language: language)
                .navigationTitle(language == .ko ? "정류장 편집" : "Edit Stop")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { dismiss() }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button {
                            Task {
                                let saved = await store.saveLiveStop(
                                    routeId: state.routeId,
                                    stopId: state.stop.id,
                                    values: values
                                )
                                if saved {
                                    dismiss()
                                }
                            }
                        } label: {
                            AdminInlineProgressLabel(title: "Save", isLoading: isSaving)
                        }
                        .disabled(isSaving)
                    }
                }
                .adminFeedbackOverlay(store: store)
        }
    }
}

private struct AdminQRCodeSheet: View {
    @Environment(\.dismiss) private var dismiss
    let route: AdminRouteListItem
    let language: AppLanguage

    private var deeplink: String {
        "https://nasum-church-shuttle.vercel.app/scan?routeCode=\(route.routeCode)"
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 18) {
                Text(route.title)
                    .font(.headline)
                AdminQRCodeImage(text: deeplink)
                    .frame(width: 220, height: 220)
                    .padding()
                    .glassSurface(RoundedRectangle(cornerRadius: 24, style: .continuous))
                Text(adminCopy(language, "Share or copy the QR route link.", "QR 노선 링크를 공유하거나 복사하세요."))
                    .font(.footnote)
                    .foregroundStyle(ShuttleTheme.secondaryText)
                    .multilineTextAlignment(.center)
                HStack {
                    Button("Copy") {
                        UIPasteboard.general.string = deeplink
                    }
                    .buttonStyle(.bordered)
                    ShareLink(item: deeplink) {
                        Label("Share", systemImage: "square.and.arrow.up")
                    }
                    .buttonStyle(.borderedProminent)
                }
                Spacer()
            }
            .padding()
            .navigationTitle("QR")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }
}

private struct AdminQRCodeImage: View {
    let text: String

    var body: some View {
        if let image = makeQRCode(text) {
            Image(uiImage: image)
                .interpolation(.none)
                .resizable()
                .scaledToFit()
        } else {
            Image(systemName: "qrcode")
                .resizable()
                .scaledToFit()
        }
    }

    private func makeQRCode(_ text: String) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(text.utf8)
        guard let output = filter.outputImage else { return nil }
        let scaled = output.transformed(by: CGAffineTransform(scaleX: 10, y: 10))
        let context = CIContext()
        guard let cgImage = context.createCGImage(scaled, from: scaled.extent) else { return nil }
        return UIImage(cgImage: cgImage)
    }
}

struct AdminScheduleDetailView: View {
    @Bindable var store: AdminStore
    let scheduleId: String
    let language: AppLanguage
    @State private var showingAddRoute = false
    @State private var deleteConfirm = false

    private var schedule: AdminScheduleWithRouteDetails? { store.schedule?.id == scheduleId ? store.schedule : nil }

    private var incompleteCount: Int {
        schedule?.routes.reduce(0) { total, route in
            total + route.stopsSnapshot.filter {
                ($0.changeType == "updated" || $0.changeType == "added") && $0.isPickupEnabled && ($0.pickupTime ?? "").isEmpty
            }.count
        } ?? 0
    }

    var body: some View {
        List {
            if let schedule {
                if incompleteCount > 0 {
                    Section {
                        Label("\(language == .ko ? "탑승 시간 미입력" : "Missing pickup time"): \(incompleteCount)", systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(.orange)
                    }
                }

                Section(language == .ko ? "노선" : "Routes") {
                    ForEach(schedule.routes) { route in
                        NavigationLink {
                            AdminScheduleRouteDetailView(
                                store: store,
                                scheduleId: scheduleId,
                                routeId: route.routeId,
                                language: language
                            )
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(route.title)
                                    .font(.body.weight(.semibold))
                                Text("\(route.stopsSnapshot.count) stops · \(route.syncStatus)")
                                    .font(.footnote)
                                    .foregroundStyle(ShuttleTheme.secondaryText)
                            }
                        }
                    }
                }
            } else {
                AdminPlaceholderRows(count: 5)
            }
        }
        .navigationTitle(schedule?.name ?? "Schedule")
        .navigationBarTitleDisplayMode(.inline)
        .task { await store.loadSchedule(scheduleId) }
        .refreshable { await store.loadSchedule(scheduleId) }
        .sheet(isPresented: $showingAddRoute) {
            AdminAddRouteSheet(store: store, scheduleId: scheduleId, language: language)
        }
        .confirmationDialog(language == .ko ? "Draft를 폐기할까요?" : "Discard this draft?", isPresented: $deleteConfirm) {
            Button(language == .ko ? "폐기" : "Discard", role: .destructive) {
                Task { await store.deleteSchedule(scheduleId) }
            }
        }
        .adminFloatingActionBar(primary: schedulePrimaryAction, actions: scheduleSecondaryActions)
        .adminFeedbackOverlay(store: store)
    }

    private var schedulePrimaryAction: AdminFloatingAction? {
        guard schedule?.status == .draft else { return nil }
        return AdminFloatingAction(
            id: "publishSchedule",
            title: language == .ko ? "저장 & 배포" : "Save & Deploy",
            systemImage: "paperplane.fill",
            role: .primary,
            isLoading: store.isMutating(AdminMutationScope.publishSchedule(scheduleId)),
            isDisabled: incompleteCount > 0 || store.isMutating(AdminMutationScope.publishSchedule(scheduleId))
        ) {
            Task { await store.publishSchedule(scheduleId) }
        }
    }

    private var scheduleSecondaryActions: [AdminFloatingAction] {
        guard schedule?.status == .draft else { return [] }
        return [
            AdminFloatingAction(
                id: "syncSchedule",
                title: "Sync All",
                systemImage: "arrow.triangle.2.circlepath",
                role: .secondary,
                isLoading: store.isMutating(AdminMutationScope.syncSchedule(scheduleId)),
                isDisabled: store.isMutating(AdminMutationScope.syncSchedule(scheduleId))
            ) {
                Task { await store.syncSchedule(scheduleId) }
            },
            AdminFloatingAction(
                id: "addRoute",
                title: language == .ko ? "새 노선 추가" : "Add Route",
                systemImage: "plus",
                role: .secondary
            ) {
                showingAddRoute = true
            },
            AdminFloatingAction(
                id: "discardSchedule",
                title: language == .ko ? "폐기" : "Discard",
                systemImage: "trash",
                role: .destructive,
                isLoading: store.isMutating(AdminMutationScope.deleteSchedule(scheduleId)),
                isDisabled: store.isMutating(AdminMutationScope.deleteSchedule(scheduleId))
            ) {
                deleteConfirm = true
            }
        ]
    }
}

private struct AdminAddRouteSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Bindable var store: AdminStore
    let scheduleId: String
    let language: AppLanguage
    @State private var routeCode = ""
    @State private var line = ""
    @State private var service = ""
    @State private var mapsUrl = ""

    private var isAdding: Bool {
        store.isMutating(AdminMutationScope.addScheduleRoute(scheduleId))
    }

    var body: some View {
        NavigationStack {
            Form {
                TextField("Route code", text: $routeCode)
                TextField("Line", text: $line)
                TextField("Service", text: $service)
                TextField("Google Maps URL", text: $mapsUrl)
                    .textInputAutocapitalization(.never)
            }
            .navigationTitle(language == .ko ? "새 노선 추가" : "Add New Route")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task {
                            let added = await store.addScheduleRoute(
                                scheduleId: scheduleId,
                                routeCode: routeCode,
                                line: line,
                                service: service,
                                mapsUrl: mapsUrl
                            )
                            if added {
                                dismiss()
                            }
                        }
                    } label: {
                        AdminInlineProgressLabel(
                            title: language == .ko ? "추가" : "Add",
                            isLoading: isAdding
                        )
                    }
                    .disabled(isAdding || routeCode.nilIfBlank == nil || line.nilIfBlank == nil || service.nilIfBlank == nil || mapsUrl.nilIfBlank == nil)
                }
            }
            .adminFeedbackOverlay(store: store)
        }
    }
}

struct AdminScheduleRouteDetailView: View {
    @Bindable var store: AdminStore
    let scheduleId: String
    let routeId: String
    let language: AppLanguage
    @State private var routeValues = AdminEditableRouteValues()
    @State private var search = ""
    @State private var editingStop: AdminScheduleStopSnapshot?
    @State private var showingAddStop = false

    private var route: AdminScheduleRouteDetail? {
        store.schedule?.routes.first { $0.routeId == routeId }
    }

    private var filteredStops: [AdminScheduleStopSnapshot] {
        guard let route else { return [] }
        let q = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return route.stopsSnapshot.sorted { $0.sequence < $1.sequence } }
        return route.stopsSnapshot.filter {
            $0.title.lowercased().contains(q)
                || $0.googlePlaceId.lowercased().contains(q)
                || ($0.stopId ?? "").lowercased().contains(q)
        }
        .sorted { $0.sequence < $1.sequence }
    }

    var body: some View {
        List {
            if let route {
                Section(language == .ko ? "노선 정보" : "Route Info") {
                    Text(route.routeCode).font(.body.monospaced())
                    TextField(language == .ko ? "표시 이름" : "Display name", text: $routeValues.displayName)
                    TextField("Google Maps URL", text: $routeValues.googleMapsUrl)
                        .textInputAutocapitalization(.never)
                    Toggle(language == .ko ? "활성" : "Active", isOn: $routeValues.active)
                    LabeledContent(language == .ko ? "동기화 상태" : "Sync status", value: route.syncStatus)
                    if let syncError = route.syncError {
                        Text(syncError)
                            .foregroundStyle(ShuttleTheme.danger)
                    }
                }

                Section(language == .ko ? "정류장 목록" : "Stops") {
                    TextField(language == .ko ? "정류장 검색" : "Search stops", text: $search)
                    ForEach(filteredStops) { stop in
                        AdminScheduleStopRow(
                            stop: stop,
                            onEdit: { editingStop = stop },
                            onDelete: { Task { await store.deleteScheduleStop(scheduleId: scheduleId, routeId: routeId, sequence: stop.sequence) } },
                            onRestore: { Task { await store.restoreScheduleStop(scheduleId: scheduleId, routeId: routeId, sequence: stop.sequence) } },
                            onMoveUp: { Task { await store.moveScheduleStop(scheduleId: scheduleId, routeId: routeId, sequence: stop.sequence, target: max(1, stop.sequence - 1)) } },
                            onMoveDown: { Task { await store.moveScheduleStop(scheduleId: scheduleId, routeId: routeId, sequence: stop.sequence, target: stop.sequence + 1) } },
                            isMutating: store.isMutating(AdminMutationScope.scheduleStop(routeId, stop.sequence)),
                            language: language
                        )
                    }
                }
            } else {
                AdminPlaceholderRows(count: 6)
            }
        }
        .navigationTitle(route?.title ?? "Route")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await store.loadSchedule(scheduleId)
            if let route = route {
                routeValues = AdminEditableRouteValues(
                    displayName: route.displayName ?? "",
                    googleMapsUrl: route.googleMapsUrl ?? "",
                    active: route.active ?? true
                )
            }
        }
        .onChange(of: route?.routeId) { _, _ in
            if let route = route {
                routeValues = AdminEditableRouteValues(
                    displayName: route.displayName ?? "",
                    googleMapsUrl: route.googleMapsUrl ?? "",
                    active: route.active ?? true
                )
            }
        }
        .sheet(item: $editingStop) { stop in
            AdminScheduleStopEditSheet(
                store: store,
                scheduleId: scheduleId,
                routeId: routeId,
                stop: stop,
                language: language
            )
        }
        .sheet(isPresented: $showingAddStop) {
            AdminAddStopSheet(store: store, scheduleId: scheduleId, routeId: routeId, language: language)
        }
        .adminFloatingActionBar(primary: routePrimaryAction, actions: routeSecondaryActions)
        .adminFeedbackOverlay(store: store)
    }

    private var routePrimaryAction: AdminFloatingAction? {
        guard route != nil else { return nil }
        return AdminFloatingAction(
            id: "saveScheduleRoute",
            title: language == .ko ? "저장" : "Save",
            systemImage: "checkmark",
            role: .primary,
            isLoading: store.isMutating(AdminMutationScope.saveScheduleRoute(routeId)),
            isDisabled: store.isMutating(AdminMutationScope.saveScheduleRoute(routeId))
        ) {
            Task {
                await store.saveScheduleRoute(
                    scheduleId: scheduleId,
                    routeId: routeId,
                    values: routeValues
                )
            }
        }
    }

    private var routeSecondaryActions: [AdminFloatingAction] {
        guard route != nil else { return [] }
        return [
            AdminFloatingAction(
                id: "syncScheduleRoute",
                title: "Sync",
                systemImage: "arrow.triangle.2.circlepath",
                role: .secondary,
                isLoading: store.isMutating(AdminMutationScope.syncScheduleRoute(routeId)),
                isDisabled: store.isMutating(AdminMutationScope.syncScheduleRoute(routeId))
            ) {
                Task { await store.syncScheduleRoute(scheduleId: scheduleId, routeId: routeId) }
            },
            AdminFloatingAction(
                id: "addStop",
                title: language == .ko ? "정류장 추가" : "Add stop",
                systemImage: "plus",
                role: .secondary
            ) {
                showingAddStop = true
            }
        ]
    }
}

private struct AdminScheduleStopRow: View {
    let stop: AdminScheduleStopSnapshot
    let onEdit: () -> Void
    let onDelete: () -> Void
    let onRestore: () -> Void
    let onMoveUp: () -> Void
    let onMoveDown: () -> Void
    let isMutating: Bool
    let language: AppLanguage

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Text("\(stop.sequence)")
                .font(.caption.monospacedDigit())
                .frame(width: 28, height: 28)
                .background(ShuttleTheme.surface, in: Circle())
            VStack(alignment: .leading, spacing: 3) {
                Text(stop.title)
                    .strikethrough(stop.changeType == "removed")
                    .foregroundStyle(stop.changeType == "removed" ? ShuttleTheme.secondaryText : ShuttleTheme.text)
                Text([stop.pickupTime, stop.stopId.map { "#\($0)" }, stop.changeType].compactMap { $0 }.joined(separator: " · "))
                    .font(.caption)
                    .foregroundStyle(ShuttleTheme.secondaryText)
            }
            Spacer()
            if isMutating {
                ProgressView()
            } else {
                Menu {
                    if stop.changeType == "removed" {
                        Button(language == .ko ? "복원" : "Restore", action: onRestore)
                    } else {
                        Button(language == .ko ? "편집" : "Edit", action: onEdit)
                        Button("Move Up", action: onMoveUp)
                        Button("Move Down", action: onMoveDown)
                        Button(language == .ko ? "삭제" : "Delete", role: .destructive, action: onDelete)
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
                .buttonStyle(.borderless)
            }
        }
    }
}

private struct AdminScheduleStopEditSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Bindable var store: AdminStore
    let scheduleId: String
    let routeId: String
    let stop: AdminScheduleStopSnapshot
    let language: AppLanguage
    @State private var values: AdminEditableStopValues

    private var isSaving: Bool {
        store.isMutating(AdminMutationScope.scheduleStop(routeId, stop.sequence))
    }

    init(store: AdminStore, scheduleId: String, routeId: String, stop: AdminScheduleStopSnapshot, language: AppLanguage) {
        self.store = store
        self.scheduleId = scheduleId
        self.routeId = routeId
        self.stop = stop
        self.language = language
        self._values = State(initialValue: AdminEditableStopValues(
            displayName: stop.placeDisplayName ?? "",
            googlePlaceId: stop.googlePlaceId,
            stopId: stop.stopId ?? "",
            pickupTime: stop.pickupTime ?? "",
            notes: stop.notes ?? "",
            isPickupEnabled: stop.isPickupEnabled,
            isTerminal: stop.isTerminal
        ))
    }

    var body: some View {
        NavigationStack {
            AdminStopForm(values: $values, originalName: stop.placeName, language: language)
                .navigationTitle(language == .ko ? "정류장 편집" : "Edit Stop")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { dismiss() }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button {
                            Task {
                                let saved = await store.saveScheduleStop(
                                    scheduleId: scheduleId,
                                    routeId: routeId,
                                    sequence: stop.sequence,
                                    values: values
                                )
                                if saved {
                                    dismiss()
                                }
                            }
                        } label: {
                            AdminInlineProgressLabel(title: "Save", isLoading: isSaving)
                        }
                        .disabled(isSaving)
                    }
                }
                .adminFeedbackOverlay(store: store)
        }
    }
}

private struct AdminAddStopSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Bindable var store: AdminStore
    let scheduleId: String
    let routeId: String
    let language: AppLanguage
    @State private var mode: AddStopMode = .search
    @State private var query = ""
    @State private var selected: AdminStopCandidateItem?
    @State private var googlePlaceId = ""
    @State private var displayName = ""
    @State private var stopId = ""
    @State private var isTerminal = false

    private var isAdding: Bool {
        store.isMutating(AdminMutationScope.addScheduleStop(routeId))
    }

    var body: some View {
        NavigationStack {
            Form {
                Picker("", selection: $mode) {
                    Text(language == .ko ? "기존 정류장" : "Existing").tag(AddStopMode.search)
                    Text(language == .ko ? "Place ID" : "Place ID").tag(AddStopMode.placeId)
                }
                .pickerStyle(.segmented)

                if mode == .search {
                    TextField(language == .ko ? "기존 정류장 검색" : "Search existing stops", text: $query)
                        .onSubmit { Task { await store.loadCandidates(scheduleId: scheduleId, routeId: routeId, query: query) } }
                    Button {
                        Task { await store.loadCandidates(scheduleId: scheduleId, routeId: routeId, query: query) }
                    } label: {
                        AdminInlineProgressLabel(
                            title: "Search",
                            systemImage: "magnifyingglass",
                            isLoading: store.isLoading(.candidates)
                        )
                    }
                    .disabled(store.isLoading(.candidates))
                    if store.isLoading(.candidates) && store.candidates.isEmpty {
                        AdminPlaceholderRows(count: 3)
                    }
                    ForEach(store.candidates) { candidate in
                        Button {
                            selected = candidate
                        } label: {
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(candidate.title)
                                    Text(candidate.formattedAddress ?? candidate.googlePlaceId)
                                        .font(.caption)
                                        .foregroundStyle(ShuttleTheme.secondaryText)
                                }
                                Spacer()
                                if candidate.alreadyInRoute {
                                    Text(language == .ko ? "이미 추가됨" : "Already in route")
                                        .font(.caption)
                                } else if selected?.id == candidate.id {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(ShuttleTheme.primary)
                                }
                            }
                        }
                        .disabled(candidate.alreadyInRoute)
                    }
                } else {
                    TextField("Google Place ID", text: $googlePlaceId)
                        .textInputAutocapitalization(.never)
                    TextField(language == .ko ? "표시 이름" : "Display name", text: $displayName)
                    TextField(language == .ko ? "정류장 ID" : "Stop ID", text: $stopId)
                    Toggle(language == .ko ? "종점" : "Terminal", isOn: $isTerminal)
                }
            }
            .navigationTitle(language == .ko ? "정류장 추가" : "Add stop")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task {
                            let added: Bool
                            if mode == .search, let selected {
                                added = await store.addScheduleStop(scheduleId: scheduleId, routeId: routeId, candidate: selected)
                            } else {
                                added = await store.addScheduleStopByPlaceId(
                                    scheduleId: scheduleId,
                                    routeId: routeId,
                                    googlePlaceId: googlePlaceId,
                                    displayName: displayName,
                                    stopId: stopId,
                                    isTerminal: isTerminal
                                )
                            }
                            if added {
                                dismiss()
                            }
                        }
                    } label: {
                        AdminInlineProgressLabel(
                            title: language == .ko ? "추가" : "Add",
                            isLoading: isAdding
                        )
                    }
                    .disabled(isAdding || (mode == .search ? selected == nil : googlePlaceId.nilIfBlank == nil))
                }
            }
            .adminFeedbackOverlay(store: store)
        }
    }

    private enum AddStopMode: String, CaseIterable, Identifiable {
        case search
        case placeId
        var id: String { rawValue }
    }
}

private struct AdminStopForm: View {
    @Binding var values: AdminEditableStopValues
    let originalName: String
    let language: AppLanguage

    var body: some View {
        Form {
            Section(language == .ko ? "정류장 정보" : "Stop info") {
                LabeledContent("Google name", value: originalName)
                TextField(language == .ko ? "표시 이름" : "Display name", text: $values.displayName)
                TextField("Google Place ID", text: $values.googlePlaceId)
                    .textInputAutocapitalization(.never)
                TextField(language == .ko ? "버스 정류소 ID" : "Bus stop ID", text: $values.stopId)
                Toggle(language == .ko ? "최종 목적지" : "Terminal stop", isOn: $values.isTerminal)
            }
            Section(language == .ko ? "노선 설정" : "Route settings") {
                TextField(language == .ko ? "탑승 시간" : "Pickup time", text: $values.pickupTime)
                TextField(language == .ko ? "노선 메모" : "Route notes", text: $values.notes, axis: .vertical)
                    .lineLimit(2...4)
                Toggle(language == .ko ? "탑승 활성" : "Pickup enabled", isOn: $values.isPickupEnabled)
            }
        }
    }
}

private struct AdminRunResultView: View {
    @Environment(\.dismiss) private var dismiss
    let result: AdminRunResult
    let title: String
    let language: AppLanguage

    var body: some View {
        NavigationStack {
            List {
                Section {
                    LabeledContent(
                        RiderStringsGenerated.text("admin.boardingCount", language: language, values: ["count": "\(totalPassengers)"]),
                        value: title
                    )
                }
                ForEach(result.stopResults) { stop in
                    Section(stop.stopName ?? stop.routeStopId) {
                        LabeledContent("Status", value: stop.status)
                        LabeledContent("Boarded", value: "\(stop.totalPassengers)")
                        if stop.riders.isEmpty {
                            Text("No riders")
                                .foregroundStyle(ShuttleTheme.secondaryText)
                        } else {
                            ForEach(stop.riders) { rider in
                                HStack {
                                    AdminAvatar(urlString: rider.pictureUrl, fallback: rider.displayName ?? rider.userId)
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(rider.displayName ?? rider.userId)
                                        Text("\(formatAdminDate(rider.scannedAt)) · +\(rider.additionalPassengers)")
                                            .font(.caption)
                                            .foregroundStyle(ShuttleTheme.secondaryText)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }

    private var totalPassengers: Int {
        result.stopResults.reduce(0) { $0 + $1.totalPassengers }
    }
}

private struct AdminAvatar: View {
    let urlString: String?
    let fallback: String

    var body: some View {
        Group {
            if let urlString, let url = URL(string: urlString) {
                AsyncImage(url: url) { phase in
                    if case let .success(image) = phase {
                        image.resizable().scaledToFill()
                    } else {
                        fallbackView
                    }
                }
            } else {
                fallbackView
            }
        }
        .frame(width: 34, height: 34)
        .clipShape(Circle())
    }

    private var fallbackView: some View {
        ZStack {
            Circle().fill(ShuttleTheme.primary.opacity(0.14))
            Text(String(fallback.prefix(1)).uppercased())
                .font(.footnote.weight(.bold))
                .foregroundStyle(ShuttleTheme.primary)
        }
    }
}

private func groupedRows<Key: Hashable>(
    _ rows: [AdminRegistrationRow],
    by keyPath: KeyPath<AdminRegistrationRow, Key>
) -> [(key: Key, rows: [AdminRegistrationRow])] {
    Dictionary(grouping: rows, by: { $0[keyPath: keyPath] })
        .map { (key: $0.key, rows: $0.value) }
        .sorted { "\($0.key)" < "\($1.key)" }
}

private func formatAdminDate(_ value: String?) -> String {
    guard let value, !value.isEmpty else { return "-" }
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let date = formatter.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    guard let date else { return value }
    return date.formatted(date: .abbreviated, time: .shortened)
}
