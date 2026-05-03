import Foundation
import Observation

@MainActor
@Observable
final class AdminStore {
    let apiClient: APIClient

    private(set) var loadingScopes: Set<String> = []
    private(set) var mutatingScopes: Set<String> = []
    private var feedbackDismissTask: Task<Void, Never>?

    var feedbackMessage: AdminFeedbackMessage?
    var language: AppLanguage = .ko

    var isLoading: Bool { !loadingScopes.isEmpty }
    var isMutating: Bool { !mutatingScopes.isEmpty }

    var routeSummaries: [RouteSummary] = []
    var activeRuns: [String: AdminRun] = [:]
    var runHistory: [AdminRun] = []
    var autoRunConfig = AdminAutoRunConfig(
        enabled: false,
        daysOfWeek: [0],
        startTime: "08:00",
        endTime: "12:00",
        updatedAt: nil
    )
    var registrations: [AdminRegistrationRow] = []
    var users: [AdminPrivilegedUser] = []
    var routeBundle = AdminRouteBundle(routes: [], schedules: [], liveRoutes: [])
    var schedule: AdminScheduleWithRouteDetails?
    var routeStops: [String: [AdminStop]] = [:]
    var places: [AdminPlaceListItem] = []
    var placeDetails: [String: AdminPlaceDetail] = [:]
    var placeDuplicates: [String: [AdminPlaceListItem]] = [:]
    var candidates: [AdminStopCandidateItem] = []

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    func isLoading(_ scope: AdminLoadingScope) -> Bool {
        loadingScopes.contains(scope.rawValue)
    }

    func isMutating(_ scope: String) -> Bool {
        mutatingScopes.contains(scope)
    }

    @discardableResult
    func loadCatching(_ scope: AdminLoadingScope, _ operation: @escaping () async throws -> Void) async -> Bool {
        loadingScopes.insert(scope.rawValue)
        defer { loadingScopes.remove(scope.rawValue) }
        do {
            try await operation()
            return true
        } catch {
            handle(error)
            return false
        }
    }

    @discardableResult
    func runCatching(_ scope: String = AdminMutationScope.general, _ operation: @escaping () async throws -> Void) async -> Bool {
        mutatingScopes.insert(scope)
        defer { mutatingScopes.remove(scope) }
        do {
            try await operation()
            return true
        } catch {
            handle(error)
            return false
        }
    }

    func clearFeedback() {
        feedbackDismissTask?.cancel()
        feedbackDismissTask = nil
        feedbackMessage = nil
    }

    func showFeedback(_ message: AdminFeedbackMessage) {
        feedbackDismissTask?.cancel()
        feedbackMessage = message

        guard let duration = message.duration else { return }

        let currentId = message.id
        feedbackDismissTask = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(duration * 1_000_000_000))
            guard let self, self.feedbackMessage?.id == currentId else { return }
            self.feedbackMessage = nil
        }
    }

    private func localized(_ key: String, values: [String: String] = [:]) -> String {
        RiderStringsGenerated.text(key, language: language, values: values)
    }

    private func showSuccess(_ key: String, values: [String: String] = [:], body: String? = nil, refresh: (() async -> Void)? = nil) {
        showFeedback(AdminFeedbackMessage(style: .success, title: localized(key, values: values), body: body, duration: 2.4))
        guard let refresh else { return }
        Task { @MainActor in
            await Task.yield()
            await refresh()
        }
    }

    private func showInfo(_ key: String, values: [String: String] = [:], body: String? = nil) {
        showFeedback(AdminFeedbackMessage(style: .info, title: localized(key, values: values), body: body, duration: 2.8))
    }

    private func routeLabel(for routeCode: String) -> String? {
        routeSummaries.first { $0.routeCode == routeCode }?.label
    }

    private func handle(_ error: Error) {
        if error is CancellationError {
            return
        }
        let nsError = error as NSError
        if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled {
            return
        }
        if case APIError.unauthorized = error {
            return
        }
        showFeedback(AdminFeedbackMessage(style: .error, title: localized("admin.feedbackError"), duration: 4.5))
    }

    func loadRuns() async {
        await loadCatching(.runs) {
            async let routesTask = self.apiClient.fetchRouteSummaries()
            async let activeRunsTask = self.apiClient.fetchAdminRuns(status: "active")

            let routes = try await routesTask
            let activeRuns = try await activeRunsTask

            self.routeSummaries = routes
            self.activeRuns = Dictionary(
                uniqueKeysWithValues: activeRuns.compactMap { run in
                    guard let routeCode = run.routeCode else { return nil }
                    return (routeCode, run)
                }
            )
        }
    }

    func loadRunHistory() async {
        await loadCatching(.runHistory) {
            self.runHistory = Array(try await self.apiClient.fetchAdminRuns(status: "completed").prefix(10))
        }
    }

    func loadAutoRunConfig() async {
        await loadCatching(.autoRunConfig) {
            self.autoRunConfig = try await self.apiClient.fetchAdminAutoRunConfig()
        }
    }

    func startRun(routeCode: String) async {
        let started = await runCatching(AdminMutationScope.startRun(routeCode)) {
            _ = try await self.apiClient.createAdminRun(routeCode: routeCode)
        }
        if started {
            showSuccess("admin.runStarted", body: routeLabel(for: routeCode)) {
                await self.loadRuns()
            }
        }
    }

    func startAllRuns() async {
        let idleRoutes = routeSummaries.filter { activeRuns[$0.routeCode] == nil }
        guard !idleRoutes.isEmpty else {
            showInfo("admin.noRunsToStart")
            return
        }

        let started = await runCatching(AdminMutationScope.startAllRuns) {
            try await withThrowingTaskGroup(of: Void.self) { group in
                for route in idleRoutes {
                    group.addTask {
                        _ = try await self.apiClient.createAdminRun(routeCode: route.routeCode)
                    }
                }
                try await group.waitForAll()
            }
        }
        if started {
            showSuccess(
                "admin.allRunsStarted",
                body: localized("admin.routeCount", values: ["count": "\(idleRoutes.count)"])
            ) {
                await self.loadRuns()
            }
        }
    }

    func endRun(_ run: AdminRun) async {
        let ended = await runCatching(AdminMutationScope.endRun(run.id)) {
            _ = try await self.apiClient.endAdminRun(runId: run.id)
        }
        if ended {
            showSuccess(
                "admin.runEnded",
                body: run.routeCode.flatMap { routeLabel(for: $0) }
            ) {
                await self.loadRuns()
                await self.loadRunHistory()
            }
        }
    }

    @discardableResult
    func overrideStop(runId: String, stopId: String, status: String, passengerOverride: Int?) async -> Bool {
        let saved = await runCatching(AdminMutationScope.stopOverride(runId, stopId)) {
            _ = try await self.apiClient.updateAdminStopOverride(
                runId: runId,
                stopId: stopId,
                status: status,
                passengerOverride: passengerOverride
            )
        }
        if saved {
            showSuccess("admin.stopOverrideSaved") {
                await self.loadRuns()
            }
        }
        return saved
    }

    @discardableResult
    func resetStopOverride(runId: String, stopId: String) async -> Bool {
        let reset = await runCatching(AdminMutationScope.stopOverride(runId, stopId)) {
            _ = try await self.apiClient.updateAdminStopOverride(
                runId: runId,
                stopId: stopId,
                status: nil,
                passengerOverride: nil,
                reset: true
            )
        }
        if reset {
            showSuccess("admin.stopOverrideReset") {
                await self.loadRuns()
            }
        }
        return reset
    }

    func saveAutoRunConfig(_ config: AdminAutoRunConfig) async {
        let saved = await runCatching(AdminMutationScope.autoRunConfig) {
            self.autoRunConfig = try await self.apiClient.updateAdminAutoRunConfig(
                AdminAutoRunUpdateRequest(
                    enabled: config.enabled,
                    daysOfWeek: config.daysOfWeek,
                    startTime: config.startTime,
                    endTime: config.endTime
                )
            )
        }
        if saved {
            showSuccess("admin.scheduleSaved")
        }
    }

    func loadRegistrations(status: AdminRegistrationStatus) async {
        await loadCatching(.registrations) {
            self.registrations = try await self.apiClient.fetchAdminRegistrations(status: status)
        }
    }

    func deleteRegistration(_ id: String, status: AdminRegistrationStatus) async {
        let deleted = await runCatching(AdminMutationScope.registration(id)) {
            _ = try await self.apiClient.deleteAdminRegistration(registrationId: id)
            await self.loadRegistrations(status: status)
        }
        if deleted {
            showSuccess("admin.registrationDeleted")
        }
    }

    func loadUsers() async {
        await loadCatching(.users) {
            self.users = try await self.apiClient.fetchAdminUsers()
        }
    }

    func assignUser(providerUid: String, provider: AdminProvider, role: UserRole) async {
        let assigned = await runCatching(AdminMutationScope.assignUser) {
            _ = try await self.apiClient.assignAdminUser(
                providerUid: providerUid,
                provider: provider,
                role: role
            )
            await self.loadUsers()
        }
        if assigned {
            let roleLabel = role == .admin
                ? localized("admin.roleAdmin")
                : localized("admin.roleDriver")
            showSuccess("admin.roleAssigned", body: "\(provider.label) · \(roleLabel)")
        }
    }

    func revokeUser(_ userId: String) async {
        let revoked = await runCatching(AdminMutationScope.revokeUser(userId)) {
            _ = try await self.apiClient.revokeAdminUser(userId: userId)
            await self.loadUsers()
        }
        if revoked {
            showSuccess("admin.roleRevoked")
        }
    }

    func loadRouteBundle() async {
        await loadCatching(.routeBundle) {
            async let routes = self.apiClient.fetchAdminRoutes()
            async let schedules = self.apiClient.fetchAdminSchedules()
            async let liveRoutes = self.apiClient.fetchAdminLiveRoutes()
            self.routeBundle = try await AdminRouteBundle(
                routes: routes,
                schedules: schedules,
                liveRoutes: liveRoutes
            )
        }
    }

    func loadRouteStops(routeId: String) async {
        await loadCatching(.routeStops) {
            self.routeStops[routeId] = try await self.apiClient.fetchAdminRouteStops(routeId: routeId)
        }
    }

    func loadPlaces(query: String = "", duplicatesOnly: Bool = false) async {
        await loadCatching(.places) {
            self.places = try await self.apiClient
                .fetchAdminPlaces(query: query, duplicatesOnly: duplicatesOnly)
                .items
        }
    }

    func loadPlaceDetail(_ placeId: String) async {
        await loadCatching(.placeDetail) {
            self.placeDetails[placeId] = try await self.apiClient.fetchAdminPlace(placeId: placeId)
        }
    }

    func loadPlaceDuplicates(_ placeId: String) async {
        await loadCatching(.placeDuplicates) {
            self.placeDuplicates[placeId] = try await self.apiClient.fetchAdminPlaceDuplicates(placeId: placeId).items
        }
    }

    @discardableResult
    func savePlace(_ placeId: String, values: AdminEditablePlaceValues) async -> Bool {
        let saved = await runCatching(AdminMutationScope.savePlace(placeId)) {
            _ = try await self.apiClient.updateAdminPlace(
                placeId: placeId,
                request: AdminPlacePatchRequest(
                    displayName: values.displayName.nilIfBlank,
                    notes: values.notes.nilIfBlank,
                    isTerminal: values.isTerminal,
                    stopId: values.stopId.nilIfBlank
                )
            )
            await self.loadPlaceDetail(placeId)
            await self.loadPlaceDuplicates(placeId)
            await self.loadPlaces()
        }
        if saved {
            showSuccess("admin.placeSaved")
        }
        return saved
    }

    @discardableResult
    func mergePlace(canonicalPlaceId: String, duplicatePlaceId: String) async -> Bool {
        let scope = AdminMutationScope.mergePlace(canonicalPlaceId, duplicatePlaceId)
        mutatingScopes.insert(scope)
        defer { mutatingScopes.remove(scope) }

        do {
            _ = try await apiClient.mergeAdminPlace(placeId: canonicalPlaceId, duplicatePlaceId: duplicatePlaceId)
            await loadPlaceDetail(canonicalPlaceId)
            await loadPlaceDuplicates(canonicalPlaceId)
            await loadPlaces()
            await loadRouteBundle()
            showSuccess("admin.placeMerged")
            return true
        } catch let APIError.status(code, message) where code == 409 {
            showFeedback(AdminFeedbackMessage(
                style: .error,
                title: localized("admin.placeMergeConflict"),
                body: message,
                duration: 5.5
            ))
            return false
        } catch {
            handle(error)
            return false
        }
    }

    func saveLiveRoute(routeId: String, values: AdminEditableRouteValues) async {
        let saved = await runCatching(AdminMutationScope.saveLiveRoute(routeId)) {
            _ = try await self.apiClient.updateAdminRoute(
                routeId: routeId,
                request: AdminRouteUpdateRequest(
                    displayName: values.displayName.nilIfBlank,
                    googleMapsUrl: values.googleMapsUrl.nilIfBlank,
                    active: values.active
                )
            )
            await self.loadRouteBundle()
        }
        if saved {
            showSuccess("admin.routeSaved")
        }
    }

    func syncLiveRoute(routeId: String) async {
        let synced = await runCatching(AdminMutationScope.syncLiveRoute(routeId)) {
            _ = try await self.apiClient.syncAdminRoute(routeId: routeId)
            await self.loadRouteBundle()
            await self.loadRouteStops(routeId: routeId)
        }
        if synced {
            showSuccess("admin.routeSynced")
        }
    }

    func deleteLiveStop(routeId: String, stopId: String) async {
        let deleted = await runCatching(AdminMutationScope.deleteLiveStop(stopId)) {
            _ = try await self.apiClient.deleteAdminRouteStop(routeId: routeId, stopId: stopId)
            await self.loadRouteStops(routeId: routeId)
            await self.loadRouteBundle()
        }
        if deleted {
            showSuccess("admin.stopDeleted")
        }
    }

    func createSchedule() async -> String? {
        var createdId: String?
        let created = await runCatching(AdminMutationScope.createSchedule) {
            let response = try await self.apiClient.createAdminSchedule()
            createdId = response.id ?? response.draft?.id
            await self.loadRouteBundle()
        }
        if created {
            showSuccess("admin.scheduleCreated")
        }
        if createdId == nil {
            createdId = routeBundle.schedules.first(where: { $0.status == .draft })?.id
        }
        return createdId
    }

    func restoreSchedule(_ scheduleId: String) async {
        let restored = await runCatching(AdminMutationScope.restoreSchedule(scheduleId)) {
            _ = try await self.apiClient.restoreAdminSchedule(scheduleId: scheduleId)
            await self.loadRouteBundle()
        }
        if restored {
            showSuccess("admin.scheduleRestored")
        }
    }

    @discardableResult
    func saveLiveStop(routeId: String, stopId: String, values: AdminEditableStopValues) async -> Bool {
        let saved = await runCatching(AdminMutationScope.liveStop(stopId)) {
            _ = try await self.apiClient.updateAdminRouteStopFull(
                routeId: routeId,
                stopId: stopId,
                request: AdminRouteStopFullUpdateRequest(
                    sequence: nil,
                    pickupTime: values.pickupTime.nilIfBlank,
                    notes: values.notes.nilIfBlank,
                    isPickupEnabled: values.isPickupEnabled,
                    displayName: values.displayName.nilIfBlank,
                    placeNotes: nil,
                    googlePlaceId: values.googlePlaceId.nilIfBlank,
                    isTerminal: values.isTerminal,
                    stopId: values.stopId.nilIfBlank
                )
            )
            await self.loadRouteStops(routeId: routeId)
            await self.loadRouteBundle()
        }
        if saved {
            showSuccess("admin.stopSaved")
        }
        return saved
    }

    func loadSchedule(_ scheduleId: String) async {
        await loadCatching(.schedule) {
            self.schedule = try await self.apiClient.fetchAdminSchedule(scheduleId: scheduleId)
        }
    }

    func deleteSchedule(_ scheduleId: String) async {
        let deleted = await runCatching(AdminMutationScope.deleteSchedule(scheduleId)) {
            _ = try await self.apiClient.deleteAdminSchedule(scheduleId: scheduleId)
            self.schedule = nil
            await self.loadRouteBundle()
        }
        if deleted {
            showSuccess("admin.scheduleDiscarded")
        }
    }

    func syncSchedule(_ scheduleId: String) async {
        let synced = await runCatching(AdminMutationScope.syncSchedule(scheduleId)) {
            _ = try await self.apiClient.syncAdminSchedule(scheduleId: scheduleId)
            await self.loadSchedule(scheduleId)
        }
        if synced {
            showSuccess("admin.scheduleSynced")
        }
    }

    func publishSchedule(_ scheduleId: String) async {
        let published = await runCatching(AdminMutationScope.publishSchedule(scheduleId)) {
            _ = try await self.apiClient.publishAdminSchedule(scheduleId: scheduleId)
            await self.loadRouteBundle()
        }
        if published {
            showSuccess("admin.schedulePublished")
        }
    }

    @discardableResult
    func addScheduleRoute(scheduleId: String, routeCode: String, line: String, service: String, mapsUrl: String) async -> Bool {
        let added = await runCatching(AdminMutationScope.addScheduleRoute(scheduleId)) {
            _ = try await self.apiClient.addAdminScheduleRoute(
                scheduleId: scheduleId,
                request: AdminScheduleRouteCreateRequest(
                    routeCode: routeCode,
                    line: line,
                    service: service,
                    googleMapsUrl: mapsUrl
                )
            )
            await self.loadSchedule(scheduleId)
        }
        if added {
            showSuccess("admin.routeAdded")
        }
        return added
    }

    func saveScheduleRoute(scheduleId: String, routeId: String, values: AdminEditableRouteValues) async {
        let saved = await runCatching(AdminMutationScope.saveScheduleRoute(routeId)) {
            _ = try await self.apiClient.updateAdminRoute(
                routeId: routeId,
                request: AdminRouteUpdateRequest(
                    displayName: values.displayName.nilIfBlank,
                    googleMapsUrl: values.googleMapsUrl.nilIfBlank,
                    active: values.active
                )
            )
            await self.loadSchedule(scheduleId)
        }
        if saved {
            showSuccess("admin.routeSaved")
        }
    }

    func syncScheduleRoute(scheduleId: String, routeId: String) async {
        let synced = await runCatching(AdminMutationScope.syncScheduleRoute(routeId)) {
            _ = try await self.apiClient.syncAdminScheduleRoute(scheduleId: scheduleId, routeId: routeId)
            await self.loadSchedule(scheduleId)
        }
        if synced {
            showSuccess("admin.routeSynced")
        }
    }

    @discardableResult
    func saveScheduleStop(scheduleId: String, routeId: String, sequence: Int, values: AdminEditableStopValues) async -> Bool {
        let saved = await runCatching(AdminMutationScope.scheduleStop(routeId, sequence)) {
            _ = try await self.apiClient.updateAdminScheduleStop(
                scheduleId: scheduleId,
                routeId: routeId,
                sequence: sequence,
                request: AdminScheduleStopPatchRequest(
                    pickupTime: values.pickupTime.nilIfBlank,
                    notes: values.notes.nilIfBlank,
                    isPickupEnabled: values.isPickupEnabled,
                    displayName: values.displayName.nilIfBlank,
                    placeNotes: nil,
                    googlePlaceId: values.googlePlaceId.nilIfBlank,
                    isTerminal: values.isTerminal,
                    stopId: values.stopId.nilIfBlank,
                    restore: nil,
                    moveToSequence: nil
                )
            )
            await self.loadSchedule(scheduleId)
        }
        if saved {
            showSuccess("admin.stopSaved")
        }
        return saved
    }

    func deleteScheduleStop(scheduleId: String, routeId: String, sequence: Int) async {
        let deleted = await runCatching(AdminMutationScope.scheduleStop(routeId, sequence)) {
            _ = try await self.apiClient.deleteAdminScheduleStop(scheduleId: scheduleId, routeId: routeId, sequence: sequence)
            await self.loadSchedule(scheduleId)
        }
        if deleted {
            showSuccess("admin.stopDeleted")
        }
    }

    func restoreScheduleStop(scheduleId: String, routeId: String, sequence: Int) async {
        let restored = await runCatching(AdminMutationScope.scheduleStop(routeId, sequence)) {
            _ = try await self.apiClient.updateAdminScheduleStop(
                scheduleId: scheduleId,
                routeId: routeId,
                sequence: sequence,
                request: AdminScheduleStopPatchRequest(
                    pickupTime: nil,
                    notes: nil,
                    isPickupEnabled: nil,
                    displayName: nil,
                    placeNotes: nil,
                    googlePlaceId: nil,
                    isTerminal: nil,
                    stopId: nil,
                    restore: true,
                    moveToSequence: nil
                )
            )
            await self.loadSchedule(scheduleId)
        }
        if restored {
            showSuccess("admin.stopRestored")
        }
    }

    func moveScheduleStop(scheduleId: String, routeId: String, sequence: Int, target: Int) async {
        let moved = await runCatching(AdminMutationScope.scheduleStop(routeId, sequence)) {
            _ = try await self.apiClient.updateAdminScheduleStop(
                scheduleId: scheduleId,
                routeId: routeId,
                sequence: sequence,
                request: AdminScheduleStopPatchRequest(
                    pickupTime: nil,
                    notes: nil,
                    isPickupEnabled: nil,
                    displayName: nil,
                    placeNotes: nil,
                    googlePlaceId: nil,
                    isTerminal: nil,
                    stopId: nil,
                    restore: nil,
                    moveToSequence: target
                )
            )
            await self.loadSchedule(scheduleId)
        }
        if moved {
            showSuccess("admin.stopReordered")
        }
    }

    func loadCandidates(scheduleId: String, routeId: String, query: String) async {
        await loadCatching(.candidates) {
            self.candidates = try await self.apiClient
                .fetchAdminScheduleStopCandidates(scheduleId: scheduleId, routeId: routeId, query: query)
                .items
        }
    }

    @discardableResult
    func addScheduleStop(scheduleId: String, routeId: String, candidate: AdminStopCandidateItem) async -> Bool {
        let added = await runCatching(AdminMutationScope.addScheduleStop(routeId)) {
            _ = try await self.apiClient.addAdminScheduleStop(
                scheduleId: scheduleId,
                routeId: routeId,
                request: AdminScheduleStopCreateRequest(
                    googlePlaceId: candidate.googlePlaceId,
                    placeName: candidate.name,
                    displayName: candidate.displayName,
                    formattedAddress: candidate.formattedAddress,
                    lat: candidate.lat,
                    lng: candidate.lng,
                    placeTypes: candidate.placeTypes,
                    placeNotes: candidate.notes,
                    isTerminal: candidate.isTerminal,
                    stopId: candidate.stopId,
                    isPickupEnabled: true
                )
            )
            await self.loadSchedule(scheduleId)
        }
        if added {
            showSuccess("admin.stopAdded", body: candidate.title)
        }
        return added
    }

    @discardableResult
    func addScheduleStopByPlaceId(
        scheduleId: String,
        routeId: String,
        googlePlaceId: String,
        displayName: String,
        stopId: String,
        isTerminal: Bool
    ) async -> Bool {
        let added = await runCatching(AdminMutationScope.addScheduleStop(routeId)) {
            _ = try await self.apiClient.fetchAdminPlaceLookup(googlePlaceId: googlePlaceId)
            _ = try await self.apiClient.addAdminScheduleStop(
                scheduleId: scheduleId,
                routeId: routeId,
                request: AdminScheduleStopCreateRequest(
                    googlePlaceId: googlePlaceId,
                    placeName: nil,
                    displayName: displayName.nilIfBlank,
                    formattedAddress: nil,
                    lat: nil,
                    lng: nil,
                    placeTypes: nil,
                    placeNotes: nil,
                    isTerminal: isTerminal,
                    stopId: stopId.nilIfBlank,
                    isPickupEnabled: true
                )
            )
            await self.loadSchedule(scheduleId)
        }
        if added {
            showSuccess("admin.stopAdded")
        }
        return added
    }
}

enum AdminLoadingScope: String {
    case runs
    case runHistory
    case autoRunConfig
    case registrations
    case users
    case routeBundle
    case routeStops
    case places
    case placeDetail
    case placeDuplicates
    case schedule
    case candidates
}

enum AdminMutationScope {
    static let general = "general"
    static let startAllRuns = "startAllRuns"
    static let autoRunConfig = "autoRunConfig"
    static let assignUser = "assignUser"
    static let createSchedule = "createSchedule"

    static func startRun(_ routeCode: String) -> String { "startRun:\(routeCode)" }
    static func endRun(_ runId: String) -> String { "endRun:\(runId)" }
    static func stopOverride(_ runId: String, _ stopId: String) -> String { "stopOverride:\(runId):\(stopId)" }
    static func registration(_ id: String) -> String { "registration:\(id)" }
    static func revokeUser(_ userId: String) -> String { "revokeUser:\(userId)" }
    static func restoreSchedule(_ scheduleId: String) -> String { "restoreSchedule:\(scheduleId)" }
    static func liveStop(_ stopId: String) -> String { "liveStop:\(stopId)" }
    static func saveLiveRoute(_ routeId: String) -> String { "saveLiveRoute:\(routeId)" }
    static func syncLiveRoute(_ routeId: String) -> String { "syncLiveRoute:\(routeId)" }
    static func deleteLiveStop(_ stopId: String) -> String { "deleteLiveStop:\(stopId)" }
    static func savePlace(_ placeId: String) -> String { "savePlace:\(placeId)" }
    static func mergePlace(_ canonicalPlaceId: String, _ duplicatePlaceId: String) -> String { "mergePlace:\(canonicalPlaceId):\(duplicatePlaceId)" }
    static func deleteSchedule(_ scheduleId: String) -> String { "deleteSchedule:\(scheduleId)" }
    static func syncSchedule(_ scheduleId: String) -> String { "syncSchedule:\(scheduleId)" }
    static func publishSchedule(_ scheduleId: String) -> String { "publishSchedule:\(scheduleId)" }
    static func addScheduleRoute(_ scheduleId: String) -> String { "addScheduleRoute:\(scheduleId)" }
    static func saveScheduleRoute(_ routeId: String) -> String { "saveScheduleRoute:\(routeId)" }
    static func syncScheduleRoute(_ routeId: String) -> String { "syncScheduleRoute:\(routeId)" }
    static func scheduleStop(_ routeId: String, _ sequence: Int) -> String { "scheduleStop:\(routeId):\(sequence)" }
    static func addScheduleStop(_ routeId: String) -> String { "addScheduleStop:\(routeId)" }
}

struct AdminEditableStopValues: Equatable {
    var displayName = ""
    var googlePlaceId = ""
    var stopId = ""
    var pickupTime = ""
    var notes = ""
    var isPickupEnabled = true
    var isTerminal = false
}

struct AdminEditablePlaceValues: Equatable {
    var displayName = ""
    var stopId = ""
    var notes = ""
    var isTerminal = false
}

struct AdminEditableRouteValues: Equatable {
    var displayName = ""
    var googleMapsUrl = ""
    var active = true
}

extension String {
    var nilIfBlank: String? {
        let value = trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }
}
