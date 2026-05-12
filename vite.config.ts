import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Cacheia todos os assets estáticos gerados pelo build
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            // Google Fonts — CacheFirst (mudam raramente)
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 },
            },
          },
          {
            // Supabase — NetworkOnly (LGPD: nenhum dado pessoal no cache do SW)
            // Cobre auth, REST/PostgREST, realtime e storage
            urlPattern: /^https:\/\/.*\.supabase\.(co|in)\/.*/i,
            handler: "NetworkOnly",
          },
        ],
      },
      manifest: {
        name: "Controle de Terceiros",
        short_name: "Controlli",
        description: "Controle de presença de trabalhadores terceirizados",
        theme_color: "#212B36",
        background_color: "#212B36",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/logo-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/logo-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test/setup.ts"],
  },
  build: {
    // Code splitting otimizado
    rollupOptions: {
      output: {
        // Separar vendor chunks por tamanho e frequência de mudança
        manualChunks: {
          // React e ReactDOM em chunk separado (mudam menos)
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          
          // UI libraries em chunk separado
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-tabs', '@radix-ui/react-dropdown-menu'],
          
          // Bibliotecas pesadas em chunks separados
          'charts': ['recharts'],
          'pdf': ['jspdf', 'jspdf-autotable'],
          'excel': ['exceljs'],
          'utils': ['dompurify', '@supabase/supabase-js'],
        },
      },
    },
    // Target moderno para melhor tree-shaking
    target: 'esnext',
    // Minificação com esbuild (mais rápida)
    minify: 'esbuild',
    // Source maps apenas em produção se necessário
    sourcemap: false,
    // Reportar tamanho dos chunks
    reportCompressedSize: true,
  },
  // Otimizações para desenvolvimento
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
    // exceljs é UMD: sem pré-bundle, o dist browser apenas define
    // window.ExcelJS sem exports ESM → "Workbook is not a constructor".
    // jspdf segue o mesmo padrão, mas já era servido funcionando antes do issue.
    exclude: ['jspdf'],
  },
}));
