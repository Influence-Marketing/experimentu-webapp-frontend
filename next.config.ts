import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  eslint: { ignoreDuringBuilds: true },
  async redirects() {
    // /score was renamed /result; old links and saved resume paths still land.
    return [{ source: "/score", destination: "/result", permanent: false }];
  },
};

export default nextConfig;
