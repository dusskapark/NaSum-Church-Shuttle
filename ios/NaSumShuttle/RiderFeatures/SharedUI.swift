import SwiftUI
import UIKit

struct CloseIconButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "xmark")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(ShuttleTheme.text)
                .frame(width: 36, height: 36)
                .background(.regularMaterial, in: Circle())
                .shadow(color: .black.opacity(0.10), radius: 8, x: 0, y: 3)
        }
        .buttonStyle(.plain)
        .contentShape(Circle())
        .accessibilityLabel("Close")
        .accessibilityAddTraits(.isButton)
    }
}

extension View {
    func mapSheetCloseOverlay(
        alignment: Alignment = .topTrailing,
        action: @escaping () -> Void
    ) -> some View {
        ZStack(alignment: alignment) {
            self
            CloseIconButton(action: action)
                .padding(.horizontal, 18)
                .padding(.top, 12)
                .zIndex(100)
        }
    }
}

struct AppHeader: View {
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

struct AppSection<Content: View>: View {
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

struct AppRow: View {
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

struct AppInfoRow: View {
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

struct ProviderLoginButton: View {
    enum Style: Equatable {
        case google
        case line

        var background: Color {
            switch self {
            case .google, .line:
                return Color.white
            }
        }

        var foreground: Color {
            switch self {
            case .google, .line:
                return Color(red: 0.121569, green: 0.121569, blue: 0.121569)
            }
        }

        var border: Color {
            switch self {
            case .google, .line:
                return Color(red: 0.454902, green: 0.466667, blue: 0.458824)
            }
        }

        var iconName: String {
            switch self {
            case .google:
                return "GoogleSignInG"
            case .line:
                return "LineLoginIcon"
            }
        }

        var iconSize: CGFloat {
            switch self {
            case .google:
                return 20
            case .line:
                return 20
            }
        }

        var contentSpacing: CGFloat {
            switch self {
            case .google, .line:
                return 12
            }
        }

        var cornerRadius: CGFloat {
            switch self {
            case .google, .line:
                return 4
            }
        }
    }

    let style: Style
    let title: String
    let isDisabled: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: style.contentSpacing) {
                Image(style.iconName)
                    .resizable()
                    .scaledToFit()
                    .frame(width: style.iconSize, height: style.iconSize)

                Text(title)
                    .font(.system(size: 14, weight: .medium))
                    .lineLimit(1)
                    .minimumScaleFactor(0.88)
            }
            .foregroundStyle(style.foreground)
            .padding(.horizontal, 16)
            .frame(maxWidth: .infinity)
            .frame(height: 44)
            .background(style.background, in: RoundedRectangle(cornerRadius: style.cornerRadius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: style.cornerRadius, style: .continuous)
                    .stroke(style.border, lineWidth: 1)
            }
            .opacity(isDisabled ? 0.55 : 1)
            .contentShape(RoundedRectangle(cornerRadius: style.cornerRadius, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
        .accessibilityLabel(title)
    }
}

struct SkeletonSection: View {
    let rows: Int

    var body: some View {
        AppSection(title: "Loading") {
            VStack(spacing: 12) {
                ForEach(0..<rows, id: \.self) { _ in
                    SkeletonCardRow()
                }
            }
            .padding(.vertical, 4)
        }
        .accessibilityLabel("Loading")
    }
}

struct SkeletonCardRow: View {
    var body: some View {
        HStack(spacing: 12) {
            SkeletonBlock(width: 34, height: 34, cornerRadius: 17)
            VStack(alignment: .leading, spacing: 8) {
                SkeletonBlock(width: 180, height: 14)
                SkeletonBlock(width: 128, height: 12)
            }
            Spacer()
        }
        .padding(.vertical, 4)
        .accessibilityHidden(true)
    }
}

struct SkeletonListRow: View {
    var body: some View {
        HStack(spacing: 12) {
            SkeletonBlock(width: 22, height: 22, cornerRadius: 11)
            VStack(alignment: .leading, spacing: 7) {
                SkeletonBlock(width: 190, height: 14)
                SkeletonBlock(width: 112, height: 11)
            }
            Spacer()
            SkeletonBlock(width: 9, height: 14, cornerRadius: 3)
        }
        .padding(.vertical, 4)
        .accessibilityHidden(true)
    }
}

struct NotificationSkeletonRow: View {
    var body: some View {
        HStack(spacing: 0) {
            SkeletonBlock(width: 3, height: 58, cornerRadius: 1.5)
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    SkeletonBlock(width: 184, height: 14)
                    Spacer()
                    SkeletonBlock(width: 46, height: 10)
                }
                SkeletonBlock(width: 260, height: 12)
                SkeletonBlock(width: 210, height: 12)
            }
            .padding(.horizontal, 13)
            .padding(.vertical, 12)
        }
        .accessibilityHidden(true)
    }
}

struct SettingsProfileSkeleton: View {
    var body: some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                SkeletonBlock(width: 22, height: 22, cornerRadius: 11)
                VStack(alignment: .leading, spacing: 7) {
                    SkeletonBlock(width: 148, height: 14)
                    SkeletonBlock(width: 206, height: 11)
                }
                Spacer()
            }
            SkeletonLabeledContent(label: "User ID")
        }
        .accessibilityLabel("Loading profile")
    }
}

struct SkeletonLabeledContent: View {
    let label: String

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label)
            Spacer()
            SkeletonBlock(width: 142, height: 13)
        }
        .accessibilityHidden(true)
    }
}

struct SkeletonBlock: View {
    let width: CGFloat?
    let height: CGFloat
    var cornerRadius: CGFloat = 6

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            .fill(ShuttleTheme.border.opacity(0.52))
            .overlay {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(ShuttleTheme.surface.opacity(0.34))
            }
            .frame(width: width, height: height)
    }
}

enum RiderStrings {
    static func commonLoadingUserName(_ language: AppLanguage) -> String {
        text("common.loadingUserName", language)
    }

    static func commonServerError(_ language: AppLanguage) -> String {
        text("common.serverError", language)
    }

    static func commonLine(_ language: AppLanguage) -> String {
        text("common.line", language)
    }

    static func tabsHome(_ language: AppLanguage) -> String {
        text("tabs.home", language)
    }

    static func tabsNotifications(_ language: AppLanguage) -> String {
        text("tabs.notifications", language)
    }

    static func homeScanQr(_ language: AppLanguage) -> String {
        text("home.scanQr", language)
    }

    static func homeRoutesHeader(_ language: AppLanguage) -> String {
        text("home.routesHeader", language)
    }

    static func homeMyRouteHeader(_ language: AppLanguage) -> String {
        text("home.myRouteHeader", language)
    }

    static func homeSettings(_ language: AppLanguage) -> String {
        text("home.settings", language)
    }

    static func homeSelectedBadge(_ language: AppLanguage) -> String {
        text("home.selectedBadge", language)
    }

    static func homeProfileAriaLabel(_ language: AppLanguage) -> String {
        text("home.profileAriaLabel", language)
    }

    static func homeFooterLabel(_ language: AppLanguage) -> String {
        text("home.footerLabel", language)
    }

    static func homeFooterContent(_ language: AppLanguage) -> String {
        text("home.footerContent", language)
    }

    static func homeStopCount(_ count: Int, language: AppLanguage) -> String {
        "\(count) \(text("home.stopCount", language))"
    }

    static func scanTitle(_ language: AppLanguage) -> String {
        text("scan.title", language)
    }

    static func scanDescription(_ language: AppLanguage) -> String {
        text("scan.description", language)
    }

    static func scanButton(_ language: AppLanguage) -> String {
        text("scan.scanButton", language)
    }

    static func scanAgainButton(_ language: AppLanguage) -> String {
        text("scan.scanAgainButton", language)
    }

    static func checkinTitle(_ language: AppLanguage) -> String {
        text("checkin.title", language)
    }

    static func checkinConfirmTitle(_ language: AppLanguage) -> String {
        text("checkin.confirmTitle", language)
    }

    static func checkinWelcomeOnboard(_ language: AppLanguage) -> String {
        text("checkin.welcomeOnboard", language)
    }

    static func checkinRoute(_ language: AppLanguage) -> String {
        text("checkin.route", language)
    }

    static func checkinSelectStop(_ language: AppLanguage) -> String {
        text("checkin.selectStop", language)
    }

    static func checkinChooseStop(_ language: AppLanguage) -> String {
        text("checkin.chooseStop", language)
    }

    static func checkinAdditionalPassengers(_ language: AppLanguage) -> String {
        text("checkin.additionalPassengers", language)
    }

    static func checkinSubmit(_ language: AppLanguage) -> String {
        text("checkin.submit", language)
    }

    static func checkinLoading(_ language: AppLanguage) -> String {
        text("checkin.loading", language)
    }

    static func checkinTotalPassengers(_ count: Int, language: AppLanguage) -> String {
        text("checkin.totalPassengers", language, values: ["count": String(count)])
    }

    static func notificationsTitle(_ language: AppLanguage) -> String {
        text("notifications.title", language)
    }

    static func notificationsNoNotifications(_ language: AppLanguage) -> String {
        text("notifications.noNotifications", language)
    }

    static func notificationsMarkAllRead(_ language: AppLanguage) -> String {
        text("notifications.markAllRead", language)
    }

    static func settingsTitle(_ language: AppLanguage) -> String {
        text("settings.title", language)
    }

    static func settingsProfileHeader(_ language: AppLanguage) -> String {
        text("settings.profileHeader", language)
    }

    static func settingsRouteHeader(_ language: AppLanguage) -> String {
        text("settings.routeHeader", language)
    }

    static func settingsPreferencesHeader(_ language: AppLanguage) -> String {
        text("settings.preferencesHeader", language)
    }

    static func settingsUserId(_ language: AppLanguage) -> String {
        text("settings.userId", language)
    }

    static func settingsUserIdCopied(_ language: AppLanguage) -> String {
        text("settings.userIdCopied", language)
    }

    static func settingsUserIdCopyFailed(_ language: AppLanguage) -> String {
        text("settings.userIdCopyFailed", language)
    }

    static func settingsCurrentRoute(_ language: AppLanguage) -> String {
        text("settings.currentRoute", language)
    }

    static func settingsCurrentStop(_ language: AppLanguage) -> String {
        text("settings.currentStop", language)
    }

    static func settingsNoRouteSelected(_ language: AppLanguage) -> String {
        text("settings.noRouteSelected", language)
    }

    static func settingsPushNotifications(_ language: AppLanguage) -> String {
        text("settings.pushNotifications", language)
    }

    static func settingsLanguage(_ language: AppLanguage) -> String {
        text("settings.language", language)
    }

    static func settingsTheme(_ language: AppLanguage) -> String {
        text("settings.theme", language)
    }

    static func settingsThemeSystem(_ language: AppLanguage) -> String {
        text("settings.themeSystem", language)
    }

    static func settingsThemeLight(_ language: AppLanguage) -> String {
        text("settings.themeLight", language)
    }

    static func settingsThemeDark(_ language: AppLanguage) -> String {
        text("settings.themeDark", language)
    }

    static func settingsAdminSection(_ language: AppLanguage) -> String {
        text("tabs.admin", language)
    }

    static func settingsDeveloperSection(_ language: AppLanguage) -> String {
        text("settings.developerSection", language)
    }

    static func settingsLogout(_ language: AppLanguage) -> String {
        text("settings.logout", language)
    }

    static func searchStopsTitle(_ language: AppLanguage) -> String {
        text("tabs.stops", language)
    }

    private static func text(_ key: String, _ language: AppLanguage, values: [String: String] = [:]) -> String {
        RiderStringsGenerated.text(key, language: language, values: values)
    }
}

enum ShuttleTheme {
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

extension View {
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
