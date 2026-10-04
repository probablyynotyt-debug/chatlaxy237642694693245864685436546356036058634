import { WS_BASE_URL, getAuthToken } from '../config/apiConfig';
import { ChatMessage } from '../types/chat';
import { NewsPost } from '../types/news';
import { AppNotification } from '../types/notifications';

type PresenceListener = (onlineUsernames: string[]) => void;
type MessageListener = (message: ChatMessage) => void;
type MessageDeleteListener = (data: { id: string; serverId?: string | null; channelId?: string | null }) => void;
type MessagesClearListener = (data: { serverId?: string | null; channelId?: string | null }) => void;
type NewsListener = (event: { type: string; post?: NewsPost; id?: string }) => void;
type NotificationListener = (notification: AppNotification) => void;

class SocketService {
  private ws: WebSocket | null = null;
  private reconnectTimer: any = null;
  private isConnected = false;
  private currentUsername: string | null = null;
  private activeServerId: string | null = null;
  private activeChannelId: string | null = null;

  private presenceListeners = new Set<PresenceListener>();
  private messageListeners = new Set<MessageListener>();
  private deleteListeners = new Set<MessageDeleteListener>();
  private clearListeners = new Set<MessagesClearListener>();
  private newsListeners = new Set<NewsListener>();
  private notifListeners = new Set<NotificationListener>();

  constructor() {
    if (typeof window !== 'undefined') {
      this.connect();
    }
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    try {
      this.ws = new WebSocket(WS_BASE_URL);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.authenticate();
        if (this.activeChannelId) {
          this.subscribeChannel(this.activeServerId, this.activeChannelId);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleEvent(data);
        } catch (err) {
          console.warn('Socket message parse error:', err);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch (err) {
      console.warn('WebSocket connection error:', err);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 2500);
  }

  authenticate(username?: string) {
    if (username) this.currentUsername = username;
    const token = getAuthToken();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'auth',
        token,
        username: this.currentUsername,
      }));
    }
  }

  subscribeChannel(serverId?: string | null, channelId?: string | null) {
    this.activeServerId = serverId || null;
    this.activeChannelId = channelId || null;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe_channel',
        serverId: this.activeServerId,
        channelId: this.activeChannelId,
      }));
    }
  }

  private handleEvent(data: any) {
    if (data.type === 'presence') {
      const list = Array.isArray(data.onlineUsers) ? data.onlineUsers : [];
      this.presenceListeners.forEach((fn) => fn(list));
    } else if (data.type === 'chat_message') {
      this.messageListeners.forEach((fn) => fn(data.message));
    } else if (data.type === 'message_deleted') {
      this.deleteListeners.forEach((fn) => fn(data));
    } else if (data.type === 'messages_cleared') {
      this.clearListeners.forEach((fn) => fn(data));
    } else if (data.type === 'news_created' || data.type === 'news_updated' || data.type === 'news_deleted') {
      this.newsListeners.forEach((fn) => fn(data));
    } else if (data.type === 'notification') {
      this.notifListeners.forEach((fn) => fn(data.notification));
    }
  }

  onPresence(fn: PresenceListener): () => void {
    this.presenceListeners.add(fn);
    return () => this.presenceListeners.delete(fn);
  }

  onMessage(fn: MessageListener): () => void {
    this.messageListeners.add(fn);
    return () => this.messageListeners.delete(fn);
  }

  onMessageDeleted(fn: MessageDeleteListener): () => void {
    this.deleteListeners.add(fn);
    return () => this.deleteListeners.delete(fn);
  }

  onMessagesCleared(fn: MessagesClearListener): () => void {
    this.clearListeners.add(fn);
    return () => this.clearListeners.delete(fn);
  }

  onNews(fn: NewsListener): () => void {
    this.newsListeners.add(fn);
    return () => this.newsListeners.delete(fn);
  }

  onNotification(fn: NotificationListener): () => void {
    this.notifListeners.add(fn);
    return () => this.notifListeners.delete(fn);
  }
}

export const socketService = new SocketService();
