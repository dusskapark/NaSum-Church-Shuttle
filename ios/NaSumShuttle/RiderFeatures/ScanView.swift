import Observation
import SwiftUI
import AVFoundation

struct ScanPage: View {
    @Bindable var appModel: AppModel
    @State private var routeCodeInput = ""
    @State private var selectedStopId: String?
    @State private var additionalPassengers = 0
    @State private var isScannerPresented: Bool

    init(appModel: AppModel, initialRouteCode: String? = nil, startsWithScanner: Bool = false) {
        self.appModel = appModel
        _routeCodeInput = State(initialValue: initialRouteCode ?? "")
        _isScannerPresented = State(initialValue: startsWithScanner)
    }

    private var currentRouteCode: String? {
        let trimmed = routeCodeInput.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private var currentRunInfo: CheckInRunInfoResponse? {
        guard let currentRouteCode else { return nil }
        return appModel.runInfoByRouteCode[currentRouteCode]
    }

    private var language: AppLanguage {
        appModel.preferredLanguage
    }

    private var selectedStop: RouteStop? {
        guard let selectedStopId else { return nil }
        return currentRunInfo?.route.stops.first { $0.id == selectedStopId }
    }

    var body: some View {
        ZStack {
            ShuttleTheme.background.ignoresSafeArea()

            if let response = appModel.lastCheckInResponse, selectedStop != nil {
                ResultPage(
                    status: .success,
                    title: RiderStrings.checkinWelcomeOnboard(language),
                    description: RiderStrings.checkinTotalPassengers(
                        response.stopState.totalPassengers,
                        language: language
                    ),
                    primaryButtonTitle: RiderStrings.tabsHome(language),
                    primaryAction: { routeCodeInput = "" }
                ) {
                    EmptyView()
                }
            } else if let currentRouteCode, let currentRunInfo {
                checkInConfirm(routeCode: currentRouteCode, runInfo: currentRunInfo)
            } else if currentRouteCode != nil {
                ResultPage(
                    status: .info,
                    title: RiderStrings.checkinLoading(language),
                    description: currentRouteCode ?? "",
                    primaryButtonTitle: RiderStrings.checkinRoute(language),
                    primaryAction: {
                        guard let currentRouteCode else { return }
                        Task { try? await appModel.loadRunInfo(routeCode: currentRouteCode) }
                    }
                ) {
                    SkeletonSection(rows: 3)
                        .padding(.vertical, 24)
                }
            } else {
                scannerStart
            }
        }
        .navigationTitle(RiderStrings.scanTitle(language))
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $isScannerPresented) {
            QRScannerSheet(language: language) { payload in
                if let routeCode = appModel.parseRouteCode(from: payload) {
                    routeCodeInput = routeCode
                    Task { try? await appModel.loadRunInfo(routeCode: routeCode) }
                }
                isScannerPresented = false
            }
        }
        .onChange(of: currentRunInfo?.route.stops.map(\.id) ?? []) { _, ids in
            if selectedStopId == nil {
                selectedStopId = appModel.registration?.registration?.routeStop.id ?? ids.first
            }
        }
    }

    private var scannerStart: some View {
        VStack(spacing: 22) {
            Spacer()
            Image(systemName: "qrcode.viewfinder")
                .font(.system(size: 78, weight: .semibold))
                .foregroundStyle(ShuttleTheme.primary)
            Text(RiderStrings.scanTitle(language))
                .font(.largeTitle.weight(.bold))
            Text(RiderStrings.scanDescription(language))
                .font(.body)
                .foregroundStyle(ShuttleTheme.secondaryText)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 28)

            VStack(spacing: 12) {
                Button(RiderStrings.scanButton(language)) {
                    isScannerPresented = true
                }
                .shuttleButtonStyle(prominent: true)
                .controlSize(.large)

                TextField("Paste route code or QR URL", text: $routeCodeInput)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .padding(14)
                    .background(ShuttleTheme.surface, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .stroke(ShuttleTheme.border, lineWidth: 1)
                    }

                Button(RiderStrings.checkinRoute(language)) {
                    guard let currentRouteCode else { return }
                    Task { try? await appModel.loadRunInfo(routeCode: currentRouteCode) }
                }
                .shuttleButtonStyle(prominent: false)
                .controlSize(.large)
            }
            .padding(.horizontal, 24)
            Spacer()
        }
    }

    private func checkInConfirm(routeCode: String, runInfo: CheckInRunInfoResponse) -> some View {
        ResultPage(
            status: .info,
            title: RiderStrings.checkinConfirmTitle(language),
            description: runInfo.route.label,
            primaryButtonTitle: RiderStrings.checkinSubmit(language),
            primaryAction: {
                guard let selectedStopId else { return }
                Task {
                    await appModel.checkIn(
                        routeCode: routeCode,
                        routeStopId: selectedStopId,
                        additionalPassengers: additionalPassengers
                    )
                }
            },
            secondaryButtonTitle: RiderStrings.scanAgainButton(language),
            secondaryAction: {
                routeCodeInput = ""
                selectedStopId = nil
                additionalPassengers = 0
                isScannerPresented = true
            }
        ) {
            AppSection(title: RiderStrings.checkinTitle(language)) {
                AppInfoRow(label: RiderStrings.checkinRoute(language), value: runInfo.route.label)

                Menu {
                    ForEach(runInfo.route.stops.filter(\.isPickupEnabled)) { stop in
                        Button(stop.place.displayName ?? stop.place.name) {
                            selectedStopId = stop.id
                        }
                    }
                } label: {
                    HStack {
                        Text(RiderStrings.checkinSelectStop(language))
                            .foregroundStyle(ShuttleTheme.text)
                        Spacer()
                        Text(selectedStop.map { $0.place.displayName ?? $0.place.name } ?? RiderStrings.checkinChooseStop(language))
                            .foregroundStyle(ShuttleTheme.secondaryText)
                            .lineLimit(1)
                        Image(systemName: "chevron.up.chevron.down")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(ShuttleTheme.secondaryText)
                    }
                }
                .buttonStyle(.plain)

                Stepper(value: $additionalPassengers, in: 0 ... 9) {
                    HStack {
                        Text(RiderStrings.checkinAdditionalPassengers(language))
                        Spacer()
                        Text("\(additionalPassengers)")
                            .foregroundStyle(ShuttleTheme.secondaryText)
                    }
                }
            }
        }
    }
}

private enum ResultStatus {
    case info
    case success
    case error

    var systemImage: String {
        switch self {
        case .info: "qrcode.viewfinder"
        case .success: "checkmark.circle.fill"
        case .error: "xmark.circle.fill"
        }
    }

    var color: Color {
        switch self {
        case .info: ShuttleTheme.primary
        case .success: ShuttleTheme.success
        case .error: ShuttleTheme.danger
        }
    }
}

private struct ResultPage<Content: View>: View {
    let status: ResultStatus
    let title: String
    let description: String
    let primaryButtonTitle: String
    let primaryAction: () -> Void
    var secondaryButtonTitle: String?
    var secondaryAction: (() -> Void)?
    @ViewBuilder var content: Content

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                Image(systemName: status.systemImage)
                    .font(.system(size: 66, weight: .semibold))
                    .foregroundStyle(status.color)
                    .padding(.top, 56)

                Text(title)
                    .font(.largeTitle.weight(.bold))
                    .multilineTextAlignment(.center)

                Text(description)
                    .font(.body)
                    .foregroundStyle(ShuttleTheme.secondaryText)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 18)

                content
                    .padding(.top, 12)

                Button(primaryButtonTitle, action: primaryAction)
                    .shuttleButtonStyle(prominent: true)
                    .controlSize(.large)
                    .padding(.top, 8)

                if let secondaryButtonTitle, let secondaryAction {
                    Button(secondaryButtonTitle, action: secondaryAction)
                        .shuttleButtonStyle(prominent: false)
                        .controlSize(.large)
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 96)
        }
    }
}

struct QRScannerSheet: View {
    let language: AppLanguage
    let onScan: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var manualPayload = ""
    @State private var scannerState: QRScannerSheetState = .scanning
    @State private var scannerAttempt = 0

    var body: some View {
        ZStack {
            switch scannerState {
            case .scanning:
                NativeQRScannerView(
                    onScan: { payload in
                        onScan(payload)
                    },
                    onFailure: { failure in
                        scannerState = .failed(failure)
                    }
                )
                .id(scannerAttempt)
                .ignoresSafeArea()

                scannerOverlay

            case let .failed(failure):
                scannerFailure(failure: failure)

            case .manualEntry:
                manualEntry
            }
        }
        .background(Color.black.ignoresSafeArea())
        .mapSheetCloseOverlay {
            dismiss()
        }
    }

    private var scannerOverlay: some View {
        VStack(spacing: 0) {
            Text(RiderStrings.scanTitle(language))
                .font(.headline.weight(.semibold))
                .foregroundStyle(.white)
                .padding(.top, 24)

            Spacer()

            ZStack {
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .stroke(.white.opacity(0.88), lineWidth: 4)
                    .frame(width: 250, height: 250)

                ForEach(QRScannerCorner.allCases) { corner in
                    ScannerCorner(corner: corner)
                        .stroke(ShuttleTheme.primary, style: StrokeStyle(lineWidth: 8, lineCap: .round, lineJoin: .round))
                        .frame(width: 74, height: 74)
                        .frame(width: 250, height: 250, alignment: corner.alignment)
                }
            }
            .shadow(color: .black.opacity(0.35), radius: 14, x: 0, y: 8)

            Spacer()

            VStack(spacing: 10) {
                Text(scannerPrompt)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.white)

                Text(scannerSubprompt)
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.78))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 44)
        }
        .padding(.top, 24)
    }

    private func scannerFailure(failure: QRScannerFailure) -> some View {
        VStack(spacing: 18) {
            Spacer()

            Image(systemName: "camera.viewfinder")
                .font(.system(size: 68, weight: .semibold))
                .foregroundStyle(.white)

            Text(scannerUnavailableTitle)
                .font(.title2.weight(.bold))
                .foregroundStyle(.white)

            Text(scannerFailureMessage(failure))
                .font(.body)
                .foregroundStyle(.white.opacity(0.78))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 28)

            VStack(spacing: 12) {
                Button(scannerRetryTitle) {
                    scannerAttempt += 1
                    scannerState = .scanning
                }
                .shuttleButtonStyle(prominent: true)
                .controlSize(.large)

                Button(scannerManualTitle) {
                    scannerState = .manualEntry
                }
                .shuttleButtonStyle(prominent: true)
                .controlSize(.large)
                .tint(.white)
            }
            .padding(.horizontal, 28)
            .padding(.top, 10)

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var manualEntry: some View {
        VStack(spacing: 18) {
            Spacer()

            Image(systemName: "keyboard")
                .font(.system(size: 64, weight: .semibold))
                .foregroundStyle(.white)

            Text(scannerManualTitle)
                .font(.title2.weight(.bold))
                .foregroundStyle(.white)

            Text(manualEntryPrompt)
                .font(.body)
                .foregroundStyle(.white.opacity(0.78))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 28)

            VStack(spacing: 12) {
                TextField(manualEntryPlaceholder, text: $manualPayload)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .textFieldStyle(.roundedBorder)

                Button(manualEntrySubmitTitle) {
                    onScan(manualPayload)
                }
                .shuttleButtonStyle(prominent: true)
                .controlSize(.large)

                Button(scannerRetryTitle) {
                    scannerAttempt += 1
                    scannerState = .scanning
                }
                .foregroundStyle(.white)
                .controlSize(.large)
            }
            .padding(.horizontal, 28)
            .padding(.top, 8)

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var scannerPrompt: String {
        text(en: "Place the QR code inside the frame.", ko: "QR 코드를 프레임 안에 맞춰 주세요.")
    }

    private var scannerSubprompt: String {
        text(en: "Scanning starts automatically.", ko: "스캔은 자동으로 시작됩니다.")
    }

    private var scannerUnavailableTitle: String {
        text(en: "Unable to open camera", ko: "카메라를 열 수 없습니다")
    }

    private var scannerRetryTitle: String {
        text(en: "Try Again", ko: "다시 시도")
    }

    private var scannerManualTitle: String {
        text(en: "Enter Code Manually", ko: "수동으로 입력")
    }

    private var manualEntryPrompt: String {
        text(en: "Paste the QR URL or route code to continue.", ko: "QR URL 또는 노선 코드를 입력해 주세요.")
    }

    private var manualEntryPlaceholder: String {
        text(en: "QR URL or route code", ko: "QR URL 또는 노선 코드")
    }

    private var manualEntrySubmitTitle: String {
        text(en: "Use This Code", ko: "이 코드 사용")
    }

    private func text(en: String, ko: String) -> String {
        language == .ko ? ko : en
    }

    private func scannerFailureMessage(_ failure: QRScannerFailure) -> String {
        switch failure {
        case .noCamera:
            text(en: "This device does not have an available camera.", ko: "이 기기에서 사용할 수 있는 카메라가 없습니다.")
        case .permissionDenied:
            text(
                en: "Camera permission is needed to scan the shuttle QR code. Please enable camera access in Settings.",
                ko: "셔틀 QR 코드를 스캔하려면 카메라 권한이 필요합니다. 설정에서 카메라 접근을 허용해 주세요."
            )
        case .permissionRestricted:
            text(en: "Camera access is restricted on this device.", ko: "이 기기에서는 카메라 접근이 제한되어 있습니다.")
        case .setupFailed:
            text(en: "The camera scanner could not be started.", ko: "카메라 스캐너를 시작하지 못했습니다.")
        case .qrUnsupported:
            text(en: "QR code scanning is not supported by this camera.", ko: "이 카메라에서는 QR 코드 스캔을 지원하지 않습니다.")
        }
    }
}

private enum QRScannerSheetState: Equatable {
    case scanning
    case failed(QRScannerFailure)
    case manualEntry
}

private enum QRScannerCorner: CaseIterable, Identifiable {
    case topLeading
    case topTrailing
    case bottomLeading
    case bottomTrailing

    var id: Self { self }

    var alignment: Alignment {
        switch self {
        case .topLeading: .topLeading
        case .topTrailing: .topTrailing
        case .bottomLeading: .bottomLeading
        case .bottomTrailing: .bottomTrailing
        }
    }
}

private struct ScannerCorner: Shape {
    let corner: QRScannerCorner

    func path(in rect: CGRect) -> Path {
        var path = Path()

        switch corner {
        case .topLeading:
            path.move(to: CGPoint(x: rect.minX, y: rect.maxY))
            path.addLine(to: CGPoint(x: rect.minX, y: rect.minY))
            path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        case .topTrailing:
            path.move(to: CGPoint(x: rect.minX, y: rect.minY))
            path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
            path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        case .bottomLeading:
            path.move(to: CGPoint(x: rect.minX, y: rect.minY))
            path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
            path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        case .bottomTrailing:
            path.move(to: CGPoint(x: rect.minX, y: rect.maxY))
            path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
            path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        }

        return path
    }
}

private struct NativeQRScannerView: UIViewControllerRepresentable {
    let onScan: (String) -> Void
    let onFailure: (QRScannerFailure) -> Void

    func makeUIViewController(context: Context) -> QRScannerViewController {
        QRScannerViewController(
            onScan: onScan,
            onFailure: onFailure
        )
    }

    func updateUIViewController(_ uiViewController: QRScannerViewController, context: Context) {}

    static func dismantleUIViewController(_ uiViewController: QRScannerViewController, coordinator: ()) {
        uiViewController.stopScanning()
    }
}

private final class QRScannerViewController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    private let onScan: (String) -> Void
    private let onFailure: (QRScannerFailure) -> Void
    private let captureSession = AVCaptureSession()
    private let sessionQueue = DispatchQueue(label: "sg.nasumchurch.shuttle.qr-scanner")
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private var didEmitPayload = false

    init(onScan: @escaping (String) -> Void, onFailure: @escaping (QRScannerFailure) -> Void) {
        self.onScan = onScan
        self.onFailure = onFailure
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        prepareCamera()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer?.frame = view.bounds
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        stopScanning()
    }

    func stopScanning() {
        sessionQueue.async { [captureSession] in
            if captureSession.isRunning {
                captureSession.stopRunning()
            }
        }
    }

    private func prepareCamera() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            configureSession()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                DispatchQueue.main.async {
                    guard let self else { return }
                    granted ? self.configureSession() : self.reportFailure(.permissionDenied)
                }
            }
        case .denied:
            reportFailure(.permissionDenied)
        case .restricted:
            reportFailure(.permissionRestricted)
        @unknown default:
            reportFailure(.setupFailed)
        }
    }

    private func configureSession() {
        sessionQueue.async { [weak self] in
            guard let self else { return }

            guard let videoDevice = AVCaptureDevice.default(for: .video) else {
                DispatchQueue.main.async { self.reportFailure(.noCamera) }
                return
            }

            do {
                let videoInput = try AVCaptureDeviceInput(device: videoDevice)

                guard self.captureSession.canAddInput(videoInput) else {
                    DispatchQueue.main.async { self.reportFailure(.setupFailed) }
                    return
                }
                self.captureSession.addInput(videoInput)

                let metadataOutput = AVCaptureMetadataOutput()
                guard self.captureSession.canAddOutput(metadataOutput) else {
                    DispatchQueue.main.async { self.reportFailure(.setupFailed) }
                    return
                }
                self.captureSession.addOutput(metadataOutput)
                metadataOutput.setMetadataObjectsDelegate(self, queue: DispatchQueue.main)

                guard metadataOutput.availableMetadataObjectTypes.contains(.qr) else {
                    DispatchQueue.main.async { self.reportFailure(.qrUnsupported) }
                    return
                }
                metadataOutput.metadataObjectTypes = [.qr]

                DispatchQueue.main.async {
                    let previewLayer = AVCaptureVideoPreviewLayer(session: self.captureSession)
                    previewLayer.videoGravity = .resizeAspectFill
                    previewLayer.frame = self.view.bounds
                    self.view.layer.insertSublayer(previewLayer, at: 0)
                    self.previewLayer = previewLayer
                }

                self.captureSession.startRunning()
            } catch {
                DispatchQueue.main.async { self.reportFailure(.setupFailed) }
            }
        }
    }

    func metadataOutput(
        _ output: AVCaptureMetadataOutput,
        didOutput metadataObjects: [AVMetadataObject],
        from connection: AVCaptureConnection
    ) {
        guard
            !didEmitPayload,
            let metadataObject = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
            metadataObject.type == .qr,
            let payload = metadataObject.stringValue,
            !payload.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else { return }

        didEmitPayload = true
        stopScanning()
        onScan(payload)
    }

    private func reportFailure(_ failure: QRScannerFailure) {
        onFailure(failure)
    }
}

private enum QRScannerFailure: Equatable {
    case noCamera
    case permissionDenied
    case permissionRestricted
    case setupFailed
    case qrUnsupported
}
