import type { Metadata } from 'next';
import 'antd-mobile/es/global';
import '../src/styles/globals.css';

export const metadata: Metadata = {
  title: 'NaSum Church Shuttle',
  description: 'LINE LIFF mini app for shuttle route registration and check-in.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
