import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typedRoutes: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    useWasmBinary: true,
  },
};

export default nextConfig;
