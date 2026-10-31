import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The shared pipeline (lib/pipeline.js) posts to /propose, /log, /counts. Keep those paths.
  async rewrites() {
    return [
      { source: "/propose", destination: "/api/propose" },
      { source: "/log", destination: "/api/log" },
      { source: "/counts", destination: "/api/counts" },
    ];
  },
};
export default nextConfig;
