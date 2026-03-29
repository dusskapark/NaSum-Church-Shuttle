import tw from "tailwind-styled-components";
import Map from "./components/Map";
import Link from "next/link";
import { Button, Card, Space } from "antd";
import { CarOutlined, RocketOutlined, CalendarOutlined } from "@ant-design/icons";

export default function Home() {
  return (
    <Wrapper>
      <Map />
      <ActionItems>
        <Header>
          <UberLogo src="https://i.ibb.co/84stgjq/uber-technologies-new-20218114.jpg" />
        </Header>

        <Space direction="horizontal" size={12} style={{ width: "100%" }}>
          <Link href="/search" passHref>
            <FeatureCard hoverable>
              <CarOutlined style={{ fontSize: 28 }} />
              Ride
            </FeatureCard>
          </Link>
          <FeatureCard hoverable>
            <RocketOutlined style={{ fontSize: 28 }} />
            Wheels (Not Available)
          </FeatureCard>
          <FeatureCard hoverable>
            <CalendarOutlined style={{ fontSize: 28 }} />
            Reserve (Not Available)
          </FeatureCard>
        </Space>

        <Link href="/search" passHref>
          <Button type="default" size="large" block style={{ marginTop: 20, height: 56 }}>
            Where to?
          </Button>
        </Link>
      </ActionItems>
    </Wrapper>
  );
}

const Wrapper = tw.div`
flex flex-col h-screen
`;

const ActionItems = tw.div`
flex-1 p-4
`;

const Header = tw.div`
flex justify-between items-center
`;

const UberLogo = tw.img`
h-28
`;

const FeatureCard = tw(Card)`
flex: 1;
text-align: center;
`;
