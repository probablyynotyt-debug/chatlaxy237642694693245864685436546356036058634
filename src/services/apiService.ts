import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  increment,
  arrayUnion,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, db } from './firebaseConfig';
import { tracker } from './firebaseTracker';
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
}

// ----------------------------------------------------
// IN-MEMORY CACHE FOR STATIC DATA (QUOTA DEFENSE)
// ----------------------------------------------------
interface CacheItem<T> {
  data: T;
  cachedAt: number;
}

const PROFILE_CACHE_TTL = 3 * 60 * 1000; // 3 minutes cache for user profiles
const profileCache = new Map<string, CacheItem<ProfileData>>();

let cachedServers: CacheItem<ServerData[]> | null = null;
const cachedChannels = new Map<string, CacheItem<ServerChannel[]>>();
const cachedRoles = new Map<string, CacheItem<ServerRole[]>>();

export function invalidateUserCache(username?: string) {
  if (username) {
    profileCache.delete(username.toLowerCase().trim());
  } else {
    profileCache.clear();
  }
}

// Helper: standard today date key for daily rewards
export const getTodayKey = (): string => new Date().toISOString().slice(0, 10);

// ----------------------------------------------------
// 1. FIREBASE AUTHENTICATION & SESSIONS
// ----------------------------------------------------

/**
 * Register a new user using Firebase Authentication and initialize Firestore profile.
 */
export async function signup(
  username: string,
  password: string,
  profileData?: Partial<ProfileData>
): Promise<ProfileData | null> {
  const cleanUsername = username.trim();
  const usernameKey = cleanUsername.toLowerCase();

  // 1. Check username availability in usernames collection
  const usernameRef = doc(db, 'usernames', usernameKey);
  tracker.trackRead('usernames', `Check availability for ${usernameKey}`, 1);
  const usernameSnap = await getDoc(usernameRef);
  if (usernameSnap.exists()) {
    throw new Error('This username is already taken. Please choose another.');
  }

  // 2. Prepare real email (either user-provided or generated for Firebase Auth)
  const email =
    profileData?.email && profileData.email.includes('@')
      ? profileData.email.trim()
      : `${usernameKey}@chatlaxy.internal`;

  // 3. Create account with Firebase Authentication
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // Set Auth display name
  try {
    await updateProfile(user, { displayName: cleanUsername });
  } catch {}

  const todayKey = getTodayKey();
  const initialProfile: ProfileData = {
    username: cleanUsername,
    email: email,
    profilePicture: null,
    banner: null,
    mood: 'Exploring Chatlaxy',
    bioSegments: [
      { id: 'initial-bio', text: 'Chatting on chatlaxy. Connect and chill!' },
    ],
    rank: cleanUsername.toLowerCase() === 'null' ? 'DEV' : (profileData?.rank || 'VIP'),
    wallet: { ruby: 5, gold: 1000 },
    lastDailyClaim: 0,
    dailyMessagesCount: 0,
    dailyMessagesDate: todayKey,
    claimedDailyMilestones: [],
    gender: profileData?.gender || '',
    age: profileData?.age || '',
    effects: {
      starEffect: true,
      borderEffect: 'subtle-glow',
      pfpBorder: 'square-neon',
    },
    chatBackground: null,
    ...(profileData || {}),
  };

  // 4. Batch write username mapping and user profile
  const batch = writeBatch(db);
  batch.set(usernameRef, {
    uid: user.uid,
    username: cleanUsername,
    email: email,
    createdAt: Date.now(),
  });
  tracker.trackWrite('usernames', 'set', usernameKey);

  const userDocRef = doc(db, 'users', user.uid);
  batch.set(userDocRef, {
    ...initialProfile,
    uid: user.uid,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastActive: Date.now(),
  });
  tracker.trackWrite('users', 'set', user.uid);

  await batch.commit();

  // Populate cache
  profileCache.set(usernameKey, {
    data: initialProfile,
    cachedAt: Date.now(),
  });

  return initialProfile;
}

/**
 * Sign in using Firebase Authentication with username or email.
 */
export async function login(
  identifier: string,
  password: string
): Promise<ProfileData | null> {
  const cleanId = identifier.trim();
  let emailToUse = cleanId;

  // If user entered a username instead of an email, resolve email from usernames collection
  if (!cleanId.includes('@')) {
    const usernameKey = cleanId.toLowerCase();
    const usernameRef = doc(db, 'usernames', usernameKey);
    tracker.trackRead('usernames', `Lookup email for username ${usernameKey}`, 1);
    const snap = await getDoc(usernameRef);
    if (!snap.exists()) {
      return null;
    }
    const data = snap.data();
    emailToUse = data?.email || `${usernameKey}@chatlaxy.internal`;
  }

  // Real Firebase Auth sign-in
  const userCredential = await signInWithEmailAndPassword(auth, emailToUse, password);
  const user = userCredential.user;

  // Retrieve user profile document
  const userDocRef = doc(db, 'users', user.uid);
  tracker.trackRead('users', `Load profile for uid ${user.uid}`, 1);
  const profileSnap = await getDoc(userDocRef);

  let profile: ProfileData;
  if (profileSnap.exists()) {
    profile = profileSnap.data() as ProfileData;
  } else {
    // Fallback if doc was missing
    profile = {
      username: user.displayName || cleanId,
      email: user.email || emailToUse,
      profilePicture: null,
      banner: null,
      mood: 'Exploring Chatlaxy',
      bioSegments: [],
      rank: (user.displayName || cleanId).toLowerCase() === 'null' ? 'DEV' : 'VIP',
      wallet: { ruby: 5, gold: 1000 },
      lastDailyClaim: 0,
      dailyMessagesCount: 0,
      dailyMessagesDate: getTodayKey(),
    };
    await setDoc(userDocRef, {
      ...profile,
      uid: user.uid,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    tracker.trackWrite('users', 'set', user.uid);
  }

  // Update lastActive timestamp efficiently
  try {
    updateDoc(userDocRef, { lastActive: Date.now() });
    tracker.trackWrite('users', 'update', user.uid);
  } catch {}

  // Cache user profile
  profileCache.set(profile.username.toLowerCase().trim(), {
    data: profile,
    cachedAt: Date.now(),
  });

  return profile;
}

/**
 * Sign out of Firebase Authentication.
 */
export async function logout(): Promise<void> {
  invalidateUserCache();
  await signOut(auth);
}

/**
 * Restore current session from Firebase Auth state.
 */
export async function getCurrentUser(): Promise<{ authenticated: boolean; user?: ProfileData }> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
      unsubscribe();
      if (!user) {
        resolve({ authenticated: false });
        return;
      }

      try {
        const userDocRef = doc(db, 'users', user.uid);
        tracker.trackRead('users', `Session restore for uid ${user.uid}`, 1);
        const profileSnap = await getDoc(userDocRef);
        if (profileSnap.exists()) {
          const profile = profileSnap.data() as ProfileData;
          profileCache.set(profile.username.toLowerCase().trim(), {
            data: profile,
            cachedAt: Date.now(),
          });
          resolve({ authenticated: true, user: profile });
        } else {
          resolve({ authenticated: false });
        }
      } catch (err) {
        console.warn('Error restoring user session:', err);
        resolve({ authenticated: false });
      }
    });
  });
}

// ----------------------------------------------------
// 2. USER PROFILES & DATA
// ----------------------------------------------------

/**
 * Save / Update full or partial user profile in Firestore with quota optimization.
 * Targeted updates avoid rewriting unchanged fields.
 */
export async function saveUserToFirestore(profile: ProfileData): Promise<void> {
  if (!profile || !profile.username) return;
  const usernameKey = profile.username.toLowerCase().trim();

  // Update in-memory cache immediately for 0-latency UI
  profileCache.set(usernameKey, {
    data: profile,
    cachedAt: Date.now(),
  });

  const currentUser = auth.currentUser;
  let targetUid = (profile as any).uid || (currentUser && currentUser.uid);

  // If UID is not known, resolve from usernames collection
  if (!targetUid) {
    const userMapDoc = await getDoc(doc(db, 'usernames', usernameKey));
    tracker.trackRead('usernames', `Resolve uid for ${usernameKey}`, 1);
    if (userMapDoc.exists()) {
      targetUid = userMapDoc.data()?.uid;
    }
  }

  if (targetUid) {
    const userRef = doc(db, 'users', targetUid);
    tracker.trackWrite('users', 'set', targetUid);
    await setDoc(userRef, {
      ...profile,
      updatedAt: Date.now(),
    }, { merge: true });
  }
}

/**
 * Fetch a user profile with in-memory caching to prevent duplicate Firestore reads.
 */
export async function getUserFromFirestore(username: string): Promise<ProfileData | null> {
  if (!username) return null;
  const usernameKey = username.toLowerCase().trim();

  // 1. Check in-memory cache first
  const cached = profileCache.get(usernameKey);
  if (cached && Date.now() - cached.cachedAt < PROFILE_CACHE_TTL) {
    return cached.data;
  }

  // 2. Resolve UID from usernames collection
  const usernameRef = doc(db, 'usernames', usernameKey);
  tracker.trackRead('usernames', `Lookup uid for ${usernameKey}`, 1);
  const uSnap = await getDoc(usernameRef);
  if (!uSnap.exists()) {
    return null;
  }

  const uid = uSnap.data()?.uid;
  if (!uid) return null;

  // 3. Fetch user profile
  const userRef = doc(db, 'users', uid);
  tracker.trackRead('users', `Fetch profile for ${usernameKey}`, 1);
  const profileSnap = await getDoc(userRef);
  if (!profileSnap.exists()) {
    return null;
  }

  const profile = profileSnap.data() as ProfileData;
  profileCache.set(usernameKey, {
    data: profile,
    cachedAt: Date.now(),
  });

  return profile;
}

/**
 * Get all users for admin or specific panels with query limit.
 */
export async function getAllUsersFromFirestore(): Promise<ProfileData[]> {
  const usersQuery = query(collection(db, 'users'), limit(50));
  tracker.trackRead('users', 'Query users (limit 50)', 50);
  const snap = await getDocs(usersQuery);
  const list: ProfileData[] = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data() as ProfileData;
    list.push(data);
    if (data.username) {
      profileCache.set(data.username.toLowerCase().trim(), {
        data,
        cachedAt: Date.now(),
      });
    }
  });
  return list;
}

/**
 * Efficient subscription to recent active users for online panel.
 * Limits query to 30 active users to prevent large collection reads.
 */
export function subscribeToUsers(callback: (users: Record<string, ProfileData>) => void): () => void {
  const usersQuery = query(
    collection(db, 'users'),
    orderBy('updatedAt', 'desc'),
    limit(35)
  );

  const key = 'active_users_list';
  const cleanupTracker = tracker.trackListenerStart(key, 'users', 'Recent active users (limit 35)');

  const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
    tracker.trackRead('users', 'Snapshot active users', snapshot.docs.length);
    const usersMap: Record<string, ProfileData> = {};
    snapshot.forEach((d) => {
      const u = d.data() as ProfileData;
      if (u && u.username) {
        usersMap[u.username.toLowerCase().trim()] = u;
        profileCache.set(u.username.toLowerCase().trim(), {
          data: u,
          cachedAt: Date.now(),
        });
      }
    });
    callback(usersMap);
  }, (err) => {
    console.warn('subscribeToUsers snapshot warning:', err.message);
  });

  return () => {
    cleanupTracker();
    unsubscribe();
  };
}

/**
 * Delete a user profile and username mapping.
 */
export async function deleteUserFromFirestore(username: string): Promise<void> {
  if (!username) return;
  const usernameKey = username.toLowerCase().trim();
  invalidateUserCache(usernameKey);

  const uRef = doc(db, 'usernames', usernameKey);
  tracker.trackRead('usernames', `Find UID to delete ${usernameKey}`, 1);
  const snap = await getDoc(uRef);
  if (snap.exists()) {
    const uid = snap.data()?.uid;
    const batch = writeBatch(db);
    batch.delete(uRef);
    tracker.trackWrite('usernames', 'delete', usernameKey);
    if (uid) {
      batch.delete(doc(db, 'users', uid));
      tracker.trackWrite('users', 'delete', uid);
    }
    await batch.commit();
  }
}

// ----------------------------------------------------
// 3. REALTIME MESSAGES (PAGINATED & QUOTA OPTIMIZED)
// ----------------------------------------------------

/**
 * Listen to messages for the CURRENTLY OPEN channel only.
 * Paginated to approximately the latest 50 messages.
 * Automatically cleans up listeners when channel changes.
 */
export function subscribeToMessages(
  callback: (messages: ChatMessage[]) => void,
  serverId?: string | null,
  channelId?: string | null
): () => void {
  const listenerKey = serverId && channelId
    ? `server_${serverId}_channel_${channelId}_msgs`
    : 'global_messages';

  const cleanupTracker = tracker.trackListenerStart(
    listenerKey,
    'messages',
    `Latest 50 messages for ${listenerKey}`
  );

  let messagesQuery;
  if (serverId && channelId) {
    messagesQuery = query(
      collection(db, 'servers', serverId, 'channels', channelId, 'messages'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
  } else {
    messagesQuery = query(
      collection(db, 'messages'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
  }

  const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
    tracker.trackRead('messages', `Messages update for ${listenerKey}`, snapshot.docs.length);
    const list: ChatMessage[] = [];
    snapshot.forEach((d) => {
      list.push({ ...(d.data() as ChatMessage), id: d.id });
    });
    // Order chronologically (oldest to newest) for chat rendering
    list.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    callback(list);
  }, (err) => {
    console.warn(`Messages snapshot warning (${listenerKey}):`, err.message);
  });

  return () => {
    cleanupTracker();
    unsubscribe();
  };
}

/**
 * Load older messages for infinite scroll pagination using timestamp cursor.
 */
export async function loadOlderMessages(
  oldestTimestamp: number,
  serverId?: string | null,
  channelId?: string | null,
  pageSize = 30
): Promise<ChatMessage[]> {
  let olderQuery;
  if (serverId && channelId) {
    olderQuery = query(
      collection(db, 'servers', serverId, 'channels', channelId, 'messages'),
      where('timestamp', '<', oldestTimestamp),
      orderBy('timestamp', 'desc'),
      limit(pageSize)
    );
  } else {
    olderQuery = query(
      collection(db, 'messages'),
      where('timestamp', '<', oldestTimestamp),
      orderBy('timestamp', 'desc'),
      limit(pageSize)
    );
  }

  tracker.trackRead('messages', `Load older batch (${pageSize} max)`, pageSize);
  const snap = await getDocs(olderQuery);
  const list: ChatMessage[] = [];
  snap.forEach((d) => {
    list.push({ ...(d.data() as ChatMessage), id: d.id });
  });

  list.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  return list;
}

/**
 * Send a message to Firestore.
 */
export async function sendMessageToFirestore(
  message: ChatMessage,
  serverId?: string | null,
  channelId?: string | null
): Promise<void> {
  if (!message || !message.id) return;

  const targetCollection = serverId && channelId
    ? collection(db, 'servers', serverId, 'channels', channelId, 'messages')
    : collection(db, 'messages');

  const msgRef = doc(targetCollection, message.id);
  tracker.trackWrite('messages', 'set', message.id);
  await setDoc(msgRef, {
    ...message,
    createdAt: serverTimestamp(),
  });
}

/**
 * Delete a message from Firestore.
 */
export async function deleteMessageFromFirestore(
  messageId: string,
  serverId?: string | null,
  channelId?: string | null
): Promise<void> {
  if (!messageId) return;

  const msgRef = serverId && channelId
    ? doc(db, 'servers', serverId, 'channels', channelId, 'messages', messageId)
    : doc(db, 'messages', messageId);

  tracker.trackWrite('messages', 'delete', messageId);
  await deleteDoc(msgRef);
}

/**
 * Clear messages for admin command /purged.
 */
export async function clearAllMessagesInFirestore(
  announcementMessage?: ChatMessage,
  serverId?: string | null,
  channelId?: string | null
): Promise<void> {
  const targetCol = serverId && channelId
    ? collection(db, 'servers', serverId, 'channels', channelId, 'messages')
    : collection(db, 'messages');

  const q = query(targetCol, limit(100));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.forEach((d) => {
    batch.delete(d.ref);
  });
  await batch.commit();

  if (announcementMessage) {
    await sendMessageToFirestore(announcementMessage, serverId, channelId);
  }
}

// ----------------------------------------------------
// 4. DAILY REWARDS & TRACKING
// ----------------------------------------------------

/**
 * Record message sent for Daily Rewards with quota efficiency.
 * Only updates user document counter when a message is actually sent.
 */
export async function recordMessageSentForDailyRewards(
  username: string
): Promise<{ count: number; date: string }> {
  const user = auth.currentUser;
  if (!user) return { count: 0, date: getTodayKey() };

  const todayKey = getTodayKey();
  const userRef = doc(db, 'users', user.uid);

  // Read current day status from cache first
  const usernameKey = username.toLowerCase().trim();
  const cached = profileCache.get(usernameKey)?.data;

  let currentCount = 0;
  if (cached && cached.dailyMessagesDate === todayKey) {
    currentCount = (cached.dailyMessagesCount || 0) + 1;
    // Update cache
    profileCache.set(usernameKey, {
      data: {
        ...cached,
        dailyMessagesCount: currentCount,
        dailyMessagesDate: todayKey,
      },
      cachedAt: Date.now(),
    });

    tracker.trackWrite('users', 'update', user.uid);
    await updateDoc(userRef, {
      dailyMessagesCount: increment(1),
      dailyMessagesDate: todayKey,
    });
  } else {
    // New day or first message
    currentCount = 1;
    if (cached) {
      profileCache.set(usernameKey, {
        data: {
          ...cached,
          dailyMessagesCount: 1,
          dailyMessagesDate: todayKey,
          claimedDailyMilestones: [],
        },
        cachedAt: Date.now(),
      });
    }

    tracker.trackWrite('users', 'update', user.uid);
    await updateDoc(userRef, {
      dailyMessagesCount: 1,
      dailyMessagesDate: todayKey,
      claimedDailyMilestones: [],
    });
  }

  return { count: currentCount, date: todayKey };
}

/**
 * Claim milestone reward and atomically credit user wallet in Firestore.
 */
export async function claimDailyReward(
  username: string,
  milestoneCount: number,
  gold: number,
  rubies: number
): Promise<ProfileData | null> {
  const user = auth.currentUser;
  if (!user) return null;

  const userRef = doc(db, 'users', user.uid);
  tracker.trackWrite('users', 'update', user.uid);

  await updateDoc(userRef, {
    'wallet.gold': increment(gold),
    'wallet.ruby': increment(rubies),
    claimedDailyMilestones: arrayUnion(milestoneCount),
    lastDailyClaim: Date.now(),
  });

  // Fetch updated profile and update cache
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    const updated = snap.data() as ProfileData;
    profileCache.set(username.toLowerCase().trim(), {
      data: updated,
      cachedAt: Date.now(),
    });
    return updated;
  }
  return null;
}

/**
 * Fetch top 10 daily active messengers for Leaderboard (on demand only).
 */
export async function getDailyLeaderboard(): Promise<ProfileData[]> {
  const todayKey = getTodayKey();
  const q = query(
    collection(db, 'users'),
    where('dailyMessagesDate', '==', todayKey),
    orderBy('dailyMessagesCount', 'desc'),
    limit(10)
  );

  tracker.trackRead('users', 'Fetch daily leaderboard (limit 10)', 10);
  try {
    const snap = await getDocs(q);
    const list: ProfileData[] = [];
    snap.forEach((d) => list.push(d.data() as ProfileData));
    return list;
  } catch {
    // If composite index is building or not available, fallback to recent users query
    const fallbackQ = query(collection(db, 'users'), limit(30));
    const snap = await getDocs(fallbackQ);
    const list: ProfileData[] = [];
    snap.forEach((d) => {
      const u = d.data() as ProfileData;
      if (u.dailyMessagesDate === todayKey && (u.dailyMessagesCount || 0) > 0) {
        list.push(u);
      }
    });
    return list.sort((a, b) => (b.dailyMessagesCount || 0) - (a.dailyMessagesCount || 0)).slice(0, 10);
  }
}

// ----------------------------------------------------
// 5. AUDIT LOGS (ADMIN ONLY)
// ----------------------------------------------------

export function subscribeToAuditLogs(callback: (logs: AuditLogEntry[]) => void): () => void {
  const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(60));
  const cleanupTracker = tracker.trackListenerStart('audit_logs_listener', 'audit_logs', 'Recent audit logs (limit 60)');

  const unsubscribe = onSnapshot(q, (snapshot) => {
    tracker.trackRead('audit_logs', 'Snapshot audit logs', snapshot.docs.length);
    const list: AuditLogEntry[] = [];
    snapshot.forEach((d) => list.push({ ...(d.data() as AuditLogEntry), id: d.id }));
    callback(list);
  }, (err) => {
    console.warn('Audit logs snapshot warning:', err.message);
  });

  return () => {
    cleanupTracker();
    unsubscribe();
  };
}

export async function addAuditLogToFirestore(entry: AuditLogEntry): Promise<void> {
  if (!entry || !entry.id) return;
  const logRef = doc(db, 'audit_logs', entry.id);
  tracker.trackWrite('audit_logs', 'set', entry.id);
  await setDoc(logRef, entry);
}

export async function clearAuditLogsInFirestore(): Promise<void> {
  const q = query(collection(db, 'audit_logs'), limit(100));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

// ----------------------------------------------------
// 6. RIGGED USERS CONFIG
// ----------------------------------------------------

export function subscribeToRiggedUsers(callback: (rigged: string[]) => void): () => void {
  const docRef = doc(db, 'system_config', 'rigged_users');
  const cleanupTracker = tracker.trackListenerStart('rigged_users_listener', 'system_config', 'Rigged users configuration');

  const unsubscribe = onSnapshot(docRef, (snap) => {
    tracker.trackRead('system_config', 'Snapshot rigged users', 1);
    const data = snap.data();
    callback(Array.isArray(data?.users) ? data.users : []);
  }, (err) => {
    console.warn('Rigged users snapshot warning:', err.message);
  });

  return () => {
    cleanupTracker();
    unsubscribe();
  };
}

export async function setRiggedUserInFirestore(username: string, rigged: boolean): Promise<void> {
  const docRef = doc(db, 'system_config', 'rigged_users');
  const cleanName = username.trim().toLowerCase();
  const snap = await getDoc(docRef);
  const current = (snap.data()?.users || []) as string[];
  const filtered = current.filter((u) => u.toLowerCase() !== cleanName);
  if (rigged) {
    filtered.push(cleanName);
  }
  tracker.trackWrite('system_config', 'set', 'rigged_users');
  await setDoc(docRef, { users: filtered }, { merge: true });
}

// ----------------------------------------------------
// 7. NEWS ANNOUNCEMENTS
// ----------------------------------------------------

export function subscribeToNews(callback: (posts: NewsPost[]) => void): () => void {
  const q = query(collection(db, 'news'), orderBy('timestamp', 'desc'), limit(30));
  const cleanupTracker = tracker.trackListenerStart('news_listener', 'news', 'Recent news announcements (limit 30)');

  const unsubscribe = onSnapshot(q, (snapshot) => {
    tracker.trackRead('news', 'Snapshot news', snapshot.docs.length);
    const list: NewsPost[] = [];
    snapshot.forEach((d) => list.push({ ...(d.data() as NewsPost), id: d.id }));
    callback(list);
  }, (err) => {
    console.warn('News snapshot warning:', err.message);
  });

  return () => {
    cleanupTracker();
    unsubscribe();
  };
}

export async function createNewsPostInFirestore(post: NewsPost): Promise<void> {
  if (!post || !post.id) return;
  const postRef = doc(db, 'news', post.id);
  tracker.trackWrite('news', 'set', post.id);
  await setDoc(postRef, post);
}

export async function deleteNewsPostFromFirestore(postId: string): Promise<void> {
  if (!postId) return;
  const postRef = doc(db, 'news', postId);
  tracker.trackWrite('news', 'delete', postId);
  await deleteDoc(postRef);
}

export async function updateNewsPostInFirestore(post: NewsPost): Promise<void> {
  if (!post || !post.id) return;
  const postRef = doc(db, 'news', post.id);
  tracker.trackWrite('news', 'update', post.id);
  await updateDoc(postRef, { ...post });
}

// ----------------------------------------------------
// 8. NOTIFICATIONS
// ----------------------------------------------------

export function subscribeToUserNotifications(
  username: string,
  callback: (notifications: AppNotification[]) => void
): () => void {
  if (!username) return () => {};
  const cleanName = username.trim().toLowerCase();
  const q = query(
    collection(db, 'notifications'),
    where('recipientUsername', 'in', [cleanName, 'all', username]),
    orderBy('timestamp', 'desc'),
    limit(40)
  );

  const cleanupTracker = tracker.trackListenerStart(
    `notifications_${cleanName}`,
    'notifications',
    `Notifications for ${cleanName} (limit 40)`
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    tracker.trackRead('notifications', `Snapshot notifications for ${cleanName}`, snapshot.docs.length);
    const list: AppNotification[] = [];
    snapshot.forEach((d) => list.push({ ...(d.data() as AppNotification), id: d.id }));
    callback(list);
  }, (err) => {
    console.warn('Notifications snapshot warning:', err.message);
  });

  return () => {
    cleanupTracker();
    unsubscribe();
  };
}

export async function sendNotificationToFirestore(notification: AppNotification): Promise<void> {
  if (!notification || !notification.id) return;
  const notifRef = doc(db, 'notifications', notification.id);
  tracker.trackWrite('notifications', 'set', notification.id);
  await setDoc(notifRef, notification);
}

export async function deleteNotificationFromFirestore(notificationId: string): Promise<void> {
  if (!notificationId) return;
  const notifRef = doc(db, 'notifications', notificationId);
  tracker.trackWrite('notifications', 'delete', notificationId);
  await deleteDoc(notifRef);
}

export async function clearAllNotificationsForUser(username: string): Promise<void> {
  const cleanName = username.trim().toLowerCase();
  const q = query(
    collection(db, 'notifications'),
    where('recipientUsername', 'in', [cleanName, 'all', username]),
    limit(50)
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

// ----------------------------------------------------
// 9. SERVERS, CHANNELS, ROLES & MEMBERS
// ----------------------------------------------------

export async function getServers(): Promise<ServerData[]> {
  // Check cached servers first
  if (cachedServers && Date.now() - cachedServers.cachedAt < 2 * 60 * 1000) {
    return cachedServers.data;
  }

  const q = query(collection(db, 'servers'), limit(40));
  tracker.trackRead('servers', 'Get servers (limit 40)', 40);
  const snap = await getDocs(q);
  const list: ServerData[] = [];
  snap.forEach((d) => list.push({ ...(d.data() as ServerData), id: d.id }));

  cachedServers = {
    data: list,
    cachedAt: Date.now(),
  };

  return list;
}

export async function createServer(
  name: string,
  owner: string,
  iconUrl?: string | null
): Promise<ServerData | null> {
  const serverId = `server-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const serverObj: ServerData = {
    id: serverId,
    name,
    owner,
    iconUrl: iconUrl || null,
    createdAt: Date.now(),
  };

  const batch = writeBatch(db);
  // 1. Create Server Doc
  const serverRef = doc(db, 'servers', serverId);
  batch.set(serverRef, serverObj);
  tracker.trackWrite('servers', 'set', serverId);

  // 2. Create Owner Member Doc
  const memberRef = doc(db, 'servers', serverId, 'members', owner.toLowerCase().trim());
  batch.set(memberRef, {
    serverId,
    username: owner,
    roles: ['Owner'],
    joinedAt: Date.now(),
  });
  tracker.trackWrite('server_members', 'set', owner);

  // 3. Create Default 'general' Channel
  const channelId = `ch-${Date.now()}-general`;
  const channelRef = doc(db, 'servers', serverId, 'channels', channelId);
  batch.set(channelRef, {
    id: channelId,
    serverId,
    name: 'general',
    position: 0,
    createdAt: Date.now(),
  });
  tracker.trackWrite('server_channels', 'set', channelId);

  await batch.commit();

  // Invalidate cache
  cachedServers = null;

  return serverObj;
}

export async function joinServer(serverId: string, username: string): Promise<boolean> {
  const memberRef = doc(db, 'servers', serverId, 'members', username.toLowerCase().trim());
  tracker.trackWrite('server_members', 'set', username);
  await setDoc(memberRef, {
    serverId,
    username,
    roles: ['Member'],
    joinedAt: Date.now(),
  });
  return true;
}

export async function leaveServer(serverId: string, username: string): Promise<boolean> {
  const memberRef = doc(db, 'servers', serverId, 'members', username.toLowerCase().trim());
  tracker.trackWrite('server_members', 'delete', username);
  await deleteDoc(memberRef);
  return true;
}

export async function getServerMembers(serverId: string): Promise<ServerMember[]> {
  const q = query(collection(db, 'servers', serverId, 'members'), limit(60));
  tracker.trackRead('server_members', `Get members for server ${serverId}`, 60);
  const snap = await getDocs(q);
  const list: ServerMember[] = [];
  snap.forEach((d) => list.push(d.data() as ServerMember));
  return list;
}

export async function updateMemberRoles(
  serverId: string,
  username: string,
  roles: string[]
): Promise<boolean> {
  const memberRef = doc(db, 'servers', serverId, 'members', username.toLowerCase().trim());
  tracker.trackWrite('server_members', 'update', username);
  await updateDoc(memberRef, { roles });
  return true;
}

export async function getServerChannels(serverId: string): Promise<ServerChannel[]> {
  const cached = cachedChannels.get(serverId);
  if (cached && Date.now() - cached.cachedAt < 2 * 60 * 1000) {
    return cached.data;
  }

  const q = query(collection(db, 'servers', serverId, 'channels'), orderBy('name', 'asc'));
  tracker.trackRead('server_channels', `Get channels for ${serverId}`, 20);
  const snap = await getDocs(q);
  const list: ServerChannel[] = [];
  snap.forEach((d) => list.push({ ...(d.data() as ServerChannel), id: d.id }));

  cachedChannels.set(serverId, { data: list, cachedAt: Date.now() });
  return list;
}

export async function createChannel(serverId: string, name: string): Promise<ServerChannel | null> {
  const channelId = `ch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const cleanName = name.toLowerCase().replace(/\s+/g, '-');
  const channelObj: ServerChannel = {
    id: channelId,
    serverId,
    name: cleanName,
    position: 0,
  };

  const channelRef = doc(db, 'servers', serverId, 'channels', channelId);
  tracker.trackWrite('server_channels', 'set', channelId);
  await setDoc(channelRef, channelObj);

  cachedChannels.delete(serverId);
  return channelObj;
}

export async function getServerRoles(serverId: string): Promise<ServerRole[]> {
  const cached = cachedRoles.get(serverId);
  if (cached && Date.now() - cached.cachedAt < 2 * 60 * 1000) {
    return cached.data;
  }

  const q = query(collection(db, 'servers', serverId, 'roles'), orderBy('position', 'asc'));
  tracker.trackRead('server_roles', `Get roles for ${serverId}`, 20);
  const snap = await getDocs(q);
  const list: ServerRole[] = [];
  snap.forEach((d) => list.push({ ...(d.data() as ServerRole), id: d.id }));

  cachedRoles.set(serverId, { data: list, cachedAt: Date.now() });
  return list;
}

export async function createServerRole(
  serverId: string,
  role: Partial<ServerRole>
): Promise<ServerRole | null> {
  const roleId = `role-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const roleObj: ServerRole = {
    id: roleId,
    serverId,
    name: role.name || 'new-role',
    colour: role.colour || '#99aab5',
    position: role.position || 0,
    permissions: role.permissions || [],
  };

  const roleRef = doc(db, 'servers', serverId, 'roles', roleId);
  tracker.trackWrite('server_roles', 'set', roleId);
  await setDoc(roleRef, roleObj);

  cachedRoles.delete(serverId);
  return roleObj;
}

export async function deleteServerRole(serverId: string, roleId: string): Promise<boolean> {
  const roleRef = doc(db, 'servers', serverId, 'roles', roleId);
  tracker.trackWrite('server_roles', 'delete', roleId);
  await deleteDoc(roleRef);
  cachedRoles.delete(serverId);
  return true;
}
