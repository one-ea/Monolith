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
      includeAssets: [
        "favicon.png",
        "favicon-16.png",
        "favicon-32.png",
        "favicon-48.png",
        "icon-192.png",
        "icon-512.png",
        "icon-192-maskable.png",
        "icon-512-maskable.png",
        "monolith-logo.svg",
        "monolith-logo-mono.svg"
      ],
      manifest: {
        name: "Monolith",
        short_name: "Monolith",
        id: "/",
        start_url: "/",
        display: "standalone",
        description: "一个基于边缘计算的极简博客系统",
        theme_color: "#0d1117",
        background_color: "#0d1117",
        icons: [
          {
            src: "icon-192.png", // 这里假定我们会有这样的图标或者暂时只依赖浏览器回退
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "icon-192-maskable.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable"
          },
          {
            src: "icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        // og-default.png 仅用于社交分享卡（爬虫抓取），无需离线预缓存
        globIgnores: ["**/og-default.png"],
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [
          /^\/sitemap\.xml$/i,
          /^\/robots\.txt$/i,
          /^\/rss\.xml$/i,
          /^\/llms(?:-full)?\.txt$/i,
          /^\/posts\/.*\.md$/i,
        ],
        runtimeCaching: [
          {
            // 文章 / 系列 / 搜索 / 标签 / 分类可能包含访问密码状态，
            // 不能进入 Service Worker 缓存，否则锁变更后仍可能读到旧内容。
            urlPattern: /\/api\/(?:posts|series|search|tags|categories)(?:[/?]|$)/i,
            handler: "NetworkOnly",
          },
          {
            urlPattern: /\/(?:sitemap\.xml|robots\.txt|rss\.xml)$/i,
            handler: "NetworkOnly",
          },
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
            urlPattern: /\/api\/(?!auth\/|admin\/).*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "monolith-api-v2",
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
      "/sitemap.xml": "http://localhost:8787",
      "/robots.txt": "http://localhost:8787",
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
