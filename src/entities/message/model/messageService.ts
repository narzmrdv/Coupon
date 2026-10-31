import { apiClient } from '../../../shared/lib/api/apiClient';
import { API_CONFIG } from '../../../shared/config/api';
import type {
  Conversation,
  PrivateMessage,
  UnreadCountResponse,
} from '../../../shared/types/message';

class MessageService {
  // Получить список всех диалогов
  async getConversations(): Promise<Conversation[]> {
    if (__DEV__) console.log('[MessageService] Getting conversations');
    return await apiClient.get<Conversation[]>(API_CONFIG.ENDPOINTS.MESSAGES.CONVERSATIONS);
  }

  // Получить историю сообщений с конкретным пользователем
  async getHistory(partnerId: number): Promise<PrivateMessage[]> {
    if (__DEV__) console.log(`[MessageService] Getting history with partner ${partnerId}`);
    return await apiClient.get<PrivateMessage[]>(
      `${API_CONFIG.ENDPOINTS.MESSAGES.HISTORY}/${partnerId}`
    );
  }

  // Отметить все сообщения от пользователя как прочитанные
  async markAsRead(partnerId: number): Promise<{ success: boolean }> {
    if (__DEV__) console.log(`[MessageService] Marking messages as read from partner ${partnerId}`);
    return await apiClient.post<{ success: boolean }>(
      `${API_CONFIG.ENDPOINTS.MESSAGES.READ}/${partnerId}`
    );
  }

  // Получить количество непрочитанных сообщений
  async getUnreadCount(): Promise<number> {
    if (__DEV__) console.log('[MessageService] Getting unread count');
    const response = await apiClient.get<UnreadCountResponse>(
      API_CONFIG.ENDPOINTS.MESSAGES.UNREAD_COUNT
    );
    return response.count;
  }

  // Удалить всю переписку с пользователем
  async deleteConversation(partnerId: number): Promise<{ success: boolean }> {
    if (__DEV__) console.log(`[MessageService] Deleting conversation with partner ${partnerId}`);
    return await apiClient.delete<{ success: boolean }>(
      `${API_CONFIG.ENDPOINTS.MESSAGES.CONVERSATION}/${partnerId}`
    );
  }
}

export const messageService = new MessageService();
