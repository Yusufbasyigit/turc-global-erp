import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  outputFileTracingExcludes: {
    "*": ["./assets/**", "./handoff/**", "./supabase/**", "./scripts/**"],
  },
};

export default nextConfig;
