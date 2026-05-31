import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, LayoutProvider, ToastProvider, AuthProvider } from './providers';
import App from './App';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // GAS cold-starts can take 5–8 s; don't hammer on retry
      retry: 1,
      retryDelay: 2000,
      // Show stale data immediately while revalidating in background
      staleTime: 30_000,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <HashRouter>
            <AuthProvider>
              <LayoutProvider>
                <App />
              </LayoutProvider>
            </AuthProvider>
          </HashRouter>
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>
);
