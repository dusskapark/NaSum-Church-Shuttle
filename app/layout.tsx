import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import "leaflet/dist/leaflet.css";

import { AppProviders } from "@/components/app-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "NaSum Church Shuttle",
  description:
    "NaSum Church Shuttle rider mini-app prototype with map, search, and settings.",
  applicationName: "NaSum Church Shuttle",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <AntdRegistry>
          <AppProviders>{children}</AppProviders>
        </AntdRegistry>
      </body>
    </html>
  );
}
