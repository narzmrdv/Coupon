import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userService } from '../../../entities/user/model/userService';
import { UpdateUserBalanceDto, SetUserBalanceDto } from '../../types/user';

export const USER_KEYS = {
  balance: ['user', 'balance'] as const,
};

// ===== Queries =====
export const useBalance = () => {
  return useQuery({
    queryKey: USER_KEYS.balance,
    queryFn: () => userService.getBalance(),
    staleTime: 1 * 60 * 1000, // 1 минута
  });
};

// ===== Mutations =====
export const useAddBalance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateUserBalanceDto) => userService.addBalance(data),
    onSuccess: (newBalance) => {
      // Оптимистичное обновление
      queryClient.setQueryData(USER_KEYS.balance, newBalance);
    },
  });
};

export const useSetBalance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SetUserBalanceDto) => userService.setBalance(data),
    onSuccess: (newBalance) => {
      queryClient.setQueryData(USER_KEYS.balance, newBalance);
    },
  });
};
