import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
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
          'excel': ['xlsx'],
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
    exclude: ['jspdf', 'xlsx'], // Bibliotecas pesadas não pré-otimizar
  },
}));
