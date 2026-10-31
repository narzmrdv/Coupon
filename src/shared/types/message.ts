// Типы для Private Messages API

export interface User {
  id: number;
  email: string;
  role: 'USER' | 'ADMIN';
  createdAt?: string;
}

export interface PrivateMessage {
  id: string;
  senderId: number;
  receiverId: number;
  message: string;
  imageUrl?: string;
  isRead: boolean;
  createdAt: string;
  sender: User;
  receiver: User;
}

export interface Conversation {
  user: User;
  lastMessage: PrivateMessage | null;
  unreadCount: number;
}

export interface SendMessageDto {
  receiverId: number;
  message: string;
  imageUrl?: string;
}

export interface MarkAsReadDto {
  partnerId: number;
}

export interface TypingDto {
  receiverId: number;
  isTyping: boolean;
}

export interface UnreadCountResponse {
  count: number;
}

// WebSocket события
export interface SocketTypingEvent {
  userId: number;
  email: string;
  isTyping: boolean;
}

export interface SocketReadEvent {
  userId: number;
  partnerId: number;
}

export interface SocketNotificationEvent {
  message: string;
  timestamp: string;
}
