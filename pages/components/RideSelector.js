import React, { useEffect, useState } from "react";
import tw from "tailwind-styled-components";
import { carList } from "../../data/carList";

const RideSelector = ({ pickupCoordinate, dropoffCoordinate }) => {
  const [rideDuration, setRideDuration] = useState(0);

  useEffect(() => {
    const fetchDuration = async () => {
      if (!pickupCoordinate || !dropoffCoordinate) return;

      const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
      if (!token) return;

      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${pickupCoordinate[0]},${pickupCoordinate[1]};${dropoffCoordinate[0]},${dropoffCoordinate[1]}?` +
          new URLSearchParams({
            access_token: token,
          })
      );

      const data = await response.json();
      const duration = data?.routes?.[0]?.duration;
      if (duration) {
        setRideDuration(duration);
      }
    };

    fetchDuration();
  }, [pickupCoordinate, dropoffCoordinate]);

  return (
    <Wrapper>
      <Title>Choose a ride, or swipe up for more</Title>
      <CarList>
        {carList.map((car, index) => (
          <Car key={index}>
            <CarImage src={car.imgUrl} />
            <CarDetails>
              <Service>{car.service}</Service>
              <Time>{(rideDuration / 60).toFixed(0)} min away</Time>
            </CarDetails>
            <Price>$ {(rideDuration * car.multiplier).toFixed(2)}</Price>
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
