import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authService } from '../../../entities/auth/model/authService';
import {
  RegisterDto,
  LoginDto,
  VerifyEmailDto,
  ResendCodeDto,
  GoogleAuthDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
} from '../../types/auth';

export const AUTH_KEYS = {
  profile: ['auth', 'profile'] as const,
  token: ['auth', 'token'] as const,
};

// ===== Queries =====
export const useProfile = () => {
  return useQuery({
    queryKey: AUTH_KEYS.profile,
    queryFn: () => authService.getProfile(),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 минут
  });
};

export const useIsAuthenticated = () => {
  return useQuery({
    queryKey: AUTH_KEYS.token,
    queryFn: () => authService.isAuthenticated(),
    staleTime: Infinity,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
};

// ===== Mutations =====
export const useRegister = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RegisterDto) => authService.register(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUTH_KEYS.profile });
      queryClient.invalidateQueries({ queryKey: AUTH_KEYS.token });
    },
  });
};

// Completes registration after the user enters the code emailed to them —
// this is the point the account actually becomes usable, so it flips auth
// state directly (same setQueryData pattern as logout/delete-account, for
// the same reason: an invalidate+refetch race isn't worth it here either).
export const useVerifyEmail = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: VerifyEmailDto) => authService.verifyEmail(data),
    onSuccess: () => {
      queryClient.setQueryData(AUTH_KEYS.token, true);
    },
  });
};

export const useResendVerificationCode = () => {
  return useMutation({
    mutationFn: (data: ResendCodeDto) => authService.resendVerificationCode(data),
  });
};

export const useGoogleAuth = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: GoogleAuthDto) => authService.googleAuth(data),
    // Без этого пользователь при зависшем бэкенде мог ждать до 60с (30с
    // таймаут + ещё 30с на автоповтор от глобального `mutations: {retry: 1}`)
    // прежде чем увидеть хоть какую-то ошибку — сейчас максимум 30с.
    retry: false,
    onSuccess: () => {
      queryClient.setQueryData(AUTH_KEYS.token, true);
    },
  });
};

export const useRequestPasswordReset = () => {
  return useMutation({
    mutationFn: (data: RequestPasswordResetDto) => authService.requestPasswordReset(data),
  });
};

// Resetting the password logs the user in directly (same setQueryData
// pattern as verify-email/logout — see those for why invalidate+refetch
// isn't used here) — no need to make them type the new password twice.
export const useResetPassword = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ResetPasswordDto) => authService.resetPassword(data),
    onSuccess: () => {
      queryClient.setQueryData(AUTH_KEYS.token, true);
    },
  });
};

export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: LoginDto) => authService.login(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUTH_KEYS.profile });
      queryClient.invalidateQueries({ queryKey: AUTH_KEYS.token });
    },
  });
};

export const useAdminLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: LoginDto) => authService.adminLogin(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUTH_KEYS.profile });
      queryClient.invalidateQueries({ queryKey: AUTH_KEYS.token });
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      // Only setQueryData — same pattern as ApiProvider's auth-failed
      // handler. clear() also wipes the mutation cache, including this very
      // mutation while its own onSuccess is still running, which is not a
      // safe thing to do to yourself mid-callback. Other per-user cached
      // data (bonus balance, etc.) goes stale on its own once the token's
      // gone — nothing reads it again until a fresh login refetches it.
      queryClient.setQueryData(AUTH_KEYS.token, false);
    },
  });
};

export const useDeleteAccount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authService.deleteAccount(),
    onSuccess: () => {
      queryClient.setQueryData(AUTH_KEYS.token, false);
    },
  });
};
