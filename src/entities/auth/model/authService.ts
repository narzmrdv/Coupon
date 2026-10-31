import { apiClient } from '../../../shared/lib/api/apiClient';
import { API_CONFIG } from '../../../shared/config/api';
import {
  RegisterDto,
  LoginDto,
  AuthResponse,
  RegisterResponse,
  ProfileResponse,
  VerifyEmailDto,
  ResendCodeDto,
  GoogleAuthDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
} from '../../../shared/types/auth';

class AuthService {
  async register(data: RegisterDto): Promise<RegisterResponse> {
    if (__DEV__) console.log('[AuthService] Register called');
    const response = await apiClient.post<RegisterResponse>(
      API_CONFIG.ENDPOINTS.AUTH_REGISTER,
      data
    );

    // НЕ сохраняем токен после регистрации - пусть войдет через логин
    await apiClient.clearToken();

    return response;
  }

  async registerAdmin(data: RegisterDto): Promise<RegisterResponse> {
    const response = await apiClient.post<RegisterResponse>(
      API_CONFIG.ENDPOINTS.AUTH_REGISTER_ADMIN,
      data
    );

    if (response.access_token) {
      await apiClient.setToken(response.access_token);
    }

    return response;
  }

  async login(data: LoginDto): Promise<AuthResponse> {
    if (__DEV__) console.log('[AuthService] Login called');
    const response = await apiClient.post<AuthResponse>(API_CONFIG.ENDPOINTS.AUTH_LOGIN, data);

    // Сохраняем токен после входа
    if (response.access_token) {
      await apiClient.setToken(response.access_token);
    }

    return response;
  }

  async adminLogin(data: LoginDto): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>(
      API_CONFIG.ENDPOINTS.AUTH_ADMIN_LOGIN,
      data
    );

    if (response.access_token) {
      await apiClient.setToken(response.access_token);
    }

    return response;
  }

  async getProfile(): Promise<ProfileResponse> {
    return apiClient.get<ProfileResponse>(API_CONFIG.ENDPOINTS.AUTH_PROFILE);
  }

  async refreshToken(): Promise<boolean> {
    try {
      const token = await this.getToken();
      if (!token) return false;

      const response = await apiClient.post<AuthResponse>(
        API_CONFIG.ENDPOINTS.AUTH_REFRESH,
      );

      if (response.access_token) {
        await apiClient.setToken(response.access_token);
        return true;
      }
      return false;
    } catch (error) {
      // Не чистим токен при ошибке: сеть могла упасть, endpoint мог быть
      // недоступен. Пусть текущий токен продолжает работать до реального 401.
      console.warn('[AuthService] Token refresh failed, keeping current token:', error);
      return false;
    }
  }

  async verifyEmail(data: VerifyEmailDto): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>(
      API_CONFIG.ENDPOINTS.AUTH_VERIFY_EMAIL,
      data,
    );

    if (response.access_token) {
      await apiClient.setToken(response.access_token);
    }

    return response;
  }

  async resendVerificationCode(data: ResendCodeDto): Promise<void> {
    await apiClient.post(API_CONFIG.ENDPOINTS.AUTH_RESEND_CODE, data);
  }

  async googleAuth(data: GoogleAuthDto): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>(API_CONFIG.ENDPOINTS.AUTH_GOOGLE, data);

    if (response.access_token) {
      await apiClient.setToken(response.access_token);
    }

    return response;
  }

  async requestPasswordReset(data: RequestPasswordResetDto): Promise<void> {
    await apiClient.post(API_CONFIG.ENDPOINTS.AUTH_FORGOT_PASSWORD, data);
  }

  async resetPassword(data: ResetPasswordDto): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>(
      API_CONFIG.ENDPOINTS.AUTH_RESET_PASSWORD,
      data,
    );

    if (response.access_token) {
      await apiClient.setToken(response.access_token);
    }

    return response;
  }

  async deleteAccount(): Promise<void> {
    await apiClient.delete(API_CONFIG.ENDPOINTS.USERS_DELETE_ACCOUNT);
    await apiClient.clearToken();
  }

  async logout(): Promise<void> {
    await apiClient.clearToken();
  }

  async getToken(): Promise<string | null> {
    return apiClient.getToken();
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  }
}

export const authService = new AuthService();
