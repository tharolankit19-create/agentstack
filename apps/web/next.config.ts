import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // The deploy route ships the entire hermes-core source to Vercel, so the
    // generated bundle must survive tree-shaking of the server build.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
