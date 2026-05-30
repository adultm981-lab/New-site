export interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  senderAvatar: string;
  timestamp: number;
  reactions: Record<string, string[]>; // e.g. { "❤️": ["senderId1", "senderId2"], "👍": ["senderId3"] }
}

export interface UserSession {
  id: string;
  nickname: string;
  color: string;
  avatar: string;
  lastActive: number;
}

export interface TypingState {
  id: string;
  nickname: string;
  timestamp: number;
}

export interface ChatStats {
  activeUsersCount: number;
  totalMessagesCount: number;
}
