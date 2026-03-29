import { useEffect, useState } from "react";
import tw from "tailwind-styled-components";
import Map from "./components/Map";
import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import RideSelector from "./components/RideSelector";

const Confirm = () => {
  const router = useRouter();
  const { pickuplocation, dropofflocation } = router.query;
  const [pickupCoordinate, setPickupCoordinate] = useState([-77.052256, 38.924735]);
  const [dropoffCoordinate, setDropoffCoordinate] = useState([-77.1703, 38.8407]);

  const geocodeLocation = async (location, setter) => {
    if (!location) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!token) return;

    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${location}.json?` +
        new URLSearchParams({
          access_token: token,
          limit: 1,
        })
    );

    const data = await response.json();
    if (data?.features?.[0]?.center) {
      setter(data.features[0].center);
    }
  };

  useEffect(() => {
    geocodeLocation(pickuplocation, setPickupCoordinate);
    geocodeLocation(dropofflocation, setDropoffCoordinate);
  }, [pickuplocation, dropofflocation]);

  return (
    <Wrapper>
      <ButtonContainer>
        <Link href="/search" passHref>
          <Button type="default" shape="circle" icon={<ArrowLeftOutlined />} size="large" />
        </Link>
      </ButtonContainer>

      <Map pickupCoordinate={pickupCoordinate} dropoffCoordinate={dropoffCoordinate} />
      <RideContainer>
        <RideSelector pickupCoordinate={pickupCoordinate} dropoffCoordinate={dropoffCoordinate} />
      </RideContainer>
    </Wrapper>
  );
};

const Wrapper = tw.div`
flex flex-col h-screen
`;

const RideContainer = tw.div`
flex-1 h-1/2 overflow-y-scroll flex flex-col
`;

const ButtonContainer = tw.div`
rounded-full absolute top-4 left-4 z-10 bg-white shadow-md cursor-pointer
`;

export default Confirm;
