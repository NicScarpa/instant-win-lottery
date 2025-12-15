import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable caching to ensure fresh builds on Railway
  generateBuildId: async () => {
    // Use timestamp to force new build ID each time
    return `build-${Date.now()}`;
  },
  // Empty turbopack config to silence the warning
  turbopack: {},
  // Add headers to disable all caching
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
    ];
  },
};

export default nextConfig;