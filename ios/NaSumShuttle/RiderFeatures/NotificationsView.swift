import Observation
import SwiftUI

struct NotificationsPage: View {
    @Bindable var appModel: AppModel

    private var language: AppLanguage {
        appModel.preferredLanguage
    }

    private var unreadCount: Int {
        appModel.notifications.filter { !$0.isRead }.count
    }

    var body: some View {
        Group {
            if appModel.isInitialDataLoading && appModel.notifications.isEmpty {
                List {
                    ForEach(0..<6, id: \.self) { _ in
                        NotificationSkeletonRow()
                    }
                }
                .listStyle(.plain)
            } else if appModel.notifications.isEmpty {
                ContentUnavailableView(
                    RiderStrings.notificationsNoNotifications(language),
                    systemImage: "bell.slash"
                )
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
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
                .listStyle(.plain)
                .refreshable {
                    await appModel.reloadNotifications()
                }
            }
        }
        .navigationTitle(RiderStrings.notificationsTitle(language))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if unreadCount > 0 {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(RiderStrings.notificationsMarkAllRead(language)) {
                        Task { await appModel.markAllNotificationsRead() }
                    }
                }
            }
        }
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
