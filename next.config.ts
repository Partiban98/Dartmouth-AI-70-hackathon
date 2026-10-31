import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server code reads local/ and data/ at runtime, so the build's file tracing would otherwise list the key file,
  // this laptop's papers and name maps, the answer keys and test fixtures as server files to package.
  outputFileTracingExcludes: {
    "*": [".env*", "local/**", "grading-data/**", "data/*.eval.json", "demo-papers/**", "tests/**", "docs/**", "legacy/**", ".git/**"],
  },
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
