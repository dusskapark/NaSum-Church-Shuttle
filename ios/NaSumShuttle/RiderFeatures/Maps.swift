import SwiftUI
#if canImport(GoogleMaps)
import GoogleMaps
#endif

struct RouteMapCard: View {
    let route: RouteDetail?
    let selectedStopId: String?
    let activeStates: [StopBoardingState]

    var body: some View {
        Group {
            if let route {
                #if canImport(GoogleMaps)
                GoogleRouteMapView(route: route, selectedStopId: selectedStopId, activeStates: activeStates)
                #else
                ContentUnavailableView(
                    "Google Maps package missing",
                    systemImage: "map",
                    description: Text("Open the Xcode project and resolve Swift packages to enable native maps.")
                )
                .frame(maxWidth: .infinity, minHeight: 220)
                #endif
            } else {
                ContentUnavailableView(
                    "No route selected",
                    systemImage: "map",
                    description: Text("Choose a route to preview the stop map.")
                )
                .frame(maxWidth: .infinity, minHeight: 220)
            }
        }
        .frame(minHeight: 220)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}

struct SingleStopMapCard: View {
    let title: String
    let coordinate: (lat: Double, lng: Double)

    var body: some View {
        #if canImport(GoogleMaps)
        GoogleSingleStopMapView(title: title, coordinate: coordinate)
            .frame(height: 220)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        #else
        ContentUnavailableView(title, systemImage: "map")
            .frame(maxWidth: .infinity, minHeight: 220)
        #endif
    }
}

#if canImport(GoogleMaps)
private struct GoogleRouteMapView: UIViewRepresentable {
    let route: RouteDetail
    let selectedStopId: String?
    let activeStates: [StopBoardingState]

    func makeUIView(context: Context) -> GMSMapView {
        let mapView = GMSMapView(options: GMSMapViewOptions())
        mapView.isMyLocationEnabled = false
        mapView.settings.compassButton = true
        mapView.settings.myLocationButton = false
        return mapView
    }

    func updateUIView(_ mapView: GMSMapView, context: Context) {
        mapView.clear()

        let stateLookup = Dictionary(uniqueKeysWithValues: activeStates.map { ($0.routeStopId, $0) })
        let path = GMSMutablePath()

        route.cachedPath.forEach { point in
            path.add(CLLocationCoordinate2D(latitude: point.lat, longitude: point.lng))
        }

        if path.count() > 1 {
            let polyline = GMSPolyline(path: path)
            polyline.strokeColor = .systemGreen
            polyline.strokeWidth = 4
            polyline.map = mapView
        }

        var bounds = GMSCoordinateBounds()
        route.stops.forEach { stop in
            let coordinate = CLLocationCoordinate2D(latitude: stop.place.lat, longitude: stop.place.lng)
            bounds = bounds.includingCoordinate(coordinate)

            let marker = GMSMarker(position: coordinate)
            marker.title = stop.place.displayName ?? stop.place.name
            let subtitle = stateLookup[stop.id].map { "\($0.totalPassengers) boarded" } ?? stop.pickupTime
            marker.snippet = subtitle
            marker.icon = markerIcon(
                isSelected: stop.id == selectedStopId,
                isArrived: stateLookup[stop.id]?.status == "arrived"
            )
            marker.map = mapView
        }

        if route.stops.count == 1, let onlyStop = route.stops.first {
            mapView.camera = GMSCameraPosition(latitude: onlyStop.place.lat, longitude: onlyStop.place.lng, zoom: 14)
        } else if !route.stops.isEmpty {
            mapView.animate(with: GMSCameraUpdate.fit(bounds, withPadding: 42))
        }
    }

    private func markerIcon(isSelected: Bool, isArrived: Bool) -> UIImage? {
        let configuration = UIImage.SymbolConfiguration(pointSize: 24, weight: .semibold)
        let baseImage = UIImage(
            systemName: isSelected ? "mappin.circle.fill" : "mappin.circle",
            withConfiguration: configuration
        )
        let tint: UIColor = isArrived ? .systemOrange : .systemGreen
        return baseImage?.withTintColor(tint, renderingMode: .alwaysOriginal)
    }
}

private struct GoogleSingleStopMapView: UIViewRepresentable {
    let title: String
    let coordinate: (lat: Double, lng: Double)

    func makeUIView(context: Context) -> GMSMapView {
        let mapView = GMSMapView(options: GMSMapViewOptions())
        mapView.settings.scrollGestures = false
        mapView.settings.zoomGestures = false
        mapView.settings.tiltGestures = false
        mapView.settings.rotateGestures = false
        return mapView
    }

    func updateUIView(_ mapView: GMSMapView, context: Context) {
        mapView.clear()
        mapView.camera = GMSCameraPosition(latitude: coordinate.lat, longitude: coordinate.lng, zoom: 14)
        let marker = GMSMarker(position: CLLocationCoordinate2D(latitude: coordinate.lat, longitude: coordinate.lng))
        marker.title = title
        marker.map = mapView
    }
}
#endif
