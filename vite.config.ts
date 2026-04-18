import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: true,
    port: 3000,
    strictPort: false,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 3000,
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'نظام المدرسة الذكية',
        short_name: 'المدرسة الذكية',
        description: 'نظام إدارة تعليمي متكامل',
        theme_color: '#1e293b',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3MB limit
        cleanupOutdatedCaches: true,
        // Optimize caching to reduce resource usage
        navigateFallback: undefined, // Don't cache navigation
        // Force all API and data requests to be Network-Only for cross-browser reliability
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkOnly', // تم الإلغاء لضمان استقرار الاتصال اللحظي
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/v1\/.*/i,
            handler: 'NetworkOnly'
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'storage-cache',
              expiration: {
                maxEntries: 20, // Reduced from 50
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days (reduced from 30)
              }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 20,        // Reduced from 50 to save space
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days (reduced from 30)
              },
            },
          },
          {
            // Use NetworkFirst for assets to ensure cross-browser consistency and always try to get latest
            urlPattern: /\.(?:css|js|woff2?)$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'assets',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 30, // Limit cached assets
                maxAgeSeconds: 24 * 60 * 60, // 1 day only
              }
            }
          }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'supabase-vendor': ['@supabase/supabase-js'],
          'query-vendor': ['@tanstack/react-query', '@tanstack/react-query-persist-client'],
          // Split UI vendor into smaller chunks
          'ui-dialog': ['@radix-ui/react-dialog'],
          'ui-toast': ['@radix-ui/react-toast'],
          'ui-select': ['@radix-ui/react-select'],
          'ui-others': [
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-label',
            '@radix-ui/react-progress',
            '@radix-ui/react-separator',
            '@radix-ui/react-slot',
            '@radix-ui/react-switch',
            '@radix-ui/react-tooltip',
          ],
        }
      }
    },
    chunkSizeWarningLimit: 600, // Increase warning limit after optimization
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
