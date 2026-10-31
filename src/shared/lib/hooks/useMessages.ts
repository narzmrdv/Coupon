import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { messageService } from '../../../entities/message/model/messageService';
import type { PrivateMessage, SendMessageDto } from '../../types/message';
import { socketService } from '../socket/socketService';
import { AUTH_KEYS } from './useAuth';
import type { ProfileResponse } from '../../types/auth';

// Query Keys
export const MESSAGE_KEYS = {
  conversations: ['conversations'] as const,
  history: (partnerId: number) => ['messages', 'history', partnerId] as const,
  unreadCount: ['messages', 'unread'] as const,
};

// Получить историю сообщений с пользователем
export const useMessageHistory = (partnerId: number) => {
  return useQuery({
    queryKey: MESSAGE_KEYS.history(partnerId),
    queryFn: () => messageService.getHistory(partnerId),
    enabled: !!partnerId && partnerId > 0,
    staleTime: 30000,
  });
};

// Получить количество непрочитанных
export const useUnreadCount = () => {
  return useQuery({
    queryKey: MESSAGE_KEYS.unreadCount,
    queryFn: () => messageService.getUnreadCount(),
    staleTime: 60000, // 1 минута
    refetchInterval: 60000, // Обновлять каждую минуту
  });
};

// Отправка сообщения через WebSocket
export const useSendMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    // Ждём broadcast-подтверждение 'privateMessageSent' с ручным таймаутом —
    // никакого автоматического повтора отправки здесь: сообщение не имеет
    // idempotency-ключа на бэкенде, и повторный emit того же текста означает
    // ВТОРОЕ реальное сообщение, а не переотправку первого.
    mutationFn: (data: SendMessageDto) => {
      return new Promise<PrivateMessage>((resolve, reject) => {
        const timeout = setTimeout(() => {
          socketService.off('privateMessageSent', handleMessageSent);
          reject(new Error('Message send timeout'));
        }, 10000);

        const handleMessageSent = (message: PrivateMessage) => {
          if (message.receiverId !== data.receiverId) return;
          clearTimeout(timeout);
          socketService.off('privateMessageSent', handleMessageSent);
          resolve(message);
        };

        socketService.on('privateMessageSent', handleMessageSent);
        socketService.sendPrivateMessage(data);
      });
    },
    // Не даём react-query автоматически повторить мутацию при ошибке
    // (переопределяет глобальный `mutations: { retry: 1 }` из ApiProvider) —
    // отправка сообщения не идемпотентна, повтор создаст дубликат на сервере.
    retry: false,

    // Оптимистичная отрисовка: показываем своё сообщение сразу, не дожидаясь
    // ack от сервера — как это сделано в админке. Без этого пользователь
    // видит пустоту несколько секунд после нажатия "отправить".
    onMutate: async (data) => {
      const profile = queryClient.getQueryData<ProfileResponse>(AUTH_KEYS.profile);
      const senderId = profile?.id;
      if (!senderId) return undefined;

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimisticMessage: PrivateMessage = {
        id: tempId,
        senderId,
        receiverId: data.receiverId,
        message: data.message,
        imageUrl: data.imageUrl,
        isRead: false,
        createdAt: new Date().toISOString(),
        sender: { id: senderId, email: profile.email, role: 'USER' },
        receiver: { id: data.receiverId, email: '', role: 'ADMIN' },
      };

      queryClient.setQueryData<PrivateMessage[]>(MESSAGE_KEYS.history(data.receiverId), (old) =>
        old ? [...old, optimisticMessage] : [optimisticMessage],
      );

      return { tempId };
    },

    onSuccess: (message, variables, context) => {
      // Меняем временное сообщение на настоящее (с реальным id) вместо
      // простого добавления — иначе в списке остались бы оба.
      queryClient.setQueryData<PrivateMessage[]>(MESSAGE_KEYS.history(variables.receiverId), (old) => {
        const withoutOptimistic = context?.tempId
          ? (old || []).filter((msg) => msg.id !== context.tempId)
          : old || [];
        const isDuplicate = withoutOptimistic.some((msg) => msg.id === message.id);
        return isDuplicate ? withoutOptimistic : [...withoutOptimistic, message];
      });

      queryClient.invalidateQueries({ queryKey: MESSAGE_KEYS.conversations });
    },

    onError: (error, variables, context) => {
      if (__DEV__) console.error('[useSendMessage] ❌ onError:', error);
      // Убираем оптимистичное сообщение — ChatScreen уже восстанавливает
      // текст в поле ввода и показывает алерт, так что "фантомный" пузырь
      // сообщения оставлять нельзя.
      if (!context?.tempId) return;
      queryClient.setQueryData<PrivateMessage[]>(MESSAGE_KEYS.history(variables.receiverId), (old) =>
        old ? old.filter((msg) => msg.id !== context.tempId) : old,
      );
    },
  });
};

// Отметить сообщения как прочитанные
export const useMarkAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (partnerId: number) => {
      // Отправляем через REST и WebSocket
      socketService.markAsRead(partnerId);
      return messageService.markAsRead(partnerId);
    },
    onSuccess: (_, partnerId) => {
      // Обновляем историю сообщений
      queryClient.setQueryData<PrivateMessage[]>(MESSAGE_KEYS.history(partnerId), (old) => {
        if (!old) return [];
        return old.map((msg) => ({
          ...msg,
          isRead: true,
        }));
      });

      // Обновляем счетчик непрочитанных
      queryClient.invalidateQueries({ queryKey: MESSAGE_KEYS.unreadCount });
    },
  });
};
