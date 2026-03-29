import { useEffect, useRef } from "react";
import tw from "tailwind-styled-components";
import mapboxgl from "mapbox-gl";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

const Map = ({ pickupCoordinate, dropoffCoordinate }) => {
  const mapContainerRef = useRef(null);
  const hasMapboxToken = Boolean(mapboxgl.accessToken);

  useEffect(() => {
    if (!mapContainerRef.current || !hasMapboxToken) return undefined;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
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

  if (!hasMapboxToken) {
    return (
      <FallbackMessage>
        지도를 표시하려면 MAPBOX 토큰(NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN)이 필요합니다.
      </FallbackMessage>
    );
  }

  return <Wrapper ref={mapContainerRef} />;
};

export default Map;

const Wrapper = tw.div`
flex flex-1
`;

const FallbackMessage = tw.div`
flex flex-1 items-center justify-center bg-gray-100 text-center text-sm text-gray-700 p-4
`;
