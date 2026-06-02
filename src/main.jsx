import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'

// Global filter for harmless CORB/Google logging warning requests
if (typeof window !== 'undefined') {
  const shouldIgnoreError = (errorMsg, url) => {
    const ignorePatterns = [
      'log?key=',
      'firebaselogging.googleapis.com',
      'googleapis'
    ];
    const msg = String(errorMsg || '').toLowerCase();
    const uri = String(url || '').toLowerCase();
    return ignorePatterns.some(pattern => msg.includes(pattern) || uri.includes(pattern));
  };

  window.addEventListener('error', (event) => {
    if (shouldIgnoreError(event.message, event.filename)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    if (shouldIgnoreError(message)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10,   // 10 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

const rootElement = document.getElementById('root')

if (!rootElement) {
  document.body.innerHTML = '<h1 style="color:red">App failed to load: #root element missing in index.html.</h1>'
  throw new Error('[main.jsx] Could not find #root element in index.html.')
}

createRoot(rootElement).render(
  <StrictMode>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </HelmetProvider>
  </StrictMode>,
)