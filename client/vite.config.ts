import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "Monolith",
        short_name: "Monolith",
        description: "一个基于边缘计算的极简博客系统",
        theme_color: "#0a0a0a",
        background_color: "#0a0a0a",
        icons: [
          {
            src: "icon-192.png", // 这里假定我们会有这样的图标或者暂时只依赖浏览器回退
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        runtimeCaching: [
          {
            urlPattern: /\/cdn\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "monolith-images",
              expiration: { maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: /\/api\//i,
            handler: "NetworkFirst",
            options: {
              cacheName: "monolith-api",
              expiration: { maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 },
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:8787",
      "/cdn": "http://localhost:8787",
      "/rss.xml": "http://localhost:8787",
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
