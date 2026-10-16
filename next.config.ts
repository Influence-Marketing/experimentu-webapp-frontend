import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/_gate", destination: "/gate" },
        { source: "/__gate", destination: "/api/gate" },
      ],
    };
  },
};

export default nextConfig;
