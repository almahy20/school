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
    // VitePWA is handled manually via public/sw.js and main.tsx for maximum simplicity and control
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'supabase-vendor': ['@supabase/supabase-js'],
          'query-vendor': ['@tanstack/react-query', '@tanstack/react-query-persist-client'],
          // Combine all Radix UI components into single chunk to avoid circular dependencies
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-toast',
            '@radix-ui/react-select',
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
    chunkSizeWarningLimit: 1000, // Increase warning limit for combined UI chunk
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: [
      'react', 'react-dom', 'react-router-dom', 
      '@supabase/supabase-js', '@tanstack/react-query', 
      'lucide-react', 'clsx', 'tailwind-merge', 'sonner',
      '@radix-ui/react-dialog', '@radix-ui/react-toast', 
      '@radix-ui/react-tooltip', '@radix-ui/react-slot',
      '@radix-ui/react-select', '@radix-ui/react-avatar',
      'class-variance-authority', 'next-themes'
    ],
  },
}));
