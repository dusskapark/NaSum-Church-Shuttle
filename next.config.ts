import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  typedRoutes: false,
  experimental: {
    useWasmBinary: true,
  },
  webpack(config) {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@grabjs/superapp-sdk': path.resolve(
        __dirname,
        'src/shims/superapp-sdk.ts',
      ),
    };
    return config;
  },
};

export default nextConfig;
