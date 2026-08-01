import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prompt + config files are read from disk at runtime by the template loader.
  // Next's file tracer cannot see through `fs.readFile(path.join(cwd, ...))`,
  // so the template tree is pinned into every serverless function explicitly.
  outputFileTracingIncludes: {
    "/api/**": ["./templates/**/*"],
  },
};

export default nextConfig;
