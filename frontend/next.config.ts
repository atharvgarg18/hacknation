import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable strict mode for 3d-force-graph compatibility (double rendering causes issues)
  reactStrictMode: false,

  // Turbopack config (Next.js 16 default)
  turbopack: {},
};

export default nextConfig;
