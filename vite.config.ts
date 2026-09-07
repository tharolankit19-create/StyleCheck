import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    target: "es2022",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          mediapipe: [
            "@mediapipe/pose",
            "@mediapipe/camera_utils",
            "@mediapipe/drawing_utils",
          ],
          react: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
  test: {
    environment: "node",
    globals: true,
  },
  server: {
    host: true,
    port: 5173,
  },
});