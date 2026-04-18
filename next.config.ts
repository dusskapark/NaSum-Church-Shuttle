import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: false,
  allowedDevOrigins: [
    '*.lhr.life',
    '*.localhost.run',
  ],
  transpilePackages: ['antd-mobile'],
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    useWasmBinary: true,
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
