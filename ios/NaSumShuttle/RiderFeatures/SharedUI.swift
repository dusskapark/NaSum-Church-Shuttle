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
        text(language, en: "Developer", ko: "개발자")
    }

    static func commonServerError(_ language: AppLanguage) -> String {
        text(language, en: "A server error occurred.", ko: "서버 오류가 발생했습니다.")
    }

    static func commonLine(_ language: AppLanguage) -> String {
        text(language, en: "LINE", ko: "LINE")
    }

    static func tabsHome(_ language: AppLanguage) -> String {
        text(language, en: "Home", ko: "홈")
    }

    static func tabsNotifications(_ language: AppLanguage) -> String {
        text(language, en: "Alerts", ko: "알림")
    }

    static func homeScanQr(_ language: AppLanguage) -> String {
        text(language, en: "Scan QR Code", ko: "QR 코드 스캔")
    }

    static func homeRoutesHeader(_ language: AppLanguage) -> String {
        text(language, en: "Routes", ko: "노선")
    }

    static func homeMyRouteHeader(_ language: AppLanguage) -> String {
        text(language, en: "My Route", ko: "내 노선")
    }

    static func homeSettings(_ language: AppLanguage) -> String {
        text(language, en: "Settings", ko: "설정")
    }

    static func homeSelectedBadge(_ language: AppLanguage) -> String {
        text(language, en: "Selected", ko: "선택됨")
    }

    static func homeProfileAriaLabel(_ language: AppLanguage) -> String {
        text(language, en: "Open settings", ko: "설정 열기")
    }

    static func homeFooterLabel(_ language: AppLanguage) -> String {
        text(language, en: "NaNum and SeomKim Church", ko: "나눔과섬김교회")
    }

    static func homeFooterContent(_ language: AppLanguage) -> String {
        text(
            language,
            en: "KPC(SINGAPORE) LTD. 12 Shelford Road Singapore 288370",
            ko: "KPC(SINGAPORE) LTD. 12 Shelford Road Singapore 288370"
        )
    }

    static func homeStopCount(_ count: Int, language: AppLanguage) -> String {
        text(language, en: "\(count) stops", ko: "\(count) 정류장")
    }

    static func scanTitle(_ language: AppLanguage) -> String {
        text(language, en: "QR Check-in", ko: "QR 체크인")
    }

    static func scanDescription(_ language: AppLanguage) -> String {
        text(
            language,
            en: "Tap the button below to scan the shuttle bus QR code and check in.",
            ko: "셔틀버스 QR 코드를 스캔하여 탑승을 확인하세요."
        )
    }

    static func scanButton(_ language: AppLanguage) -> String {
        text(language, en: "QR Scan", ko: "QR 스캔")
    }

    static func scanAgainButton(_ language: AppLanguage) -> String {
        text(language, en: "Scan Again", ko: "다시 스캔")
    }

    static func checkinTitle(_ language: AppLanguage) -> String {
        text(language, en: "Check-in", ko: "체크인")
    }

    static func checkinConfirmTitle(_ language: AppLanguage) -> String {
        text(language, en: "Ready to board?", ko: "탑승하실 건가요?")
    }

    static func checkinWelcomeOnboard(_ language: AppLanguage) -> String {
        text(language, en: "Welcome onboard!", ko: "탑승을 환영합니다!")
    }

    static func checkinRoute(_ language: AppLanguage) -> String {
        text(language, en: "Route", ko: "노선")
    }

    static func checkinSelectStop(_ language: AppLanguage) -> String {
        text(language, en: "Stop", ko: "정류장")
    }

    static func checkinChooseStop(_ language: AppLanguage) -> String {
        text(language, en: "Choose stop", ko: "정류장 선택")
    }

    static func checkinAdditionalPassengers(_ language: AppLanguage) -> String {
        text(language, en: "Passengers", ko: "동승자")
    }

    static func checkinSubmit(_ language: AppLanguage) -> String {
        text(language, en: "Check In", ko: "체크인")
    }

    static func checkinLoading(_ language: AppLanguage) -> String {
        text(language, en: "Loading run info...", ko: "운행 정보를 불러오는 중...")
    }

    static func checkinTotalPassengers(_ count: Int, language: AppLanguage) -> String {
        text(language, en: "\(count) boarded", ko: "\(count)명 탑승")
    }

    static func notificationsTitle(_ language: AppLanguage) -> String {
        text(language, en: "Notifications", ko: "알림")
    }

    static func notificationsNoNotifications(_ language: AppLanguage) -> String {
        text(language, en: "No notifications yet.", ko: "알림이 없습니다.")
    }

    static func notificationsMarkAllRead(_ language: AppLanguage) -> String {
        text(language, en: "Mark all read", ko: "전체 읽음")
    }

    static func settingsTitle(_ language: AppLanguage) -> String {
        text(language, en: "Settings", ko: "설정")
    }

    static func settingsProfileHeader(_ language: AppLanguage) -> String {
        text(language, en: "Profile", ko: "프로필")
    }

    static func settingsRouteHeader(_ language: AppLanguage) -> String {
        text(language, en: "Route", ko: "노선")
    }

    static func settingsPreferencesHeader(_ language: AppLanguage) -> String {
        text(language, en: "Preferences", ko: "환경설정")
    }

    static func settingsUserId(_ language: AppLanguage) -> String {
        text(language, en: "User ID", ko: "사용자 ID")
    }

    static func settingsCurrentRoute(_ language: AppLanguage) -> String {
        text(language, en: "Current Route", ko: "현재 노선")
    }

    static func settingsCurrentStop(_ language: AppLanguage) -> String {
        text(language, en: "Current Stop", ko: "현재 정류장")
    }

    static func settingsNoRouteSelected(_ language: AppLanguage) -> String {
        text(language, en: "No route selected yet", ko: "아직 선택한 노선이 없습니다")
    }

    static func settingsPushNotifications(_ language: AppLanguage) -> String {
        text(language, en: "Push Notifications", ko: "푸시 알림")
    }

    static func settingsLanguage(_ language: AppLanguage) -> String {
        text(language, en: "Language", ko: "언어")
    }

    static func settingsTheme(_ language: AppLanguage) -> String {
        text(language, en: "Theme", ko: "테마")
    }

    static func settingsThemeSystem(_ language: AppLanguage) -> String {
        text(language, en: "System", ko: "시스템")
    }

    static func settingsThemeLight(_ language: AppLanguage) -> String {
        text(language, en: "Light", ko: "라이트")
    }

    static func settingsThemeDark(_ language: AppLanguage) -> String {
        text(language, en: "Dark", ko: "다크")
    }

    static func settingsAdminSection(_ language: AppLanguage) -> String {
        text(language, en: "Admin", ko: "어드민")
    }

    static func settingsDeveloperSection(_ language: AppLanguage) -> String {
        text(language, en: "Developer", ko: "개발자")
    }

    static func settingsLogout(_ language: AppLanguage) -> String {
        text(language, en: "Refresh", ko: "갱신")
    }

    static func searchStopsTitle(_ language: AppLanguage) -> String {
        text(language, en: "Stops", ko: "정류장")
    }

    private static func text(_ language: AppLanguage, en: String, ko: String) -> String {
        language == .ko ? ko : en
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
