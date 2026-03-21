import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // Standalone only for production builds; dev uses full runtime
  ...(process.env.NODE_ENV === 'production' ? {
    output: 'standalone',
    outputFileTracingRoot: path.join(__dirname),
  } : {}),
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  // Disable features that trigger localStorage simulation in dev
  ...(process.env.NODE_ENV === 'production' ? {} : {
    serverExternalPackages: [],
  }),
};

export default nextConfig;
