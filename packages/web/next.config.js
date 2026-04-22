/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@cg/shared'],
  async rewrites() {
    // Proxy /api/backend/* to the Express backend so cookies & CORS Just Work™
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';
    return [
      {
        source: '/api/backend/:path*',
        destination: `${backend}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
