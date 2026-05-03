import Foundation
import Observation
import UIKit
import UserNotifications

struct PushNotificationTapPayload: Equatable, Sendable {
    let notificationId: String?
    let routeCode: String?
    let userRouteStopId: String?
    let deepLinkPath: String?
}

@Observable
final class PushNotificationManager: NSObject, UNUserNotificationCenterDelegate {
    var authorizationStatus: UNAuthorizationStatus = .notDetermined
    var deviceTokenHex: String?
    var latestErrorMessage: String?
    var onDeviceTokenUpdated: ((String) -> Void)?
    var onNotificationTapped: ((PushNotificationTapPayload) -> Void)?

    override init() {
        super.init()
        UNUserNotificationCenter.current().delegate = self
    }

    func refreshAuthorizationStatus() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        authorizationStatus = settings.authorizationStatus
    }

    @MainActor
    func requestAuthorizationIfNeeded() async {
        do {
            let center = UNUserNotificationCenter.current()
            let granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
            await refreshAuthorizationStatus()
            if granted {
                UIApplication.shared.registerForRemoteNotifications()
            }
        } catch {
            latestErrorMessage = error.localizedDescription
        }
    }

    func handleRegisteredDeviceToken(_ tokenData: Data) {
        let token = tokenData.map { String(format: "%02x", $0) }.joined()
        deviceTokenHex = token
        onDeviceTokenUpdated?(token)
    }

    func handleRegistrationError(_ error: Error) {
        latestErrorMessage = error.localizedDescription
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        let userInfo = response.notification.request.content.userInfo
        let payload = PushNotificationTapPayload(
            notificationId: userInfo["notificationId"] as? String,
            routeCode: userInfo["routeCode"] as? String,
            userRouteStopId: userInfo["userRouteStopId"] as? String,
            deepLinkPath: userInfo["deepLinkPath"] as? String
        )
        await MainActor.run {
            onNotificationTapped?(payload)
        }
    }
}
