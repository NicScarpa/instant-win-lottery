import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable caching to ensure fresh builds on Railway
  generateBuildId: async () => {
    // Use timestamp to force new build ID each time
    return `build-${Date.now()}`;
  },
};

export default nextConfig;