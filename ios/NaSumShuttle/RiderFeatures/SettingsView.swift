import Observation
import SwiftUI
import UIKit

struct SettingsPage: View {
    @Bindable var appModel: AppModel
    let onOpenStopSearch: () -> Void

    private var language: AppLanguage {
        appModel.preferredLanguage
    }

    var body: some View {
        Form {
            Section(RiderStrings.settingsProfileHeader(language)) {
                if appModel.isInitialDataLoading && appModel.currentUser == nil {
                    SettingsProfileSkeleton()
                } else {
                    HStack(spacing: 12) {
                        SettingsProfileAvatar(urlString: appModel.currentUser?.pictureUrl)

                        VStack(alignment: .leading, spacing: 3) {
                            Text(appModel.currentUser?.displayName ?? RiderStrings.commonLoadingUserName(language))
                                .foregroundStyle(ShuttleTheme.text)
                            if let email = appModel.currentUser?.email {
                                Text(email)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                        }

                        Spacer()

                        SettingsRefreshButton(isRefreshing: appModel.isLoading, language: language) {
                            Task { try? await appModel.refreshAll() }
                        }
                    }
                    .padding(.vertical, 4)

                    SettingsUserIdRow(
                        userId: appModel.currentUser?.userId,
                        language: language
                    )
                }
            }

            Section(RiderStrings.settingsRouteHeader(language)) {
                if appModel.isInitialDataLoading && appModel.registration == nil {
                    SkeletonLabeledContent(label: RiderStrings.settingsCurrentRoute(language))
                    SkeletonLabeledContent(label: RiderStrings.settingsCurrentStop(language))
                } else {
                    SettingsValueButtonRow(
                        title: RiderStrings.settingsCurrentRoute(language),
                        value: appModel.registration?.registration?.route.label ?? RiderStrings.settingsNoRouteSelected(language),
                        action: onOpenStopSearch
                    )
                    SettingsValueButtonRow(
                        title: RiderStrings.settingsCurrentStop(language),
                        value: appModel.registration?.registration.map { $0.routeStop.place.displayName ?? $0.routeStop.place.name } ?? "-",
                        action: onOpenStopSearch
                    )
                }
            }

            Section(RiderStrings.settingsPreferencesHeader(language)) {
                if appModel.isInitialDataLoading && appModel.currentUser == nil {
                    SkeletonLabeledContent(label: RiderStrings.settingsLanguage(language))
                    SkeletonLabeledContent(label: RiderStrings.settingsPushNotifications(language))
                    SkeletonLabeledContent(label: RiderStrings.settingsTheme(language))
                } else {
                    Picker(RiderStrings.settingsLanguage(language), selection: Binding(
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
                        RiderStrings.settingsPushNotifications(language),
                        isOn: Binding(
                            get: { appModel.currentUser?.pushNotificationsEnabled ?? false },
                            set: { newValue in
                                Task { await appModel.updatePreferences(pushNotificationsEnabled: newValue) }
                            }
                        )
                    )

                    Picker(RiderStrings.settingsTheme(language), selection: $appModel.themePreference) {
                        ForEach(AppThemePreference.allCases, id: \.self) { theme in
                            Text(theme.label(language: language)).tag(theme)
                        }
                    }
                }
            }

            if appModel.isAdminSurfaceEnabled {
                Section(RiderStrings.settingsAdminSection(language)) {
                    NavigationLink {
                        AdminPlaceholderView(appModel: appModel)
                    } label: {
                        Label(RiderStrings.settingsAdminSection(language), systemImage: "person.2.crop.square.stack.fill")
                    }
                }

                Section(RiderStrings.settingsDeveloperSection(language)) {
                    LabeledContent("Role", value: appModel.currentUser?.role.rawValue ?? "unknown")
                }
            }

            Section {
                Button(RiderStrings.settingsLogout(language), role: .destructive) {
                    Task { await appModel.logout() }
                }
            }
        }
        .navigationTitle(RiderStrings.settingsTitle(language))
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct SettingsRefreshButton: View {
    let isRefreshing: Bool
    let language: AppLanguage
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Group {
                if isRefreshing {
                    ProgressView()
                        .controlSize(.small)
                } else {
                    Image(systemName: "arrow.clockwise")
                        .font(.body.weight(.semibold))
                }
            }
            .frame(width: 34, height: 34)
        }
        .buttonStyle(.borderless)
        .disabled(isRefreshing)
        .accessibilityLabel(RiderStrings.settingsLogout(language))
    }
}

private struct SettingsUserIdRow: View {
    let userId: String?
    let language: AppLanguage
    @State private var feedbackText: String?

    var body: some View {
        Button {
            copyUserId()
        } label: {
            HStack {
                Text(RiderStrings.settingsUserId(language))
                    .foregroundStyle(ShuttleTheme.text)

                Spacer()

                Text(feedbackText ?? userId.map(middleTruncated) ?? "-")
                    .font(.subheadline.monospaced())
                    .foregroundStyle(feedbackText == nil ? ShuttleTheme.secondaryText : ShuttleTheme.success)
                    .lineLimit(1)

                Image(systemName: "doc.on.doc")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(ShuttleTheme.secondaryText)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(userId == nil)
        .accessibilityLabel(RiderStrings.settingsUserId(language))
        .accessibilityValue(userId ?? "-")
        .accessibilityHint(feedbackText ?? "")
    }

    private func copyUserId() {
        guard let userId, !userId.isEmpty else { return }
        UIPasteboard.general.string = userId
        let copied = RiderStrings.settingsUserIdCopied(language)
        feedbackText = copied
        UIAccessibility.post(notification: .announcement, argument: copied)

        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 1_250_000_000)
            feedbackText = nil
        }
    }

    private func middleTruncated(_ value: String) -> String {
        let prefixCount = 8
        let suffixCount = 6
        guard value.count > prefixCount + suffixCount + 3 else { return value }
        return "\(value.prefix(prefixCount))...\(value.suffix(suffixCount))"
    }
}

private struct SettingsValueButtonRow: View {
    let title: String
    let value: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                Text(title)
                    .foregroundStyle(ShuttleTheme.text)

                Spacer()

                Text(value)
                    .font(.subheadline)
                    .foregroundStyle(ShuttleTheme.secondaryText)
                    .lineLimit(1)

                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(ShuttleTheme.secondaryText)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

private struct SettingsProfileAvatar: View {
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
        .frame(width: 40, height: 40)
        .clipShape(Circle())
        .accessibilityHidden(true)
    }

    private var fallbackAvatar: some View {
        Image(systemName: "person.crop.circle.fill")
            .resizable()
            .scaledToFit()
            .foregroundStyle(ShuttleTheme.primary)
    }
}

struct AdminPlaceholderView: View {
    @Bindable var appModel: AppModel

    var body: some View {
        let language = appModel.preferredLanguage

        Form {
            Section(RiderStrings.settingsAdminSection(language)) {
                Label("Run start / end", systemImage: "playpause.fill")
                Label("Stop override", systemImage: "slider.horizontal.3")
                Label("Schedules and users", systemImage: "list.bullet.rectangle.portrait")
            }

            Section(RiderStrings.settingsDeveloperSection(language)) {
                LabeledContent("Role", value: appModel.currentUser?.role.rawValue ?? "unknown")
            }
        }
        .navigationTitle(RiderStrings.settingsAdminSection(language))
        .navigationBarTitleDisplayMode(.inline)
    }
}
