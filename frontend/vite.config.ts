import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          ui: ["lucide-react", "sonner", "wouter"],
          three: ["three", "@react-three/fiber"],
        },
      },
    },
  },
  server: {
    port: 3000,
    strictPort: false,
    host: true,
    // Forward /api to Django: runserver on :8000 locally; in Docker Compose,
    // VITE_API_PROXY_TARGET=http://backend:8000 (used when the app is opened
    // on :3000 instead of through nginx on :80).
    proxy: {
      "/api": process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:8000",
    },
    allowedHosts: true,
    hmr: process.env.VITE_HMR_CLIENT_PORT
      ? { clientPort: Number(process.env.VITE_HMR_CLIENT_PORT) }
      : undefined,
    watch: process.env.CHOKIDAR_USEPOLLING
      ? { usePolling: true, interval: 300 }
      : undefined,
  },
});
