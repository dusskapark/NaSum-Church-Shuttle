import React, { useState } from "react";
import Link from "next/link";
import tw from "tailwind-styled-components";
import { Button, Input } from "antd";
import {
  ArrowLeftOutlined,
  PlusOutlined,
  StarFilled,
  EnvironmentOutlined,
  BorderOutlined,
  MoreOutlined,
} from "@ant-design/icons";

const Search = () => {
  const [pickuplocation, setPickuplocation] = useState("");
  const [dropofflocation, setDropofflocation] = useState("");

  return (
    <Wrapper>
      <Link href="/" passHref>
        <BackButton type="text" icon={<ArrowLeftOutlined style={{ fontSize: 22 }} />} />
      </Link>

      <InputContainer>
        <FromToIcons>
          <EnvironmentOutlined style={{ color: "#9CA3AF" }} />
          <MoreOutlined style={{ color: "#9CA3AF", transform: "rotate(90deg)" }} />
          <BorderOutlined />
        </FromToIcons>

        <InputBoxes>
          <Input
            size="large"
            placeholder="Enter pickup location"
            value={pickuplocation}
            onChange={(event) => setPickuplocation(event.target.value)}
          />
          <Input
            size="large"
            placeholder="Where to?"
            value={dropofflocation}
            onChange={(event) => setDropofflocation(event.target.value)}
          />
        </InputBoxes>

        <Button type="default" shape="circle" icon={<PlusOutlined />} size="large" />
      </InputContainer>

      <SavedPlaces>
        <StarFilled style={{ color: "#ffffff", background: "#9CA3AF", borderRadius: "9999px", padding: 10 }} />
        Saved Places (Not available)
      </SavedPlaces>

      <Link
        href={{
          pathname: "/confirm",
          query: {
            pickuplocation,
            dropofflocation,
          },
        }}
        passHref
      >
        <ConfirmButton type="primary" size="large" block>
          Confirm Locations
        </ConfirmButton>
      </Link>
    </Wrapper>
  );
};

export default Search;

const Wrapper = tw.div`
bg-gray-100 h-screen p-4
`;

const BackButton = tw(Button)`
margin-bottom: 12px;
`;

const InputContainer = tw.div`
bg-white flex items-center px-4 py-3 mb-2 rounded-lg shadow-sm
`;

const FromToIcons = tw.div`
flex flex-col w-10 mr-2 items-center gap-3
`;

const InputBoxes = tw.div`
flex flex-col flex-1 gap-2
`;

const SavedPlaces = tw.div`
bg-white flex items-center px-4 py-3 rounded-lg mb-6 gap-2 shadow-sm
`;

const ConfirmButton = tw(Button)`
height: 48px;
`;
