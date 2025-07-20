
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    serverActions: {
      allowedDevOrigins: [
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          'https://*.cloudworkstations.dev' // Added for Firebase Studio environment
      ],
    },
  },
};

export default nextConfig;
