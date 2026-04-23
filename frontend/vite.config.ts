import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  server: { host: "0.0.0.0", port: 3000 },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
    dedupe: ["three"],
  },
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return;
          if (/three|three-globe|react-globe\.gl|cobe/.test(id)) return "globe-3d";
          if (/@deck\.gl|maplibre-gl/.test(id)) return "map-gl";
          if (/echarts/.test(id)) return "echarts";
          if (/recharts|d3-/.test(id)) return "charts";
          if (/@radix-ui|framer-motion|sonner|cmdk/.test(id)) return "ui-vendor";
          if (/react-dom|react-router/.test(id)) return "react-vendor";
        },
      },
    },
  },
});
