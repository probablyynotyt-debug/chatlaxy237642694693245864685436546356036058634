import { apiFetch, setAuthToken } from '../config/apiConfig';
import { socketService } from './socketService';
import { ProfileData } from '../types/bio';
import { ChatMessage } from '../types/chat';
import { AuditLogEntry } from '../utils/auditLogger';
import { NewsPost } from '../types/news';
import { AppNotification } from '../types/notifications';

export interface ServerData {
  id: string;
  name: string;
  owner: string;
  iconUrl?: string | null;
  bannerUrl?: string | null;
  description?: string;
  createdAt?: number;
}

export interface ServerChannel {
  id: string;
  serverId: string;
  name: string;
  position?: number;
}

export interface ServerRole {
  id: string;
  serverId: string;
  name: string;
  colour: string;
  position: number;
  permissions: string[];
}

export interface ServerMember {
  serverId: string;
  username: string;
  roles: string[];
  joinedAt?: number;
}

// ----------------------------------------------------
// 1. AUTHENTICATION & SESSIONS
// ----------------------------------------------------

export async function signup(
  username: string,
  password: string,
  profileData?: Partial<ProfileData>
): Promise<ProfileData | null> {
  const res = await apiFetch('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({
      username,
      password,
      email: profileData?.email,
      gender: profileData?.gender,
      age: profileData?.age,
      rank: profileData?.rank,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Signup failed');
  }

  setAuthToken(data.token);
  socketService.authenticate(data.user.username);
  return data.user;
}

export async function login(
  identifier: string,
  password: string
): Promise<ProfileData | null> {
  const res = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Login failed');
  }

  setAuthToken(data.token);
  socketService.authenticate(data.user.username);
  return data.user;
}

export async function logout(): Promise<void> {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch {}
  setAuthToken(null);
}

export async function getCurrentUser(): Promise<{ authenticated: boolean; user?: ProfileData }> {
  try {
    const res = await apiFetch('/api/auth/me');
    if (!res.ok) {
      return { authenticated: false };
    }
    const data = await res.json();
    if (data.user) {
      socketService.authenticate(data.user.username);
      return { authenticated: true, user: data.user };
    }
    return { authenticated: false };
  } catch {
    return { authenticated: false };
  }
}

// ----------------------------------------------------
// 2. USERS & PROFILES
// ----------------------------------------------------

export async function saveUser(profile: ProfileData): Promise<void> {
  if (!profile || !profile.username) return;
  const res = await apiFetch(`/api/users/${encodeURIComponent(profile.username)}`, {
    method: 'PUT',
    body: JSON.stringify(profile),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to save profile');
  }
}

export async function getUser(username: string): Promise<ProfileData | null> {
  if (!username) return null;
  const res = await apiFetch(`/api/users/${encodeURIComponent(username)}`);
  if (!res.ok) return null;
  return res.json();
}

export async function getAllUsers(): Promise<ProfileData[]> {
  const res = await apiFetch('/api/users');
  if (!res.ok) return [];
  return res.json();
}

export async function deleteUser(username: string): Promise<void> {
  await apiFetch(`/api/users/${encodeURIComponent(username)}`, {
    method: 'DELETE',
  });
}

/**
 * Realtime presence subscription using WebSockets
 */
export function subscribeToUsers(callback: (users: Record<string, ProfileData>) => void): () => void {
  let isMounted = true;
  const userMap: Record<string, ProfileData> = {};

  getAllUsers().then((list) => {
    if (!isMounted) return;
    list.forEach((u) => {
      userMap[u.username.toLowerCase().trim()] = u;
    });
    callback({ ...userMap });
  });

  const unsubPresence = socketService.onPresence((onlineList) => {
    if (!isMounted) return;
    onlineList.forEach((uName) => {
      const key = uName.toLowerCase().trim();
      if (!userMap[key]) {
        userMap[key] = {
          username: uName,
          displayName: uName,
          profilePicture: null,
          banner: null,
          bioSegments: [],
          mood: '',
          rank: uName.toLowerCase() === 'null' ? 'DEV' : 'VIP',
        };
      }
    });
    callback({ ...userMap });
  });

  return () => {
    isMounted = false;
    unsubPresence();
  };
}

// ----------------------------------------------------
// 3. MESSAGES & CHAT
// ----------------------------------------------------

export function subscribeToMessages(
  callback: (messages: ChatMessage[]) => void,
  serverId?: string | null,
  channelId?: string | null
): () => void {
  let isMounted = true;
  let currentMessages: ChatMessage[] = [];

  socketService.subscribeChannel(serverId, channelId);

  const queryParams = new URLSearchParams();
  if (serverId && channelId) {
    queryParams.set('serverId', serverId);
    queryParams.set('channelId', channelId);
  }
  queryParams.set('limit', '50');

  apiFetch(`/api/messages?${queryParams.toString()}`)
    .then((res) => res.json())
    .then((list) => {
      if (!isMounted) return;
      currentMessages = Array.isArray(list) ? list : [];
      callback([...currentMessages]);
    })
    .catch((err) => console.warn('Fetch messages error:', err));

  const unsubMsg = socketService.onMessage((newMsg) => {
    if (!isMounted) return;
    const msgServer = newMsg.serverId || null;
    const msgChannel = newMsg.channelId || null;
    const targetServer = serverId || null;
    const targetChannel = channelId || null;

    if (msgServer === targetServer && msgChannel === targetChannel) {
      if (!currentMessages.some((m) => m.id === newMsg.id)) {
        currentMessages.push(newMsg);
        callback([...currentMessages]);
      }
    }
  });

  const unsubDel = socketService.onMessageDeleted((data) => {
    if (!isMounted) return;
    currentMessages = currentMessages.filter((m) => m.id !== data.id);
    callback([...currentMessages]);
  });

  const unsubClear = socketService.onMessagesCleared((data) => {
    if (!isMounted) return;
    const msgServer = data.serverId || null;
    const msgChannel = data.channelId || null;
    if (msgServer === (serverId || null) && msgChannel === (channelId || null)) {
      currentMessages = [];
      callback([]);
    }
  });

  return () => {
    isMounted = false;
    unsubMsg();
    unsubDel();
    unsubClear();
  };
}

export async function loadOlderMessages(
  oldestTimestamp: number,
  serverId?: string | null,
  channelId?: string | null,
  pageSize = 30
): Promise<ChatMessage[]> {
  const queryParams = new URLSearchParams();
  if (serverId && channelId) {
    queryParams.set('serverId', serverId);
    queryParams.set('channelId', channelId);
  }
  queryParams.set('before', oldestTimestamp.toString());
  queryParams.set('limit', pageSize.toString());

  const res = await apiFetch(`/api/messages?${queryParams.toString()}`);
  if (!res.ok) return [];
  return res.json();
}

export async function sendMessage(
  message: ChatMessage,
  serverId?: string | null,
  channelId?: string | null
): Promise<void> {
  await apiFetch('/api/messages', {
    method: 'POST',
    body: JSON.stringify({
      ...message,
      serverId: serverId || null,
      channelId: channelId || null,
    }),
  });
}

export async function deleteMessage(
  messageId: string,
  serverId?: string | null,
  channelId?: string | null
): Promise<void> {
  await apiFetch(`/api/messages/${encodeURIComponent(messageId)}`, {
    method: 'DELETE',
  });
}

export async function clearAllMessages(
  announcementMessage?: ChatMessage,
  serverId?: string | null,
  channelId?: string | null
): Promise<void> {
  const queryParams = new URLSearchParams();
  if (serverId && channelId) {
    queryParams.set('serverId', serverId);
    queryParams.set('channelId', channelId);
  }
  await apiFetch(`/api/messages?${queryParams.toString()}`, {
    method: 'DELETE',
  });

  if (announcementMessage) {
    await sendMessage(announcementMessage, serverId, channelId);
  }
}

// ----------------------------------------------------
// 4. DAILY REWARDS & LEADERBOARD
// ----------------------------------------------------

export async function recordMessageSentForDailyRewards(
  username: string
): Promise<{ count: number; date: string }> {
  try {
    const res = await apiFetch('/api/rewards/message-sent', { method: 'POST' });
    if (!res.ok) {
      return { count: 1, date: new Date().toISOString().slice(0, 10) };
    }
    return res.json();
  } catch {
    return { count: 1, date: new Date().toISOString().slice(0, 10) };
  }
}

export async function claimDailyReward(
  username: string,
  milestoneCount: number,
  gold: number,
  rubies: number
): Promise<ProfileData | null> {
  const res = await apiFetch('/api/rewards/claim', {
    method: 'POST',
    body: JSON.stringify({ milestoneCount, gold, rubies }),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function getDailyLeaderboard(): Promise<ProfileData[]> {
  const res = await apiFetch('/api/rewards/leaderboard');
  if (!res.ok) return [];
  return res.json();
}

// ----------------------------------------------------
// 5. AUDIT LOGS
// ----------------------------------------------------

export function subscribeToAuditLogs(callback: (logs: AuditLogEntry[]) => void): () => void {
  apiFetch('/api/audit-logs')
    .then((r) => r.json())
    .then((list) => callback(Array.isArray(list) ? list : []))
    .catch(() => callback([]));

  return () => {};
}

export async function addAuditLogToBackend(entry: AuditLogEntry): Promise<void> {
  await apiFetch('/api/audit-logs', {
    method: 'POST',
    body: JSON.stringify(entry),
  }).catch(() => {});
}

export async function clearAuditLogsInBackend(): Promise<void> {
  await apiFetch('/api/audit-logs', { method: 'DELETE' }).catch(() => {});
}

// ----------------------------------------------------
// 6. RIGGED USERS
// ----------------------------------------------------

export function subscribeToRiggedUsers(callback: (rigged: string[]) => void): () => void {
  apiFetch('/api/system/rigged-users')
    .then((r) => r.json())
    .then((list) => callback(Array.isArray(list) ? list : []))
    .catch(() => callback([]));

  return () => {};
}

export async function setRiggedUser(username: string, rigged: boolean): Promise<void> {
  await apiFetch('/api/system/rigged-users', {
    method: 'POST',
    body: JSON.stringify({ username, rigged }),
  }).catch(() => {});
}

// ----------------------------------------------------
// 7. NEWS ANNOUNCEMENTS
// ----------------------------------------------------

export function subscribeToNews(callback: (posts: NewsPost[]) => void): () => void {
  let isMounted = true;
  let currentPosts: NewsPost[] = [];

  apiFetch('/api/news')
    .then((r) => r.json())
    .then((list) => {
      if (!isMounted) return;
      currentPosts = Array.isArray(list) ? list : [];
      callback([...currentPosts]);
    })
    .catch(() => {});

  const unsubNews = socketService.onNews((event) => {
    if (!isMounted) return;
    if (event.type === 'news_created' && event.post) {
      currentPosts = [event.post, ...currentPosts];
      callback([...currentPosts]);
    } else if (event.type === 'news_updated' && event.post) {
      currentPosts = currentPosts.map((p) => (p.id === event.post!.id ? event.post! : p));
      callback([...currentPosts]);
    } else if (event.type === 'news_deleted' && event.id) {
      currentPosts = currentPosts.filter((p) => p.id !== event.id);
      callback([...currentPosts]);
    }
  });

  return () => {
    isMounted = false;
    unsubNews();
  };
}

export async function createNewsPost(post: NewsPost): Promise<void> {
  await apiFetch('/api/news', {
    method: 'POST',
    body: JSON.stringify(post),
  });
}

export async function deleteNewsPost(postId: string): Promise<void> {
  await apiFetch(`/api/news/${encodeURIComponent(postId)}`, {
    method: 'DELETE',
  });
}

export async function updateNewsPost(post: NewsPost): Promise<void> {
  await apiFetch(`/api/news/${encodeURIComponent(post.id)}`, {
    method: 'PUT',
    body: JSON.stringify(post),
  });
}

// ----------------------------------------------------
// 8. NOTIFICATIONS
// ----------------------------------------------------

export function subscribeToUserNotifications(
  username: string,
  callback: (notifications: AppNotification[]) => void
): () => void {
  let isMounted = true;
  let currentNotifs: AppNotification[] = [];

  apiFetch('/api/notifications')
    .then((r) => r.json())
    .then((list) => {
      if (!isMounted) return;
      currentNotifs = Array.isArray(list) ? list : [];
      callback([...currentNotifs]);
    })
    .catch(() => {});

  const unsubNotif = socketService.onNotification((notif) => {
    if (!isMounted) return;
    currentNotifs = [notif, ...currentNotifs];
    callback([...currentNotifs]);
  });

  return () => {
    isMounted = false;
    unsubNotif();
  };
}

export async function sendNotification(notification: AppNotification): Promise<void> {
  await apiFetch('/api/notifications', {
    method: 'POST',
    body: JSON.stringify(notification),
  }).catch(() => {});
}

export async function deleteNotification(notificationId: string): Promise<void> {
  await apiFetch(`/api/notifications/${encodeURIComponent(notificationId)}`, {
    method: 'DELETE',
  }).catch(() => {});
}

export async function clearAllNotificationsForUser(username: string): Promise<void> {
  await apiFetch('/api/notifications', {
    method: 'DELETE',
  }).catch(() => {});
}

// ----------------------------------------------------
// 9. SERVERS, CHANNELS, ROLES & MEMBERS
// ----------------------------------------------------

export async function getServers(): Promise<ServerData[]> {
  const res = await apiFetch('/api/servers');
  if (!res.ok) return [];
  return res.json();
}

export async function getServer(serverId: string): Promise<ServerData | null> {
  const res = await apiFetch(`/api/servers/${encodeURIComponent(serverId)}`);
  if (!res.ok) return null;
  return res.json();
}

export async function createServer(
  name: string,
  owner: string,
  iconUrl?: string | null
): Promise<ServerData | null> {
  const res = await apiFetch('/api/servers', {
    method: 'POST',
    body: JSON.stringify({ name, iconUrl }),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function joinServer(serverId: string, username: string): Promise<boolean> {
  const res = await apiFetch(`/api/servers/${encodeURIComponent(serverId)}/join`, {
    method: 'POST',
  });
  return res.ok;
}

export async function leaveServer(serverId: string, username: string): Promise<boolean> {
  const res = await apiFetch(`/api/servers/${encodeURIComponent(serverId)}/leave`, {
    method: 'POST',
  });
  return res.ok;
}

export async function getServerMembers(serverId: string): Promise<ServerMember[]> {
  const res = await apiFetch(`/api/servers/${encodeURIComponent(serverId)}/members`);
  if (!res.ok) return [];
  return res.json();
}

export async function updateMemberRoles(
  serverId: string,
  username: string,
  roles: string[]
): Promise<boolean> {
  const res = await apiFetch(`/api/servers/${encodeURIComponent(serverId)}/members/${encodeURIComponent(username)}/roles`, {
    method: 'PUT',
    body: JSON.stringify({ roles }),
  });
  return res.ok;
}

export async function getServerChannels(serverId: string): Promise<ServerChannel[]> {
  const res = await apiFetch(`/api/servers/${encodeURIComponent(serverId)}/channels`);
  if (!res.ok) return [];
  return res.json();
}

export async function createChannel(serverId: string, name: string): Promise<ServerChannel | null> {
  const res = await apiFetch(`/api/servers/${encodeURIComponent(serverId)}/channels`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function getServerRoles(serverId: string): Promise<ServerRole[]> {
  const res = await apiFetch(`/api/servers/${encodeURIComponent(serverId)}/roles`);
  if (!res.ok) return [];
  return res.json();
}

export async function createServerRole(
  serverId: string,
  role: Partial<ServerRole>
): Promise<ServerRole | null> {
  const res = await apiFetch(`/api/servers/${encodeURIComponent(serverId)}/roles`, {
    method: 'POST',
    body: JSON.stringify(role),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function deleteServerRole(serverId: string, roleId: string): Promise<boolean> {
  const res = await apiFetch(`/api/servers/${encodeURIComponent(serverId)}/roles/${encodeURIComponent(roleId)}`, {
    method: 'DELETE',
  });
  return res.ok;
}
