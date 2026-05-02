import Observation
import SwiftUI
#if canImport(VisionKit)
import VisionKit
#endif

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

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                #if canImport(VisionKit)
                if DataScannerViewController.isSupported && DataScannerViewController.isAvailable {
                    NativeQRScannerView { payload in
                        onScan(payload)
                    }
                    .frame(maxWidth: .infinity, maxHeight: 320)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                #endif

                TextField("Fallback manual QR payload", text: $manualPayload)
                    .textFieldStyle(.roundedBorder)

                Button("Use Manual Payload") {
                    onScan(manualPayload)
                }
                .shuttleButtonStyle(prominent: true)

                Spacer()
            }
            .padding()
            .navigationTitle(RiderStrings.scanTitle(language))
            .mapSheetCloseOverlay {
                dismiss()
            }
        }
    }
}

#if canImport(VisionKit)
private struct NativeQRScannerView: UIViewControllerRepresentable {
    let onScan: (String) -> Void

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let scanner = DataScannerViewController(
            recognizedDataTypes: [.barcode(symbologies: [.qr])],
            qualityLevel: .balanced,
            recognizesMultipleItems: false,
            isHighFrameRateTrackingEnabled: false,
            isHighlightingEnabled: true
        )
        scanner.delegate = context.coordinator
        try? scanner.startScanning()
        return scanner
    }

    func updateUIViewController(_ uiViewController: DataScannerViewController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(onScan: onScan)
    }

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        let onScan: (String) -> Void

        init(onScan: @escaping (String) -> Void) {
            self.onScan = onScan
        }

        func dataScanner(
            _ dataScanner: DataScannerViewController,
            didAdd addedItems: [RecognizedItem],
            allItems: [RecognizedItem]
        ) {
            guard let first = addedItems.first else { return }
            emitPayload(from: first)
        }

        func dataScanner(
            _ dataScanner: DataScannerViewController,
            didTapOn item: RecognizedItem
        ) {
            emitPayload(from: item)
        }

        private func emitPayload(from item: RecognizedItem) {
            guard case let .barcode(barcode) = item, let payload = barcode.payloadStringValue else { return }
            onScan(payload)
        }
    }
}
#endif
