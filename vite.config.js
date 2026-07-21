import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiMiddlewarePlugin = () => ({
  name: 'api-middleware',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.url.startsWith('/api')) {
        try {
          const { default: app } = await import('./api/index.js');
          app(req, res, next);
        } catch (err) {
          console.error('[ViteDevServer] Express mount error:', err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Internal Dev Server Error', details: err.message }));
        }
      } else {
        next();
      }
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), apiMiddlewarePlugin()],
  resolve: {
    // Force Vite to always resolve these to a single copy — prevents
    // the "Invalid Hook Call" / "useState is not a function" errors
    // that occur when multiple React instances end up in the bundle.
    dedupe: ['react', 'react-dom', 'react-router-dom'],
  },
  optimizeDeps: {
    // Pre-bundle these so Vite doesn't create separate CJS/ESM copies
    include: ['react', 'react-dom'],
  },
  server: {
    cors: true,
    // NOTE: COOP header removed — it caused Samsung Internet and Android Chrome
    // to treat embedded YouTube iframes as cross-origin threats and block them
    // with "This content is blocked" errors. COOP is only required for
    // SharedArrayBuffer usage which this app does not use.
    headers: {}
  },
  build: {
    // Split CSS per code-split chunk for faster route-specific loads
    cssCodeSplit: true,
    // oxc is the Vite 8 default Rust-based minifier (faster than esbuild, no separate install)
    minify: 'oxc',
    // Disable compressed-size reporting to speed up CI builds
    reportCompressedSize: false,
    modulePreload: {
      polyfill: false,
      resolveDependencies: () => []
    },
    rollupOptions: {
      output: {
        // ── Vendor chunk splitting ──────────────────────────────────────────
        // Splitting large vendors into separate chunks means:
        //  1. Mobile parses smaller JS files in parallel (better FCP)
        //  2. Unchanged vendor chunks are served from browser cache across deploys
        //  3. App code changes don't bust firebase/recharts caches
        manualChunks(id) {
          // Firebase SDKs (largest dependency — ~300 KB gzip)
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            return 'vendor-firebase';
          }
          // Framer Motion (animation library — ~50 KB gzip)
          if (id.includes('node_modules/framer-motion')) {
            return 'vendor-framer';
          }
          // Recharts (admin charts — not needed on customer routes)
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
            return 'vendor-recharts';
          }
          // Swiper (carousel — only on Home/ProductDetails)
          if (id.includes('node_modules/swiper')) {
            return 'vendor-swiper';
          }
          // Lucide icons
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-lucide';
          }
          // React core (keep small — hits main thread first)
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router-dom/')
          ) {
            return 'vendor-react';
          }
          // Admin-only heavy libraries (xlsx, jspdf, qrcode, jsbarcode)
          // These are only loaded on admin pages — keep out of customer bundle
          if (
            id.includes('node_modules/xlsx') ||
            id.includes('node_modules/jspdf') ||
            id.includes('node_modules/jspdf-autotable') ||
            id.includes('node_modules/qrcode') ||
            id.includes('node_modules/jsbarcode')
          ) {
            return 'vendor-admin-tools';
          }
          // All remaining node_modules → general vendor chunk
          if (id.includes('node_modules')) {
            return 'vendor-misc';
          }
        },
      },
    },
  },
})