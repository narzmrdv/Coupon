import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/apiClient';
import { API_CONFIG } from '../../config/api';

interface AdminUser {
  id: number;
  email: string;
  role: string;
}

const ADMIN_KEYS = {
  admin: ['admin'] as const,
};

// Хук для получения информации об админе
export const useAdmin = () => {
  return useQuery({
    queryKey: ADMIN_KEYS.admin,
    queryFn: async (): Promise<AdminUser> => {
      if (__DEV__) console.log('[useAdmin] Fetching admin info');
      return await apiClient.get<AdminUser>(API_CONFIG.ENDPOINTS.USERS_ADMIN);
    },
    staleTime: 1000 * 60 * 60, // 1 час - админ не меняется часто
    gcTime: 1000 * 60 * 60 * 24, // 24 часа в кеше
  });
};
