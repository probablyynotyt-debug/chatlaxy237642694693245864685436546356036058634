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

const PROFILE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache for user profiles
const profileCache = new Map<string, CacheItem<ProfileData>>();
const uidMapCache = new Map<string, string>(); // username -> uid mapping

let cachedServers: CacheItem<ServerData[]> | null = null;
const cachedChannels = new Map<string, CacheItem<ServerChannel[]>>();
const cachedRoles = new Map<string, CacheItem<ServerRole[]>>();
const cachedMembers = new Map<string, CacheItem<ServerMember[]>>();

export function invalidateUserCache(username?: string) {
  if (username) {
    profileCache.delete(username.toLowerCase().trim());
  } else {
    profileCache.clear();
  }
}

export const getTodayKey = (): string => new Date().toISOString().slice(0, 10);

// ----------------------------------------------------
// 1. FIREBASE AUTHENTICATION & SESSIONS
// ----------------------------------------------------

export async function signup(
  username: string,
  password: string,
  profileData?: Partial<ProfileData>
): Promise<ProfileData | null> {
  const cleanUsername = username.trim();
  const usernameKey = cleanUsername.toLowerCase();

  // 1. Check username availability in usernames collection
  const usernameRef = doc(db, 'usernames', usernameKey);
  tracker.trackRead('usernames', 'getDoc', 'signup()', `Check availability for ${usernameKey}`, 1);
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
  tracker.trackWrite('usernames', 'batch', 'signup()', usernameKey, `Map ${usernameKey} -> ${user.uid}`);

  const userDocRef = doc(db, 'users', user.uid);
  batch.set(userDocRef, {
    ...initialProfile,
    uid: user.uid,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastActive: Date.now(),
  });
  tracker.trackWrite('users', 'batch', 'signup()', user.uid, `Create profile doc for ${cleanUsername}`);

  await batch.commit();

  uidMapCache.set(usernameKey, user.uid);
  profileCache.set(usernameKey, {
    data: initialProfile,
    cachedAt: Date.now(),
  });

  return initialProfile;
}

export async function login(
  identifier: string,
  password: string
): Promise<ProfileData | null> {
  const cleanId = identifier.trim();
  let emailToUse = cleanId;

  if (!cleanId.includes('@')) {
    const usernameKey = cleanId.toLowerCase();
    const usernameRef = doc(db, 'usernames', usernameKey);
    tracker.trackRead('usernames', 'getDoc', 'login()', `Resolve email for username ${usernameKey}`, 1);
    const snap = await getDoc(usernameRef);
    if (!snap.exists()) {
      return null;
    }
    const data = snap.data();
    emailToUse = data?.email || `${usernameKey}@chatlaxy.internal`;
    if (data?.uid) {
      uidMapCache.set(usernameKey, data.uid);
    }
  }

  const userCredential = await signInWithEmailAndPassword(auth, emailToUse, password);
  const user = userCredential.user;

  const userDocRef = doc(db, 'users', user.uid);
  tracker.trackRead('users', 'getDoc', 'login()', `Load profile for uid ${user.uid}`, 1);
  const profileSnap = await getDoc(userDocRef);

  let profile: ProfileData;
  if (profileSnap.exists()) {
    profile = profileSnap.data() as ProfileData;
  } else {
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
    tracker.trackWrite('users', 'setDoc', 'login()', user.uid, `Initialize fallback profile for ${user.uid}`);
  }

  const cleanUsernameKey = profile.username.toLowerCase().trim();
  uidMapCache.set(cleanUsernameKey, user.uid);
  profileCache.set(cleanUsernameKey, {
    data: profile,
    cachedAt: Date.now(),
  });

  return profile;
}

export async function logout(): Promise<void> {
  invalidateUserCache();
  await signOut(auth);
}

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
        tracker.trackRead('users', 'getDoc', 'getCurrentUser()', `Session restore for uid ${user.uid}`, 1);
        const profileSnap = await getDoc(userDocRef);
        if (profileSnap.exists()) {
          const profile = profileSnap.data() as ProfileData;
          const uKey = profile.username.toLowerCase().trim();
          uidMapCache.set(uKey, user.uid);
          profileCache.set(uKey, {
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

export async function saveUserToFirestore(profile: ProfileData): Promise<void> {
  if (!profile || !profile.username) return;
  const usernameKey = profile.username.toLowerCase().trim();

  // Update in-memory cache immediately
  profileCache.set(usernameKey, {
    data: profile,
    cachedAt: Date.now(),
  });

  const currentUser = auth.currentUser;
  let targetUid = (profile as any).uid || uidMapCache.get(usernameKey) || (currentUser && currentUser.uid);

  if (!targetUid) {
    tracker.trackRead('usernames', 'getDoc', 'saveUserToFirestore()', `Resolve uid for ${usernameKey}`, 1);
    const userMapDoc = await getDoc(doc(db, 'usernames', usernameKey));
    if (userMapDoc.exists()) {
      targetUid = userMapDoc.data()?.uid;
      if (targetUid) uidMapCache.set(usernameKey, targetUid);
    }
  }

  if (targetUid) {
    const userRef = doc(db, 'users', targetUid);
    tracker.trackWrite('users', 'setDoc', 'saveUserToFirestore()', targetUid, `Save profile data for ${profile.username}`);
    await setDoc(userRef, {
      ...profile,
      updatedAt: Date.now(),
    }, { merge: true });
  }
}

export async function getUserFromFirestore(username: string): Promise<ProfileData | null> {
  if (!username) return null;
  const usernameKey = username.toLowerCase().trim();

  // 1. In-memory cache hit (0 reads)
  const cached = profileCache.get(usernameKey);
  if (cached && Date.now() - cached.cachedAt < PROFILE_CACHE_TTL) {
    return cached.data;
  }

  // 2. Check UID cache
  let uid = uidMapCache.get(usernameKey);
  if (!uid) {
    const usernameRef = doc(db, 'usernames', usernameKey);
    tracker.trackRead('usernames', 'getDoc', 'getUserFromFirestore()', `Lookup uid for ${usernameKey}`, 1);
    const uSnap = await getDoc(usernameRef);
    if (!uSnap.exists()) {
      return null;
    }
    uid = uSnap.data()?.uid;
    if (uid) uidMapCache.set(usernameKey, uid);
  }

  if (!uid) return null;

  // 3. Fetch profile
  const userRef = doc(db, 'users', uid);
  tracker.trackRead('users', 'getDoc', 'getUserFromFirestore()', `Fetch profile for ${usernameKey}`, 1);
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

export async function getAllUsersFromFirestore(): Promise<ProfileData[]> {
  const usersQuery = query(collection(db, 'users'), limit(30));
  tracker.trackRead('users', 'getDocs', 'getAllUsersFromFirestore()', 'Query users (limit 30)', 30);
  const snap = await getDocs(usersQuery);
  const list: ProfileData[] = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data() as ProfileData;
    list.push(data);
    if (data.username) {
      const uKey = data.username.toLowerCase().trim();
      profileCache.set(uKey, {
        data,
        cachedAt: Date.now(),
      });
      if ((data as any).uid) uidMapCache.set(uKey, (data as any).uid);
    }
  });
  return list;
}

/**
 * Highly optimized user presence loader:
 * Fetches recent active users ONCE on mount with limit(15), instead of continuous onSnapshot listening.
 * Active chatters are seamlessly merged from incoming chat messages in memory with 0 extra reads.
 */
export function subscribeToUsers(callback: (users: Record<string, ProfileData>) => void): () => void {
  let isMounted = true;
  const usersQuery = query(collection(db, 'users'), limit(15));

  tracker.trackRead('users', 'getDocs', 'subscribeToUsers()', 'Initial load active users (limit 15)', 15);
  getDocs(usersQuery).then((snap) => {
    if (!isMounted) return;
    const usersMap: Record<string, ProfileData> = {};
    snap.forEach((d) => {
      const u = d.data() as ProfileData;
      if (u && u.username) {
        const uKey = u.username.toLowerCase().trim();
        usersMap[uKey] = u;
        profileCache.set(uKey, {
          data: u,
          cachedAt: Date.now(),
        });
        if ((u as any).uid) uidMapCache.set(uKey, (u as any).uid);
      }
    });
    callback(usersMap);
  }).catch((err) => {
    console.warn('Initial users load warning:', err.message);
  });

  return () => {
    isMounted = false;
  };
}

export async function deleteUserFromFirestore(username: string): Promise<void> {
  if (!username) return;
  const usernameKey = username.toLowerCase().trim();
  invalidateUserCache(usernameKey);

  const uRef = doc(db, 'usernames', usernameKey);
  tracker.trackRead('usernames', 'getDoc', 'deleteUserFromFirestore()', `Find UID to delete ${usernameKey}`, 1);
  const snap = await getDoc(uRef);
  if (snap.exists()) {
    const uid = snap.data()?.uid;
    const batch = writeBatch(db);
    batch.delete(uRef);
    tracker.trackWrite('usernames', 'deleteDoc', 'deleteUserFromFirestore()', usernameKey);
    if (uid) {
      batch.delete(doc(db, 'users', uid));
      tracker.trackWrite('users', 'deleteDoc', 'deleteUserFromFirestore()', uid);
    }
    await batch.commit();
  }
}

// ----------------------------------------------------
// 3. REALTIME MESSAGES (PAGINATED & OPEN CHANNEL ONLY)
// ----------------------------------------------------

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
    'subscribeToMessages()',
    `Open channel messages (limit 50)`
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
    tracker.trackRead(
      'messages',
      'onSnapshot',
      'subscribeToMessages()',
      `Messages update for ${listenerKey}`,
      snapshot.docs.length,
      true
    );
    const list: ChatMessage[] = [];
    snapshot.forEach((d) => {
      list.push({ ...(d.data() as ChatMessage), id: d.id });
    });
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

  tracker.trackRead('messages', 'getDocs', 'loadOlderMessages()', `Load older batch (limit ${pageSize})`, pageSize);
  const snap = await getDocs(olderQuery);
  const list: ChatMessage[] = [];
  snap.forEach((d) => {
    list.push({ ...(d.data() as ChatMessage), id: d.id });
  });

  list.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  return list;
}

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
  tracker.trackWrite('messages', 'setDoc', 'sendMessageToFirestore()', message.id, `Send message: ${message.content.slice(0, 20)}`);
  await setDoc(msgRef, {
    ...message,
    createdAt: serverTimestamp(),
  });
}

export async function deleteMessageFromFirestore(
  messageId: string,
  serverId?: string | null,
  channelId?: string | null
): Promise<void> {
  if (!messageId) return;

  const msgRef = serverId && channelId
    ? doc(db, 'servers', serverId, 'channels', channelId, 'messages', messageId)
    : doc(db, 'messages', messageId);

  tracker.trackWrite('messages', 'deleteDoc', 'deleteMessageFromFirestore()', messageId);
  await deleteDoc(msgRef);
}

export async function clearAllMessagesInFirestore(
  announcementMessage?: ChatMessage,
  serverId?: string | null,
  channelId?: string | null
): Promise<void> {
  const targetCol = serverId && channelId
    ? collection(db, 'servers', serverId, 'channels', channelId, 'messages')
    : collection(db, 'messages');

  const q = query(targetCol, limit(100));
  tracker.trackRead('messages', 'getDocs', 'clearAllMessagesInFirestore()', 'Fetch messages to purge', 100);
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

export async function recordMessageSentForDailyRewards(
  username: string
): Promise<{ count: number; date: string }> {
  const user = auth.currentUser;
  if (!user) return { count: 0, date: getTodayKey() };

  const todayKey = getTodayKey();
  const userRef = doc(db, 'users', user.uid);
  const usernameKey = username.toLowerCase().trim();
  const cached = profileCache.get(usernameKey)?.data;

  let currentCount = 1;
  if (cached && cached.dailyMessagesDate === todayKey) {
    currentCount = (cached.dailyMessagesCount || 0) + 1;
    profileCache.set(usernameKey, {
      data: {
        ...cached,
        dailyMessagesCount: currentCount,
        dailyMessagesDate: todayKey,
      },
      cachedAt: Date.now(),
    });

    tracker.trackWrite('users', 'updateDoc', 'recordMessageSentForDailyRewards()', user.uid, `Daily message increment (+1)`);
    await updateDoc(userRef, {
      dailyMessagesCount: increment(1),
      dailyMessagesDate: todayKey,
    });
  } else {
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

    tracker.trackWrite('users', 'updateDoc', 'recordMessageSentForDailyRewards()', user.uid, `Daily message reset to 1`);
    await updateDoc(userRef, {
      dailyMessagesCount: 1,
      dailyMessagesDate: todayKey,
      claimedDailyMilestones: [],
    });
  }

  return { count: currentCount, date: todayKey };
}

export async function claimDailyReward(
  username: string,
  milestoneCount: number,
  gold: number,
  rubies: number
): Promise<ProfileData | null> {
  const user = auth.currentUser;
  if (!user) return null;

  const userRef = doc(db, 'users', user.uid);
  tracker.trackWrite('users', 'updateDoc', 'claimDailyReward()', user.uid, `Claim milestone ${milestoneCount}`);

  await updateDoc(userRef, {
    'wallet.gold': increment(gold),
    'wallet.ruby': increment(rubies),
    claimedDailyMilestones: arrayUnion(milestoneCount),
    lastDailyClaim: Date.now(),
  });

  tracker.trackRead('users', 'getDoc', 'claimDailyReward()', `Refresh claimed profile for ${username}`, 1);
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

export async function getDailyLeaderboard(): Promise<ProfileData[]> {
  const todayKey = getTodayKey();
  const q = query(
    collection(db, 'users'),
    where('dailyMessagesDate', '==', todayKey),
    orderBy('dailyMessagesCount', 'desc'),
    limit(10)
  );

  tracker.trackRead('users', 'getDocs', 'getDailyLeaderboard()', 'Fetch top 10 messengers', 10);
  try {
    const snap = await getDocs(q);
    const list: ProfileData[] = [];
    snap.forEach((d) => list.push(d.data() as ProfileData));
    return list;
  } catch {
    const fallbackQ = query(collection(db, 'users'), limit(20));
    tracker.trackRead('users', 'getDocs', 'getDailyLeaderboardFallback()', 'Fetch recent for leaderboard fallback', 20);
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
  const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(40));
  const cleanupTracker = tracker.trackListenerStart('audit_logs_listener', 'audit_logs', 'subscribeToAuditLogs()', 'Audit logs (limit 40)');

  const unsubscribe = onSnapshot(q, (snapshot) => {
    tracker.trackRead('audit_logs', 'onSnapshot', 'subscribeToAuditLogs()', 'Snapshot audit logs', snapshot.docs.length, true);
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
  tracker.trackWrite('audit_logs', 'setDoc', 'addAuditLogToFirestore()', entry.id, `Admin audit: ${entry.action}`);
  await setDoc(logRef, entry);
}

export async function clearAuditLogsInFirestore(): Promise<void> {
  const q = query(collection(db, 'audit_logs'), limit(50));
  tracker.trackRead('audit_logs', 'getDocs', 'clearAuditLogsInFirestore()', 'Fetch logs to clear', 50);
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
  const cleanupTracker = tracker.trackListenerStart('rigged_users_listener', 'system_config', 'subscribeToRiggedUsers()', 'Rigged users');

  const unsubscribe = onSnapshot(docRef, (snap) => {
    tracker.trackRead('system_config', 'onSnapshot', 'subscribeToRiggedUsers()', 'Snapshot rigged config', 1, true);
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
  tracker.trackRead('system_config', 'getDoc', 'setRiggedUserInFirestore()', 'Read rigged users config', 1);
  const snap = await getDoc(docRef);
  const current = (snap.data()?.users || []) as string[];
  const filtered = current.filter((u) => u.toLowerCase() !== cleanName);
  if (rigged) {
    filtered.push(cleanName);
  }
  tracker.trackWrite('system_config', 'setDoc', 'setRiggedUserInFirestore()', 'rigged_users', `Update rigged list: ${cleanName}`);
  await setDoc(docRef, { users: filtered }, { merge: true });
}

// ----------------------------------------------------
// 7. NEWS ANNOUNCEMENTS
// ----------------------------------------------------

export function subscribeToNews(callback: (posts: NewsPost[]) => void): () => void {
  const q = query(collection(db, 'news'), orderBy('timestamp', 'desc'), limit(15));
  const cleanupTracker = tracker.trackListenerStart('news_listener', 'news', 'subscribeToNews()', 'News (limit 15)');

  const unsubscribe = onSnapshot(q, (snapshot) => {
    tracker.trackRead('news', 'onSnapshot', 'subscribeToNews()', 'Snapshot news', snapshot.docs.length, true);
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
  tracker.trackWrite('news', 'setDoc', 'createNewsPostInFirestore()', post.id, `Post news: ${post.content.slice(0, 30)}`);
  await setDoc(postRef, post);
}

export async function deleteNewsPostFromFirestore(postId: string): Promise<void> {
  if (!postId) return;
  const postRef = doc(db, 'news', postId);
  tracker.trackWrite('news', 'deleteDoc', 'deleteNewsPostFromFirestore()', postId);
  await deleteDoc(postRef);
}

export async function updateNewsPostInFirestore(post: NewsPost): Promise<void> {
  if (!post || !post.id) return;
  const postRef = doc(db, 'news', post.id);
  tracker.trackWrite('news', 'updateDoc', 'updateNewsPostInFirestore()', post.id);
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
    limit(20)
  );

  const cleanupTracker = tracker.trackListenerStart(
    `notifications_${cleanName}`,
    'notifications',
    'subscribeToUserNotifications()',
    `Notifications for ${cleanName} (limit 20)`
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    tracker.trackRead(
      'notifications',
      'onSnapshot',
      'subscribeToUserNotifications()',
      `Snapshot notifications for ${cleanName}`,
      snapshot.docs.length,
      true
    );
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
  tracker.trackWrite('notifications', 'setDoc', 'sendNotificationToFirestore()', notification.id, `Notification to ${notification.recipientUsername}`);
  await setDoc(notifRef, notification);
}

export async function deleteNotificationFromFirestore(notificationId: string): Promise<void> {
  if (!notificationId) return;
  const notifRef = doc(db, 'notifications', notificationId);
  tracker.trackWrite('notifications', 'deleteDoc', 'deleteNotificationFromFirestore()', notificationId);
  await deleteDoc(notifRef);
}

export async function clearAllNotificationsForUser(username: string): Promise<void> {
  const cleanName = username.trim().toLowerCase();
  const q = query(
    collection(db, 'notifications'),
    where('recipientUsername', 'in', [cleanName, 'all', username]),
    limit(30)
  );
  tracker.trackRead('notifications', 'getDocs', 'clearAllNotificationsForUser()', 'Fetch notifications to clear', 30);
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

// ----------------------------------------------------
// 9. SERVERS, CHANNELS, ROLES & MEMBERS (CACHED)
// ----------------------------------------------------

export async function getServers(): Promise<ServerData[]> {
  if (cachedServers && Date.now() - cachedServers.cachedAt < 5 * 60 * 1000) {
    return cachedServers.data;
  }

  const q = query(collection(db, 'servers'), limit(25));
  tracker.trackRead('servers', 'getDocs', 'getServers()', 'Get servers (limit 25)', 25);
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
  const serverRef = doc(db, 'servers', serverId);
  batch.set(serverRef, serverObj);
  tracker.trackWrite('servers', 'batch', 'createServer()', serverId);

  const memberRef = doc(db, 'servers', serverId, 'members', owner.toLowerCase().trim());
  batch.set(memberRef, {
    serverId,
    username: owner,
    roles: ['Owner'],
    joinedAt: Date.now(),
  });
  tracker.trackWrite('server_members', 'batch', 'createServer()', owner);

  const channelId = `ch-${Date.now()}-general`;
  const channelRef = doc(db, 'servers', serverId, 'channels', channelId);
  batch.set(channelRef, {
    id: channelId,
    serverId,
    name: 'general',
    position: 0,
    createdAt: Date.now(),
  });
  tracker.trackWrite('server_channels', 'batch', 'createServer()', channelId);

  await batch.commit();

  cachedServers = null;
  return serverObj;
}

export async function joinServer(serverId: string, username: string): Promise<boolean> {
  const memberRef = doc(db, 'servers', serverId, 'members', username.toLowerCase().trim());
  tracker.trackWrite('server_members', 'setDoc', 'joinServer()', username);
  await setDoc(memberRef, {
    serverId,
    username,
    roles: ['Member'],
    joinedAt: Date.now(),
  });
  cachedMembers.delete(serverId);
  return true;
}

export async function leaveServer(serverId: string, username: string): Promise<boolean> {
  const memberRef = doc(db, 'servers', serverId, 'members', username.toLowerCase().trim());
  tracker.trackWrite('server_members', 'deleteDoc', 'leaveServer()', username);
  await deleteDoc(memberRef);
  cachedMembers.delete(serverId);
  return true;
}

export async function getServerMembers(serverId: string): Promise<ServerMember[]> {
  const cached = cachedMembers.get(serverId);
  if (cached && Date.now() - cached.cachedAt < 5 * 60 * 1000) {
    return cached.data;
  }

  const q = query(collection(db, 'servers', serverId, 'members'), limit(30));
  tracker.trackRead('server_members', 'getDocs', 'getServerMembers()', `Get members for server ${serverId}`, 30);
  const snap = await getDocs(q);
  const list: ServerMember[] = [];
  snap.forEach((d) => list.push(d.data() as ServerMember));

  cachedMembers.set(serverId, { data: list, cachedAt: Date.now() });
  return list;
}

export async function updateMemberRoles(
  serverId: string,
  username: string,
  roles: string[]
): Promise<boolean> {
  const memberRef = doc(db, 'servers', serverId, 'members', username.toLowerCase().trim());
  tracker.trackWrite('server_members', 'updateDoc', 'updateMemberRoles()', username);
  await updateDoc(memberRef, { roles });
  cachedMembers.delete(serverId);
  return true;
}

export async function getServerChannels(serverId: string): Promise<ServerChannel[]> {
  const cached = cachedChannels.get(serverId);
  if (cached && Date.now() - cached.cachedAt < 5 * 60 * 1000) {
    return cached.data;
  }

  const q = query(collection(db, 'servers', serverId, 'channels'), orderBy('name', 'asc'));
  tracker.trackRead('server_channels', 'getDocs', 'getServerChannels()', `Get channels for ${serverId}`, 10);
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
  tracker.trackWrite('server_channels', 'setDoc', 'createChannel()', channelId);
  await setDoc(channelRef, channelObj);

  cachedChannels.delete(serverId);
  return channelObj;
}

export async function getServerRoles(serverId: string): Promise<ServerRole[]> {
  const cached = cachedRoles.get(serverId);
  if (cached && Date.now() - cached.cachedAt < 5 * 60 * 1000) {
    return cached.data;
  }

  const q = query(collection(db, 'servers', serverId, 'roles'), orderBy('position', 'asc'));
  tracker.trackRead('server_roles', 'getDocs', 'getServerRoles()', `Get roles for ${serverId}`, 10);
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
  tracker.trackWrite('server_roles', 'setDoc', 'createServerRole()', roleId);
  await setDoc(roleRef, roleObj);

  cachedRoles.delete(serverId);
  return roleObj;
}

export async function deleteServerRole(serverId: string, roleId: string): Promise<boolean> {
  const roleRef = doc(db, 'servers', serverId, 'roles', roleId);
  tracker.trackWrite('server_roles', 'deleteDoc', 'deleteServerRole()', roleId);
  await deleteDoc(roleRef);
  cachedRoles.delete(serverId);
  return true;
}
