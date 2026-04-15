import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typedRoutes: false,
  experimental: {
    useWasmBinary: true,
  },
};

export default nextConfig;
