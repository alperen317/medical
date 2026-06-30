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
      // pdfjs-dist tamamı: pdf.worker.mjs (fake worker), cmaps (CID/Türkçe
      // fontlar), standard_fonts ve wasm decoder'lar fs ile okunur, import
      // edilmez → trace kaçırır. Eksiklerinde getText patlar → boş metin.
      "./node_modules/pdfjs-dist/**",
    ],
  },
  turbopack: {},
};

export default nextConfig;
