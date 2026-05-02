import SwiftUI
import UIKit
#if canImport(GoogleMaps)
import GoogleMaps
#endif

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        AppEnvironment.shared.appModel.pushManager.handleRegisteredDeviceToken(deviceToken)
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        AppEnvironment.shared.appModel.pushManager.handleRegistrationError(error)
    }

    func application(
        _ app: UIApplication,
        open url: URL,
        options: [UIApplication.OpenURLOptionsKey: Any] = [:]
    ) -> Bool {
        AppEnvironment.shared.appModel.handleIncomingURL(url)
    }

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        guard ProcessInfo.processInfo.environment["XCODE_RUNNING_FOR_PREVIEWS"] != "1" else {
            return true
        }
        #if canImport(GoogleMaps)
        importGoogleMapsIfPossible()
        #endif
        return true
    }

    #if canImport(GoogleMaps)
    private func importGoogleMapsIfPossible() {
        guard let key = AppConfiguration.googleMapsAPIKey else { return }
        GMSServices.provideAPIKey(key)
    }
    #endif
}

@MainActor
final class AppEnvironment {
    static let shared = AppEnvironment()
    let appModel = AppModel()
}

@main
struct NaSumShuttleApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var appModel = AppEnvironment.shared.appModel

    var body: some Scene {
        WindowGroup {
            RootView(appModel: appModel)
                .preferredColorScheme(appModel.preferredColorScheme)
                .task {
                    await appModel.bootstrap()
                }
                .onOpenURL { url in
                    _ = appModel.handleIncomingURL(url)
                }
                .alert(RiderStrings.commonServerError(appModel.preferredLanguage), isPresented: Binding(
                    get: { appModel.errorMessage != nil },
                    set: { newValue in
                        if !newValue {
                            appModel.clearError()
                        }
                    }
                )) {
                    Button("OK", role: .cancel) {
                        appModel.clearError()
                    }
                } message: {
                    Text(appModel.errorMessage ?? "")
                }
            }
        }
    }
