import { useMemo } from "react";
import tw from "tailwind-styled-components";
import { GoogleMap, MarkerF, useJsApiLoader } from "@react-google-maps/api";

const defaultCenter = { lat: 37.7749, lng: -122.4194 };
const containerStyle = { width: "100%", height: "100%" };

const Map = ({ pickupCoordinate, dropoffCoordinate }) => {
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });

  const bounds = useMemo(() => {
    if (!pickupCoordinate || !dropoffCoordinate) return null;

    return {
      south: Math.min(pickupCoordinate[1], dropoffCoordinate[1]),
      west: Math.min(pickupCoordinate[0], dropoffCoordinate[0]),
      north: Math.max(pickupCoordinate[1], dropoffCoordinate[1]),
      east: Math.max(pickupCoordinate[0], dropoffCoordinate[0]),
    };
  }, [pickupCoordinate, dropoffCoordinate]);

  if (!isLoaded) {
    return <Wrapper>지도를 불러오는 중...</Wrapper>;
  }

  return (
    <Wrapper>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={defaultCenter}
        zoom={11}
        onLoad={(map) => {
          if (bounds) {
            map.fitBounds(bounds);
          }
        }}
        options={{ disableDefaultUI: true }}
      >
        {pickupCoordinate && (
          <MarkerF position={{ lat: pickupCoordinate[1], lng: pickupCoordinate[0] }} />
        )}
        {dropoffCoordinate && (
          <MarkerF position={{ lat: dropoffCoordinate[1], lng: dropoffCoordinate[0] }} />
        )}
      </GoogleMap>
    </Wrapper>
  );
};

export default Map;

const Wrapper = tw.div`
flex flex-1
`;
