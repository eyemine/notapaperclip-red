import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // Standalone only for production builds; dev uses full runtime
  ...(process.env.NODE_ENV === 'production' ? {
    output: 'standalone',
    outputFileTracingRoot: path.join(__dirname),
  } : {}),
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  // Redirect /erc8004 to / since we moved the ERC-8004 feed to landing page
  async redirects() {
    return [
      {
        source: '/erc8004',
        destination: '/',
        permanent: true,
      },
    ];
  },
  // Disable features that trigger localStorage simulation in dev
  ...(process.env.NODE_ENV === 'production' ? {} : {
    serverExternalPackages: [],
  }),
};

export default nextConfig;
