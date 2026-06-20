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
    modulePreload: {
      polyfill: false,
      resolveDependencies: () => []
    }
  }
})