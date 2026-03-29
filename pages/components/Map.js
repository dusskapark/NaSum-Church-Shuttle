import { useEffect, useRef } from "react";
import tw from "tailwind-styled-components";

const Map = ({ pickupCoordinate, dropoffCoordinate }) => {
  const mapContainerRef = useRef(null);
  const hasMapboxToken = Boolean(process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN);

  useEffect(() => {
    if (!mapContainerRef.current || !hasMapboxToken) return undefined;

    let map;
    let marker1;
    let marker2;

    const loadMap = async () => {
      const mapboxglModule = await import("mapbox-gl");
      const mapboxgl = mapboxglModule.default;

      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

      map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/streets-v11",
        center: [-96, 37.8],
        zoom: 3,
      });

      if (pickupCoordinate && dropoffCoordinate) {
        marker1 = new mapboxgl.Marker().setLngLat(pickupCoordinate).addTo(map);
        marker2 = new mapboxgl.Marker().setLngLat(dropoffCoordinate).addTo(map);
        map.fitBounds([pickupCoordinate, dropoffCoordinate], { padding: 100 });
      }
    };

    loadMap();

    return () => {
      marker1?.remove();
      marker2?.remove();
      map?.remove();
    };
  }, [pickupCoordinate, dropoffCoordinate, hasMapboxToken]);

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
