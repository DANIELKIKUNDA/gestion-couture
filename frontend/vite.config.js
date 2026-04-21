import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

const packageJsonPath = fileURLToPath(new URL("./package.json", import.meta.url));
const { version: appVersion } = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
const pwaCacheId = `atelierpro-${appVersion}`;

export default defineConfig({
  define: {
    APP_VERSION: JSON.stringify(appVersion)
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("vite-plugin-pwa") || id.includes("workbox") || id.includes("virtual:pwa")) return "pwa";
          if (id.includes("/dexie/")) return "offline-db";
          return "vendor";
        }
      }
    }
  },
  plugins: [
    vue(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      manifest: false,
      workbox: {
        cacheId: pwaCacheId,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // Prompt mode keeps a waiting SW so the operator can apply the update explicitly.
        skipWaiting: false,
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/health$/],
        globPatterns: ["**/*.{html,js,css,ico,png,svg,webmanifest,woff2}"],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkOnly",
            method: "GET"
          },
          {
            urlPattern: ({ url }) => url.pathname === "/health",
            handler: "NetworkOnly",
            method: "GET"
          }
        ]
      }
    })
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      "/media": "http://localhost:3000"
    }
  }
});
