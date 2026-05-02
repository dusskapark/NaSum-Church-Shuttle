import Observation
import SwiftUI

struct SettingsPage: View {
    @Bindable var appModel: AppModel

    private var language: AppLanguage {
        appModel.preferredLanguage
    }

    var body: some View {
        Form {
            Section(RiderStrings.settingsProfileHeader(language)) {
                if appModel.isInitialDataLoading && appModel.currentUser == nil {
                    SettingsProfileSkeleton()
                } else {
                    Button {
                        Task { try? await appModel.refreshAll() }
                    } label: {
                        Label {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(appModel.currentUser?.displayName ?? RiderStrings.commonLoadingUserName(language))
                                if let email = appModel.currentUser?.email {
                                    Text(email)
                                        .font(.subheadline)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        } icon: {
                            SettingsProfileAvatar(urlString: appModel.currentUser?.pictureUrl)
                        }
                    }

                    LabeledContent(RiderStrings.settingsUserId(language), value: appModel.currentUser?.providerUid ?? "No LINE profile")
                }
            }

            Section(RiderStrings.settingsRouteHeader(language)) {
                if appModel.isInitialDataLoading && appModel.registration == nil {
                    SkeletonLabeledContent(label: RiderStrings.settingsCurrentRoute(language))
                    SkeletonLabeledContent(label: RiderStrings.settingsCurrentStop(language))
                } else {
                    LabeledContent(
                        RiderStrings.settingsCurrentRoute(language),
                        value: appModel.registration?.registration?.route.label ?? RiderStrings.settingsNoRouteSelected(language)
                    )
                    LabeledContent(
                        RiderStrings.settingsCurrentStop(language),
                        value: appModel.registration?.registration.map { $0.routeStop.place.displayName ?? $0.routeStop.place.name } ?? "-"
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
        .frame(width: 24, height: 24)
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
