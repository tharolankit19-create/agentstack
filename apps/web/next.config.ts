import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app lives in an npm workspace, so the file tracer is told where the
  // monorepo actually starts rather than left to infer it from lockfiles.
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
};

export default nextConfig;
