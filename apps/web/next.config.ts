import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@knowledge-map/api-client', '@knowledge-map/contracts', '@knowledge-map/design-tokens'],
  async rewrites() {
    return [{ source: '/api/:path*', destination: 'http://127.0.0.1:4000/:path*' }];
  },
};

export default nextConfig;
