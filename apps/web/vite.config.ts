import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * Vite build configuration for apps/web.
 *
 * Key constraints:
 * - All assets must be bundled locally — no CDN, no external fonts, no runtime
 *   script downloads.
 * - Output goes to dist/ which the container serves as static files.
 * - publicDir points to public/ so the static healthz asset is served at /healthz.
 *
 * @chat/shared is aliased to its TypeScript source so Vite/esbuild processes it
 * directly rather than consuming the CJS dist, which Rollup cannot statically
 * analyse for named exports.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@chat/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  publicDir: "public",
  server: {
    port: 4173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
