import type { NextConfig } from "next";

import { STATIC_SECURITY_HEADERS } from "./app/_lib/security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: true,
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: Object.entries(STATIC_SECURITY_HEADERS).map(([key, value]) => ({
          key,
          value,
        })),
      },
    ];
  },
};

export default nextConfig;
