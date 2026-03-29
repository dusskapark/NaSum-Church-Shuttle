import React, { useEffect, useState } from "react";
import tw from "tailwind-styled-components";
import { Button, List, Typography } from "antd";
import { CarOutlined, ClockCircleOutlined, DollarOutlined } from "@ant-design/icons";
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
      <Title level={5}>Choose a ride, or swipe up for more</Title>
      <List
        itemLayout="horizontal"
        dataSource={carList}
        renderItem={(car) => (
          <List.Item>
            <CarRow>
              <CarImage src={car.imgUrl} alt={car.service} />
              <CarDetails>
                <Typography.Text strong>
                  <CarOutlined /> {car.service}
                </Typography.Text>
                <Typography.Text type="secondary">
                  <ClockCircleOutlined /> {(rideDuration / 60).toFixed(0)} min away
                </Typography.Text>
              </CarDetails>
              <Typography.Text>
                <DollarOutlined /> {(rideDuration * car.multiplier).toFixed(2)}
              </Typography.Text>
            </CarRow>
          </List.Item>
        )}
      />
      <Button type="primary" size="large" block>
        Confirm {carList[0].service}
      </Button>
    </Wrapper>
  );
};

export default RideSelector;

const Wrapper = tw.div`
p-4
`;

const Title = tw(Typography.Title)`
text-align: center;
margin-bottom: 12px !important;
`;

const CarRow = tw.div`
flex items-center w-full
`;

const CarImage = tw.img`
height: 56px;
margin-right: 12px;
`;

const CarDetails = tw.div`
flex: 1;
display: flex;
flex-direction: column;
gap: 4px;
`;
