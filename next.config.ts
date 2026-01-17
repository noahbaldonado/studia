import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Specify the correct workspace root to avoid confusion from parent directory lockfiles
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
