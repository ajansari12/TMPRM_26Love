import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ErrorFallback({ error }: { error: Error }) {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Application Error</h1>
        <p className="text-slate-700 mb-4">
          Something went wrong. Please check the console for details.
        </p>
        <pre className="bg-slate-100 p-4 rounded text-sm overflow-auto">
          {error.message}
        </pre>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-700"
        >
          Reload Page
        </button>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <App />
      </ErrorBoundary>
    </QueryClientProvider>
  </StrictMode>
);
