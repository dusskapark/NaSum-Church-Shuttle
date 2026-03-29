import React, { useMemo } from "react";
import tw from "tailwind-styled-components";
import { carList } from "../../data/carList";

const RideSelector = ({ pickupCoordinate, dropoffCoordinate }) => {
  const distanceKm = useMemo(() => {
    if (!pickupCoordinate || !dropoffCoordinate) return 0;

    const toRad = (value) => (value * Math.PI) / 180;
    const [lng1, lat1] = pickupCoordinate;
    const [lng2, lat2] = dropoffCoordinate;

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return 6371 * c;
  }, [pickupCoordinate, dropoffCoordinate]);

  const rideDuration = useMemo(() => {
    if (!distanceKm) return 0;
    const averageSpeedKmPerHour = 30;
    return Math.round((distanceKm / averageSpeedKmPerHour) * 3600);
  }, [distanceKm]);

  return (
    <Wrapper>
      <Title>Choose a ride, or swipe up for more</Title>
      <CarList>
        {carList.map((car, index) => (
          <Car key={index}>
            <CarImage src={car.imgUrl} />
            <CarDetails>
              <Service>{car.service}</Service>
              <Time>{rideDuration / 100} min away</Time>
            </CarDetails>
            <Price>
              ${" "}
              {(rideDuration * car.multiplier).toFixed(2)}
            </Price>
          </Car>
        ))}
      </CarList>
      <ConfirmButton>Confirm {carList[0].service}</ConfirmButton>
    </Wrapper>
  );
};

export default RideSelector;

const Wrapper = tw.div`
flex-1 overflow-y-scroll flex flex-col
`;

const Title = tw.div`
text-center text-xs py-2 border-b
`;

const CarList = tw.div`
overflow-y-scroll
`;

const Car = tw.div`
flex p-4 items-center
`;

const CarImage = tw.img`
h-14 mr-4
`;

const CarDetails = tw.div`
flex-1
`;

const Service = tw.div`
font-medium
`;

const Time = tw.div`
text-xs text-blue-500
`;

const Price = tw.div`
text-sm
`;

const ConfirmButton = tw.div`
bg-black text-white m-4 py-4 text-center text-xl
`;
