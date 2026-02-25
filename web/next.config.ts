import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone', // Cloud Run için standalone output
  eslint: {
    // Build sırasında ESLint hatalarını ignore et
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Build sırasında TypeScript hatalarını ignore et (opsiyonel)
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '5015',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.save-all.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
