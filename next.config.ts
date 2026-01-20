import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents disabled to allow dynamic route segment configs
  // Specify the correct workspace root to avoid confusion from parent directory lockfiles
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
