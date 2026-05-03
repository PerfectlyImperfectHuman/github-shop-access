import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "::",
    port: 8080,
  },
  // REQUIRED for Capacitor APK — assets must use relative paths
  // Without this, the WebView gets a blank screen (can't find /assets/...)
  base: "./",
  build: {
    // Prevent chunk size warnings in CI
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // Split vendor chunks for faster incremental builds
        manualChunks: {
          firebase: ["firebase/app", "firebase/auth", "firebase/firestore"],
          vendor: ["react", "react-dom", "react-router-dom"],
          dexie: ["dexie", "dexie-react-hooks"],
        },
      },
    },
  },
}));
