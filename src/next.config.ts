
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
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/**',
      }
    ],
  },
  experimental: {
    serverActions: {
      allowedDevOrigins: [
          'localhost:9006', 
          'http://localhost:9006',
          'http://127.0.0.1:9006'
      ],
    },
  },
};

export default nextConfig;
