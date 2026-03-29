"use client";

import { App, ConfigProvider, theme as antdTheme } from "antd";
import type { ThemeConfig } from "antd";

const theme: ThemeConfig = {
  algorithm: [antdTheme.defaultAlgorithm],
  token: {
    colorPrimary: "#0f766e",
    colorInfo: "#2563eb",
    colorSuccess: "#15803d",
    colorWarning: "#d97706",
    colorTextBase: "#0f172a",
    colorBgBase: "#eff4f6",
    colorBorder: "#d7dee4",
    borderRadius: 18,
    borderRadiusLG: 28,
    controlHeight: 42,
    fontFamily:
      '"Avenir Next", "Pretendard Variable", "Noto Sans KR", "Apple SD Gothic Neo", sans-serif',
    boxShadow:
      "0 18px 50px rgba(15, 23, 42, 0.12), 0 4px 20px rgba(15, 23, 42, 0.08)",
  },
  components: {
    Button: {
      borderRadius: 999,
      controlHeight: 42,
      fontWeight: 600,
    },
    Card: {
      borderRadiusLG: 28,
    },
    Input: {
      borderRadius: 18,
      controlHeight: 46,
    },
    Segmented: {
      trackBg: "rgba(148, 163, 184, 0.12)",
      itemSelectedBg: "#0f172a",
      itemSelectedColor: "#ffffff",
    },
    Tag: {
      borderRadiusSM: 999,
    },
    List: {
      itemPadding: "12px 0",
    },
  },
};

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider theme={theme}>
      <App>{children}</App>
    </ConfigProvider>
  );
}
