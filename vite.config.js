import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiMiddlewarePlugin = () => ({
  name: 'api-middleware',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url.startsWith('/api/verify-payment')) {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            try {
              const data = JSON.parse(body);
              if (data.razorpay_signature === 'verify_fail') {
                res.statusCode = 200;
                res.end(JSON.stringify({ verified: false, error: 'Payment signature is invalid (stub).' }));
              } else {
                res.statusCode = 200;
                res.end(JSON.stringify({ verified: true }));
              }
            } catch (err) {
              res.statusCode = 400;
              res.end(JSON.stringify({ verified: false, error: 'Invalid JSON request body.' }));
            }
          });
        } else if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.statusCode = 200;
          res.end();
        } else {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
        }
        return;
      }
      
      if (req.url.startsWith('/api/pincode')) {
        const parts = req.url.split('/');
        const code = parts[parts.length - 1] || '600001';
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.statusCode = 200;
        res.end(JSON.stringify([
          {
            "Message": "Number of pincode(s) found:1",
            "Status": "Success",
            "PostOffice": [
              {
                "Name": "Mock Post Office",
                "Description": null,
                "BranchType": "Sub Post Office",
                "DeliveryStatus": "Delivery",
                "Circle": "Mock Circle",
                "District": "Mock District",
                "Division": "Mock Division",
                "Region": "Mock Region",
                "State": "Mock State",
                "Country": "India",
                "Pincode": code
              }
            ]
          }
        ]));
        return;
      }

      next();
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
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups'
    }
  },
  build: {
    modulePreload: {
      polyfill: false,
      resolveDependencies: () => []
    }
  }
})