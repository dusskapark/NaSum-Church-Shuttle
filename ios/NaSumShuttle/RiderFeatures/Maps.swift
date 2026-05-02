import CoreLocation
import SwiftUI
#if canImport(GoogleMaps)
import GoogleMaps
#endif

struct ShuttleMap: View {
    let route: RouteDetail?
    let selectedStopId: String?
    let activeStates: [StopBoardingState]
    var focusedUserLocation: CLLocation?
    var focusedUserLocationRequestId = 0
    var bottomPadding: CGFloat = 360
    var trailingPadding: CGFloat = 18

    var body: some View {
        Group {
            if let route {
                #if canImport(GoogleMaps)
                GoogleRouteMapView(
                    route: route,
                    selectedStopId: selectedStopId,
                    activeStates: activeStates,
                    focusedUserLocation: focusedUserLocation,
                    focusedUserLocationRequestId: focusedUserLocationRequestId,
                    bottomPadding: bottomPadding,
                    trailingPadding: trailingPadding
                )
                #else
                MapUnavailableView(title: "Google Maps package missing")
                #endif
            } else {
                MapUnavailableView(title: "No stops to display")
            }
        }
        .ignoresSafeArea()
    }
}

struct StationBrowserMap: View {
    let places: [PlaceSummary]
    let onSelect: (PlaceSummary) -> Void

    var body: some View {
        Group {
            if places.isEmpty {
                MapUnavailableView(title: "No stops to display")
            } else {
                #if canImport(GoogleMaps)
                GoogleStationBrowserMapView(places: places, onSelect: onSelect)
                #else
                MapUnavailableView(title: "Google Maps package missing")
                #endif
            }
        }
        .ignoresSafeArea()
    }
}

struct StopPreviewMap: View {
    let stop: StopCandidate?

    var body: some View {
        Group {
            if let stop {
                #if canImport(GoogleMaps)
                GoogleSingleStopMapView(
                    title: stop.name,
                    coordinate: (stop.lat, stop.lng),
                    interactive: false
                )
                #else
                MapUnavailableView(title: stop.name)
                #endif
            } else {
                MapUnavailableView(title: "Stop location preview")
            }
        }
    }
}

struct RouteMapCard: View {
    let route: RouteDetail?
    let selectedStopId: String?
    let activeStates: [StopBoardingState]

    var body: some View {
        ShuttleMap(route: route, selectedStopId: selectedStopId, activeStates: activeStates)
            .frame(minHeight: 220)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

struct SingleStopMapCard: View {
    let title: String
    let coordinate: (lat: Double, lng: Double)

    var body: some View {
        #if canImport(GoogleMaps)
        GoogleSingleStopMapView(title: title, coordinate: coordinate, interactive: false)
            .frame(height: 220)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        #else
        MapUnavailableView(title: title)
            .frame(maxWidth: .infinity, minHeight: 220)
        #endif
    }
}

private struct MapUnavailableView: View {
    let title: String

    var body: some View {
        ZStack {
            Color(.secondarySystemGroupedBackground)
            ContentUnavailableView(title, systemImage: "map")
                .foregroundStyle(.secondary)
        }
    }
}

#if canImport(GoogleMaps)
private struct GoogleRouteMapView: UIViewRepresentable {
    let route: RouteDetail
    let selectedStopId: String?
    let activeStates: [StopBoardingState]
    let focusedUserLocation: CLLocation?
    let focusedUserLocationRequestId: Int
    let bottomPadding: CGFloat
    let trailingPadding: CGFloat

    func makeUIView(context: Context) -> GMSMapView {
        let mapView = GMSMapView(options: GMSMapViewOptions())
        mapView.isMyLocationEnabled = true
        mapView.settings.compassButton = false
        mapView.settings.myLocationButton = false
        mapView.settings.rotateGestures = false
        mapView.settings.tiltGestures = false
        mapView.padding = mapInsets
        return mapView
    }

    func updateUIView(_ mapView: GMSMapView, context: Context) {
        mapView.clear()
        mapView.isMyLocationEnabled = true
        mapView.settings.myLocationButton = false
        mapView.padding = mapInsets

        let stateLookup = Dictionary(uniqueKeysWithValues: activeStates.map { ($0.routeStopId, $0) })
        let stopPoints = route.stops.map {
            CLLocationCoordinate2D(latitude: $0.place.lat, longitude: $0.place.lng)
        }
        let linePoints = route.cachedPath.isEmpty
            ? stopPoints
            : route.cachedPath.map { CLLocationCoordinate2D(latitude: $0.lat, longitude: $0.lng) }
        let path = GMSMutablePath()
        linePoints.forEach { path.add($0) }

        if path.count() > 1 {
            let polyline = GMSPolyline(path: path)
            polyline.strokeColor = activeStates.isEmpty ? UIColor.shuttleSecondary : UIColor.shuttlePrimary
            polyline.strokeWidth = 4
            polyline.map = mapView
        }

        var bounds = GMSCoordinateBounds()
        route.stops.enumerated().forEach { index, stop in
            let coordinate = CLLocationCoordinate2D(latitude: stop.place.lat, longitude: stop.place.lng)
            bounds = bounds.includingCoordinate(coordinate)

            let state = stateLookup[stop.id]
            let marker = GMSMarker(position: coordinate)
            marker.title = stop.place.displayName ?? stop.place.name
            marker.snippet = state.map { "\($0.totalPassengers) boarded" } ?? stop.pickupTime
            marker.icon = markerIcon(
                label: activeStates.isEmpty ? "\(index + 1)" : "\(state?.totalPassengers ?? 0)",
                isSelected: stop.id == selectedStopId,
                isArrived: state?.status == "arrived",
                runActive: !activeStates.isEmpty
            )
            marker.map = mapView
        }

        let cameraSignature = routeCameraSignature
        if context.coordinator.lastRouteCameraSignature != cameraSignature {
            context.coordinator.lastRouteCameraSignature = cameraSignature
            if route.stops.count == 1, let onlyStop = route.stops.first {
                mapView.camera = GMSCameraPosition(latitude: onlyStop.place.lat, longitude: onlyStop.place.lng, zoom: 14)
            } else if !route.stops.isEmpty {
                mapView.animate(with: GMSCameraUpdate.fit(bounds, withPadding: 56))
            }
        }

        if
            let selectedStopId,
            let selectedStop = route.stops.first(where: { $0.id == selectedStopId })
        {
            let selectedStopCameraSignature = "\(route.routeCode)|\(selectedStopId)"
            if context.coordinator.lastSelectedStopCameraSignature != selectedStopCameraSignature {
                context.coordinator.lastSelectedStopCameraSignature = selectedStopCameraSignature
                mapView.animate(to: GMSCameraPosition(
                    latitude: selectedStop.place.lat,
                    longitude: selectedStop.place.lng,
                    zoom: max(mapView.camera.zoom, 14.2)
                ))
            }
        }

        if
            let focusedUserLocation,
            focusedUserLocationRequestId != context.coordinator.lastFocusedUserLocationRequestId
        {
            context.coordinator.lastFocusedUserLocationRequestId = focusedUserLocationRequestId
            mapView.animate(to: GMSCameraPosition(
                latitude: focusedUserLocation.coordinate.latitude,
                longitude: focusedUserLocation.coordinate.longitude,
                zoom: max(mapView.camera.zoom, 15)
            ))
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    private var mapInsets: UIEdgeInsets {
        UIEdgeInsets(
            top: 72,
            left: 18,
            bottom: bottomPadding,
            right: trailingPadding
        )
    }

    private var routeCameraSignature: String {
        let stopIds = route.stops.map(\.id).joined(separator: ",")
        return "\(route.routeCode)|\(stopIds)"
    }

    final class Coordinator {
        var lastRouteCameraSignature: String?
        var lastSelectedStopCameraSignature: String?
        var lastFocusedUserLocationRequestId = 0
    }

    private func markerIcon(label: String, isSelected: Bool, isArrived: Bool, runActive: Bool) -> UIImage? {
        let size = CGSize(width: 30, height: 30)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { context in
            let rect = CGRect(origin: .zero, size: size).insetBy(dx: 2, dy: 2)
            let fill = isSelected ? UIColor.shuttlePrimary : UIColor.white
            let stroke = runActive ? UIColor.shuttlePrimary : UIColor.shuttleSecondary
            fill.setFill()
            stroke.setStroke()
            let path = UIBezierPath(ovalIn: rect)
            path.lineWidth = 2
            path.fill()
            path.stroke()

            let paragraph = NSMutableParagraphStyle()
            paragraph.alignment = .center
            let attrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 11, weight: .bold),
                .foregroundColor: isSelected ? UIColor.white : stroke,
                .paragraphStyle: paragraph
            ]
            NSString(string: label).draw(
                in: CGRect(x: 0, y: 8, width: size.width, height: 14),
                withAttributes: attrs
            )

            if isArrived {
                UIColor.shuttleSuccess.setFill()
                context.cgContext.fillEllipse(in: CGRect(x: 21, y: 3, width: 7, height: 7))
            }
        }
    }
}

private struct GoogleStationBrowserMapView: UIViewRepresentable {
    let places: [PlaceSummary]
    let onSelect: (PlaceSummary) -> Void

    func makeUIView(context: Context) -> GMSMapView {
        let mapView = GMSMapView(options: GMSMapViewOptions())
        mapView.delegate = context.coordinator
        mapView.settings.compassButton = false
        mapView.settings.myLocationButton = false
        mapView.settings.rotateGestures = false
        mapView.settings.tiltGestures = false
        mapView.padding = UIEdgeInsets(top: 120, left: 18, bottom: 104, right: 18)
        return mapView
    }

    func updateUIView(_ mapView: GMSMapView, context: Context) {
        context.coordinator.places = Dictionary(uniqueKeysWithValues: places.map { ($0.googlePlaceId, $0) })
        mapView.clear()

        var bounds = GMSCoordinateBounds()
        places.forEach { place in
            let coordinate = CLLocationCoordinate2D(latitude: place.lat, longitude: place.lng)
            bounds = bounds.includingCoordinate(coordinate)
            let marker = GMSMarker(position: coordinate)
            marker.title = place.name
            marker.userData = place.googlePlaceId
            marker.icon = GMSMarker.markerImage(with: place.isTerminal ? UIColor.shuttleSuccess : UIColor.shuttlePrimary)
            marker.map = mapView
        }

        if places.count == 1, let only = places.first {
            mapView.camera = GMSCameraPosition(latitude: only.lat, longitude: only.lng, zoom: 14)
        } else if !places.isEmpty {
            mapView.animate(with: GMSCameraUpdate.fit(bounds, withPadding: 56))
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(onSelect: onSelect)
    }

    final class Coordinator: NSObject, GMSMapViewDelegate {
        var places: [String: PlaceSummary] = [:]
        let onSelect: (PlaceSummary) -> Void

        init(onSelect: @escaping (PlaceSummary) -> Void) {
            self.onSelect = onSelect
        }

        func mapView(_ mapView: GMSMapView, didTap marker: GMSMarker) -> Bool {
            guard let id = marker.userData as? String, let place = places[id] else { return false }
            onSelect(place)
            return true
        }
    }
}

private struct GoogleSingleStopMapView: UIViewRepresentable {
    let title: String
    let coordinate: (lat: Double, lng: Double)
    let interactive: Bool

    func makeUIView(context: Context) -> GMSMapView {
        let mapView = GMSMapView(options: GMSMapViewOptions())
        mapView.settings.scrollGestures = interactive
        mapView.settings.zoomGestures = interactive
        mapView.settings.tiltGestures = false
        mapView.settings.rotateGestures = false
        mapView.settings.compassButton = false
        mapView.settings.myLocationButton = false
        return mapView
    }

    func updateUIView(_ mapView: GMSMapView, context: Context) {
        mapView.clear()
        mapView.camera = GMSCameraPosition(latitude: coordinate.lat, longitude: coordinate.lng, zoom: 15)
        let marker = GMSMarker(position: CLLocationCoordinate2D(latitude: coordinate.lat, longitude: coordinate.lng))
        marker.title = title
        marker.icon = GMSMarker.markerImage(with: UIColor.shuttlePrimary)
        marker.map = mapView
    }
}

private extension UIColor {
    static let shuttlePrimary = UIColor(red: 31 / 255, green: 111 / 255, blue: 235 / 255, alpha: 1)
    static let shuttleSecondary = UIColor(red: 140 / 255, green: 149 / 255, blue: 159 / 255, alpha: 1)
    static let shuttleSuccess = UIColor(red: 26 / 255, green: 127 / 255, blue: 55 / 255, alpha: 1)
}
#endif
