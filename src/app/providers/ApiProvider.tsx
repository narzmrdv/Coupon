import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setAuthFailedHandler } from '@/shared/lib/api/apiClient';
import { AUTH_KEYS } from '@/shared/lib/hooks/useAuth';

// Настройка QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

interface ApiProviderProps {
  children: React.ReactNode;
}

export const ApiProvider: React.FC<ApiProviderProps> = ({ children }) => {
  useEffect(() => {
    // When token refresh fails, force re-check of auth state → user goes to login
    setAuthFailedHandler(() => {
      queryClient.setQueryData(AUTH_KEYS.token, false);
    });
    return () => setAuthFailedHandler(null);
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

export { queryClient };
