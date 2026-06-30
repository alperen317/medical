import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Production Docker: emit a minimal self-contained server in .next/standalone
  output: "standalone",
  // Keep these as server-side Node.js modules (avoid bundling):
  // - pdf-parse: canvas bundling issues
  // - @prisma/client / adapter-pg: keep the WASM query compiler import paths
  //   (@prisma/client/runtime/query_compiler_*) intact so they're traced.
  serverExternalPackages: ["pdf-parse", "@prisma/client", "@prisma/adapter-pg"],
  // Belt-and-suspenders: force the Prisma WASM query compiler runtime files into
  // the standalone trace (a dynamic import() can otherwise be missed).
  outputFileTracingIncludes: {
    "/**": ["./node_modules/@prisma/client/runtime/query_compiler_fast_bg.postgresql.*"],
  },
  turbopack: {},
};

export default nextConfig;
