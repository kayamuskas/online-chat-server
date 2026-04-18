import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Vite build configuration for apps/web.
 *
 * Key constraints:
 * - All assets must be bundled locally — no CDN, no external fonts, no runtime
 *   script downloads.
 * - Output goes to dist/ which the container serves as static files.
 * - publicDir points to public/ so the static healthz asset is served at /healthz.
 */
export default defineConfig({
  plugins: [react()],
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
