import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
};

export default nextConfig;
