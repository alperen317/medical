import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Production Docker: emit a minimal self-contained server in .next/standalone
  output: "standalone",
  // Keep these as server-side Node.js modules (avoid bundling):
  // - pdf-parse / @napi-rs/canvas: native + canvas bundling issues. pdf-parse
  //   needs @napi-rs/canvas at runtime to polyfill DOMMatrix/ImageData/Path2D.
  // - @prisma/client / adapter-pg: keep the WASM query compiler import paths
  //   (@prisma/client/runtime/query_compiler_*) intact so they're traced.
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas", "@prisma/client", "@prisma/adapter-pg"],
  // Belt-and-suspenders: force these into the standalone trace (dynamic/optional
  // requires can otherwise be missed).
  outputFileTracingIncludes: {
    "/**": [
      "./node_modules/@prisma/client/runtime/query_compiler_fast_bg.postgresql.*",
      "./node_modules/@napi-rs/canvas/**",
      "./node_modules/@napi-rs/canvas-*/**",
    ],
  },
  turbopack: {},
};

export default nextConfig;
