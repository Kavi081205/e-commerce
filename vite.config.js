import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
    cors: true
  },
  build: {
    modulePreload: {
      polyfill: false,
      resolveDependencies: () => []
    }
  }
})