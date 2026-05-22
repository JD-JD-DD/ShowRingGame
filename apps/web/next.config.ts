import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": ["../../docs/*.csv", "../../docs/*.txt"],
  },
};

export default nextConfig;
