import { useEffect } from "react";
import tw from "tailwind-styled-components";
import mapboxgl from "mapbox-gl";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

const Map = ({ pickupCoordinate, dropoffCoordinate }) => {
  useEffect(() => {
    const map = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/mapbox/streets-v11",
      center: [-96, 37.8],
      zoom: 3,
    });

    if (pickupCoordinate && dropoffCoordinate) {
      const marker1 = new mapboxgl.Marker().setLngLat(pickupCoordinate).addTo(map);
      const marker2 = new mapboxgl.Marker().setLngLat(dropoffCoordinate).addTo(map);
      map.fitBounds([pickupCoordinate, dropoffCoordinate], { padding: 100 });

      return () => {
        marker1.remove();
        marker2.remove();
        map.remove();
      };
    }

    return () => map.remove();
  }, [pickupCoordinate, dropoffCoordinate]);

  return <Wrapper id="map" />;
};

export default Map;

const Wrapper = tw.div`
flex flex-1
`;
