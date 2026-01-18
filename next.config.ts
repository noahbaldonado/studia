import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents disabled to allow dynamic route segment configs
  // Specify the correct workspace root to avoid confusion from parent directory lockfiles
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
