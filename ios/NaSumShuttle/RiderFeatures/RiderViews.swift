import AuthenticationServices
import Observation
import SwiftUI
import UIKit

struct RootView: View {
    @Bindable var appModel: AppModel

    var body: some View {
        Group {
            if appModel.sessionToken != nil || appModel.currentUser != nil {
                RiderShellView(appModel: appModel)
            } else if appModel.isBootstrapping {
                StartupSkeletonView()
            } else {
                LoginView(appModel: appModel)
            }
        }
        .tint(ShuttleTheme.primary)
        .background(ShuttleTheme.background)
    }
}

private struct StartupSkeletonView: View {
    var body: some View {
        ZStack {
            ShuttleTheme.background.ignoresSafeArea()

            VStack(spacing: 26) {
                Spacer(minLength: 80)

                Image("Logo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 104, height: 104)
                    .accessibilityHidden(true)

                VStack(spacing: 14) {
                    SkeletonBlock(width: 220, height: 18)
                    SkeletonBlock(width: 176, height: 14)
                }
                .accessibilityHidden(true)

                Spacer()

                VStack(spacing: 12) {
                    ForEach(0..<3, id: \.self) { _ in
                        SkeletonCardRow()
                    }
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 48)
                .accessibilityHidden(true)
            }
        }
    }
}

private struct LoginView: View {
    @Bindable var appModel: AppModel
    @Environment(\.locale) private var locale
    @State private var presentingViewController: UIViewController?
    @State private var isEmailLoginPresented = false
    @State private var appleLoginNonce: String?

    private var localizedLoginTitle: String {
        locale.language.languageCode?.identifier == "ko"
            ? "나눔과섬김교회 교통 지원 앱"
            : "NaSum Church Shuttle"
    }

    private var localizedLoginSubtitle: String {
        locale.language.languageCode?.identifier == "ko"
            ? "셔틀 이용을 위해 로그인해 주세요."
            : "Sign in to continue."
    }

    var body: some View {
        ZStack {
            ShuttleTheme.background.ignoresSafeArea()

            VStack(spacing: 26) {
                Spacer(minLength: 56)

                VStack(spacing: 18) {
                    Image("Logo")
                        .resizable()
                        .scaledToFit()
                        .frame(width: 132, height: 132)
                        .accessibilityHidden(true)

                    Text(localizedLoginTitle)
                        .font(.title2.weight(.bold))
                        .foregroundStyle(ShuttleTheme.text)
                        .multilineTextAlignment(.center)

                    Text(localizedLoginSubtitle)
                        .font(.callout.weight(.semibold))
                        .foregroundStyle(ShuttleTheme.secondaryText)
                        .multilineTextAlignment(.center)
                }

                VStack(spacing: 12) {
                    SignInWithAppleButton(.continue) { request in
                        let nonce = AppleNonce.randomString()
                        appleLoginNonce = nonce
                        request.requestedScopes = [.fullName, .email]
                        request.nonce = AppleNonce.sha256(nonce)
                    } onCompletion: { result in
                        switch result {
                        case let .success(authorization):
                            guard let nonce = appleLoginNonce else {
                                appModel.errorMessage = NativeAuthProviderError.missingAppleCredential.localizedDescription
                                return
                            }
                            Task {
                                await appModel.signInWithApple(
                                    authorization: authorization,
                                    nonce: nonce
                                )
                            }
                        case let .failure(error):
                            let nsError = error as NSError
                            if nsError.domain == ASAuthorizationError.errorDomain,
                               nsError.code == ASAuthorizationError.canceled.rawValue {
                                return
                            }
                            appModel.errorMessage = error.localizedDescription
                        }
                    }
                    .signInWithAppleButtonStyle(.white)
                    .frame(height: 44)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    .disabled(appModel.isAuthenticating)

                    PlatformLoginButton(
                        title: "Continue with Google",
                        foreground: .black,
                        background: .white,
                        borderColor: Color.black.opacity(0.12),
                        icon: {
                            Text("G")
                                .font(.system(size: 18, weight: .bold, design: .rounded))
                                .foregroundStyle(.blue)
                        }
                    ) {
                        Task {
                            await appModel.signInWithGoogle(presentingViewController: presentingViewController)
                        }
                    }
                    .disabled(appModel.isAuthenticating)

                    PlatformLoginButton(
                        title: "Continue with LINE",
                        foreground: .white,
                        background: Color(red: 0.024, green: 0.78, blue: 0.333),
                        borderColor: .clear,
                        icon: {
                            Image("LineLogo")
                                .resizable()
                                .scaledToFit()
                        }
                    ) {
                        Task {
                            await appModel.signIn(presentingViewController: presentingViewController)
                        }
                    }
                    .disabled(appModel.isAuthenticating)

                    Button {
                        isEmailLoginPresented = true
                    } label: {
                        Text("Admin email login")
                            .font(.footnote)
                            .underline()
                            .foregroundStyle(ShuttleTheme.secondaryText)
                    }
                    .buttonStyle(.plain)
                    .disabled(appModel.isAuthenticating)
                }
                .padding(.horizontal, 28)

                Spacer(minLength: 72)
            }
            .background {
                ViewControllerResolver { presentingViewController = $0 }
                    .allowsHitTesting(false)
            }

            if appModel.isAuthenticating {
                LoginProgressOverlay()
            }
        }
        .sheet(isPresented: $isEmailLoginPresented) {
            EmailLoginSheet(appModel: appModel)
        }
    }
}


private struct PlatformLoginButton<Icon: View>: View {
    let title: String
    let foreground: Color
    let background: Color
    let borderColor: Color
    @ViewBuilder let icon: () -> Icon
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                icon()
                    .frame(width: 20, height: 20)
                Text(title)
                    .font(.subheadline.weight(.semibold))
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 14)
        }
        .buttonStyle(.plain)
        .frame(height: 44)
        .foregroundStyle(foreground)
        .background(background, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(borderColor, lineWidth: borderColor == .clear ? 0 : 1)
        }
    }
}

private struct LoginProgressOverlay: View {
    var body: some View {
        ZStack {
            Color.black.opacity(0.42)
                .ignoresSafeArea()

            ProgressView()
                .controlSize(.large)
                .tint(.white)
                .padding(22)
                .background(.ultraThinMaterial, in: Circle())
        }
        .transition(.opacity)
    }
}

#Preview("Login") {
    LoginView(appModel: AppModel(mode: .previewLoggedOut))
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
                    Button(appModel.isAuthenticating ? "Signing In..." : "Sign In") {
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

#Preview("Logged Out") {
    RootView(appModel: AppModel(mode: .previewLoggedOut))
}

#Preview("Logged In") {
    RootView(appModel: AppModel(mode: .previewLoggedIn))
}
