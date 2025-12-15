import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://backend-campari-lottery-production.up.railway.app/api/:path*',
      },
    ];
  },
  // Disable caching to ensure fresh builds on Railway
  generateBuildId: async () => {
    // Use timestamp to force new build ID each time
    return `build-${Date.now()}`;
  },
};

export default nextConfig;