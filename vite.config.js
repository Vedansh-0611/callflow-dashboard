import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves the site from /callflow-dashboard/, so assets need that prefix.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "build" ? "/callflow-dashboard/" : "/",
  build: {
    // recharts and the mock JSON are each ~530 kB raw (~50-150 kB gzipped).
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      // Keep big libraries in their own cached chunks.
      output: { manualChunks: { react: ["react", "react-dom"], charts: ["recharts"] } },
    },
  },
}));
