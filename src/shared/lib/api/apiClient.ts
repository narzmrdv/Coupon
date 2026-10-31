import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../../config/api';
import { ApiError } from '../../types/api';

const TOKEN_KEY = '@auth_token';

let _authFailedHandler: (() => void) | null = null;
export const setAuthFailedHandler = (handler: (() => void) | null) => {
  _authFailedHandler = handler;
};

// Endpoint'ы, для которых 401 означает "неверные креденшалы при попытке входа",
// а не "протухший токен" — для них не надо пытаться refresh'ить.
const AUTH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/admin/login', '/auth/refresh'];

const isAuthEndpoint = (url?: string): boolean => {
  if (!url) return false;
  return AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint));
};

class ApiClient {
  private axiosInstance: AxiosInstance;
  private refreshPromise: Promise<string | null> | null = null;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: API_CONFIG.TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  // Выполнить refresh-токена. Параллельные вызовы объединяются.
  private async performTokenRefresh(): Promise<string | null> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      try {
        const currentToken = await AsyncStorage.getItem(TOKEN_KEY);
        if (!currentToken) return null;

        const response = await axios.post<{ access_token?: string }>(
          `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH_REFRESH}`,
          {},
          {
            headers: { Authorization: `Bearer ${currentToken}` },
            timeout: API_CONFIG.TIMEOUT,
          },
        );

        const newToken = response.data.access_token;
        if (newToken) {
          await AsyncStorage.setItem(TOKEN_KEY, newToken);
          return newToken;
        }
        return null;
      } catch (error) {
        console.warn('[ApiClient] Token refresh failed:', error);
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private setupInterceptors() {
    // Request interceptor для добавления токена
    this.axiosInstance.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        try {
          const token = await AsyncStorage.getItem(TOKEN_KEY);
          if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
          }
          if (config.headers) {
            const offset = -new Date().getTimezoneOffset();
            config.headers['X-Timezone-Offset'] = String(offset);
          }
          if (__DEV__) {
            console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
          }
        } catch (error) {
          if (__DEV__) console.error('Error getting token from storage:', error);
        }
        return config;
      },
      (error) => {
        if (__DEV__) console.error('[API Request Error]', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor для обработки ошибок
    this.axiosInstance.interceptors.response.use(
      (response) => {
        if (__DEV__) console.log(`[API Response] ${response.status} ${response.config.url}`);
        return response;
      },
      async (error: AxiosError<ApiError>) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & {
          _retry?: boolean;
        };

        if (__DEV__) {
          console.error(
            `[API Error] ${error.response?.status} ${error.config?.url}`,
            error.message,
          );
        }

        // 401 на любом НЕ-auth endpoint'е:
        // 1) Пытаемся refresh
        // 2) Успешно — повторяем оригинальный запрос с новым токеном
        // 3) Не получилось — чистим токен (реально протух)
        if (
          error.response?.status === 401 &&
          originalRequest &&
          !originalRequest._retry &&
          !isAuthEndpoint(originalRequest.url)
        ) {
          originalRequest._retry = true;
          const newToken = await this.performTokenRefresh();

          if (newToken) {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            return this.axiosInstance(originalRequest);
          }

          // Refresh не удался — токен протух, чистим и редиректим на логин
          await this.clearToken();
          _authFailedHandler?.();
        }

        const apiError: ApiError = {
          statusCode: error.response?.status || 500,
          message: error.response?.data?.message || error.message || 'Unknown error occurred',
          error: error.response?.data?.error,
          requestUrl: originalRequest
            ? `${(originalRequest.method || '').toUpperCase()} ${originalRequest.url || ''}`
            : undefined,
          nextAvailableInSec: error.response?.data?.nextAvailableInSec,
          reason: error.response?.data?.reason,
        };

        return Promise.reject(apiError);
      }
    );
  }

  async setToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } catch (error) {
      if (__DEV__) console.error('Error saving token:', error);
    }
  }

  async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(TOKEN_KEY);
    } catch (error) {
      if (__DEV__) console.error('Error getting token:', error);
      return null;
    }
  }

  async clearToken(): Promise<void> {
    try {
      await AsyncStorage.removeItem(TOKEN_KEY);
    } catch (error) {
      if (__DEV__) console.error('Error clearing token:', error);
    }
  }

  getInstance(): AxiosInstance {
    return this.axiosInstance;
  }

  // Helper методы для всех типов запросов
  async get<T>(url: string, config = {}) {
    const response = await this.axiosInstance.get<T>(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: any, config = {}) {
    if (__DEV__) console.log(`[API Post] ${url}`);
    const response = await this.axiosInstance.post<T>(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: any, config = {}) {
    const response = await this.axiosInstance.put<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config = {}) {
    const response = await this.axiosInstance.delete<T>(url, config);
    return response.data;
  }

  async uploadFile<T>(url: string, file: any, onProgress?: (progress: number) => void) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.axiosInstance.post<T>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });

    return response.data;
  }
}

export const apiClient = new ApiClient();
