import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDatabase, query, getOne, execute, persistDbNow, isUsingPostgres } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);

// In-memory token cache (backed by SQLite sessions table)
const tokenCache = new Map();

async function generateToken(username) {
  const token = crypto.randomBytes(32).toString('hex');
  const cleanUsername = username.toLowerCase().trim();
  const now = Date.now();
  tokenCache.set(token, cleanUsername);

  try {
    await execute(
      'INSERT OR REPLACE INTO sessions (token, username, createdAt, expiresAt) VALUES (?, ?, ?, ?)',
      [token, cleanUsername, now, now + 30 * 24 * 60 * 60 * 1000] // 30 days
    );
  } catch (err) {
    console.warn('Failed to persist session to SQLite:', err.message);
  }

  return token;
}

async function resolveToken(token) {
  if (!token) return null;
  if (tokenCache.has(token)) return tokenCache.get(token);

  try {
    const session = await getOne('SELECT username FROM sessions WHERE token = ?', [token]);
    if (session && session.username) {
      const cleanUsername = session.username.toLowerCase().trim();
      tokenCache.set(token, cleanUsername);
      return cleanUsername;
    }
  } catch (err) {
    console.warn('Session resolve error:', err.message);
  }
  return null;
}

async function verifyAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : req.query.token;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const username = await resolveToken(token);
  if (!username) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
  }

  req.username = username;
  next();
}

async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : req.query.token;

  if (token) {
    const username = await resolveToken(token);
    if (username) req.username = username;
  }
  next();
}

// ----------------------------------------------------
// CORS Configuration
// ----------------------------------------------------
app.use(cors({
  origin: (origin, callback) => {
    // Allow any origin for local dev and future public tunnels
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(express.json({ limit: '10mb' }));

// ----------------------------------------------------
// Health Check Endpoints
// ----------------------------------------------------
const healthResponse = (req, res) => {
  res.json({
    status: 'ok',
    service: 'chatlaxy',
    database: isUsingPostgres() ? 'postgresql' : 'sqlite',
    port: PORT,
  });
};

app.get('/health', healthResponse);
app.get('/api/health', healthResponse);

// Helper: Format DB user row into ProfileData object (never exposes passwordHash)
function formatUser(row) {
  if (!row) return null;
  return {
    username: row.username,
    displayName: row.displayName || row.username,
    email: row.email,
    gender: row.gender || '',
    age: row.age || '',
    profilePicture: row.profilePicture || null,
    banner: row.banner || null,
    bioSegments: row.bioSegments ? JSON.parse(row.bioSegments) : [],
    mood: row.mood || '',
    rank: row.rank || 'VIP',
    customRankName: row.customRankName || null,
    avatarFrame: row.avatarFrame || null,
    profileBorder: row.profileBorder || null,
    profileEffect: row.profileEffect || null,
    profileMusic: row.profileMusic || null,
    chatBackground: row.chatBackground || null,
    effects: row.effects ? JSON.parse(row.effects) : { starEffect: true, borderEffect: 'subtle-glow', pfpBorder: 'square-neon' },
    usernameStyle: row.usernameStyle ? JSON.parse(row.usernameStyle) : null,
    chatTextStyle: row.chatTextStyle ? JSON.parse(row.chatTextStyle) : null,
    globalTags: row.globalTags ? JSON.parse(row.globalTags) : [],
    likesCount: Number(row.likesCount) || 0,
    likedBy: row.likedBy ? JSON.parse(row.likedBy) : [],
    wallet: row.wallet ? JSON.parse(row.wallet) : { ruby: 5, gold: 1000 },
    dailyMessagesDate: row.dailyMessagesDate || new Date().toISOString().slice(0, 10),
    dailyMessagesCount: Number(row.dailyMessagesCount) || 0,
    claimedDailyMilestones: row.claimedDailyMilestones ? JSON.parse(row.claimedDailyMilestones) : [],
    lastDailyClaim: Number(row.lastDailyClaim) || 0,
    lastActive: Number(row.lastActive) || Date.now(),
    createdAt: Number(row.createdAt),
    updatedAt: Number(row.updatedAt),
  };
}

// ----------------------------------------------------
// WEBSOCKET SERVER & REALTIME MESSAGING
// ----------------------------------------------------
const wss = new WebSocketServer({ server, path: '/ws' });

// Track client sockets: ws -> { username, serverId, channelId }
const clients = new Map();

function broadcast(event, filterFn = null) {
  const payload = JSON.stringify(event);
  for (const [client, meta] of clients.entries()) {
    if (client.readyState === WebSocket.OPEN) {
      if (!filterFn || filterFn(meta)) {
        client.send(payload);
      }
    }
  }
}

function broadcastPresence() {
  const onlineUsers = Array.from(new Set(
    Array.from(clients.values())
      .map((c) => c.username)
      .filter(Boolean)
  ));
  broadcast({
    type: 'presence',
    onlineUsers,
  });
}

wss.on('connection', (ws) => {
  clients.set(ws, { username: null, serverId: null, channelId: null });

  ws.on('message', async (raw) => {
    try {
      const data = JSON.parse(raw.toString());

      if (data.type === 'auth') {
        let username = null;
        if (data.token) {
          username = await resolveToken(data.token);
        }
        if (!username && data.username) {
          username = data.username.toLowerCase().trim();
        }

        if (username) {
          const meta = clients.get(ws) || {};
          meta.username = username;
          clients.set(ws, meta);
          broadcastPresence();
        }
      } else if (data.type === 'subscribe_channel') {
        const meta = clients.get(ws) || {};
        meta.serverId = data.serverId || null;
        meta.channelId = data.channelId || null;
        clients.set(ws, meta);
      } else if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (err) {
      console.warn('WS message error:', err.message);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    broadcastPresence();
  });

  broadcastPresence();
});

// ----------------------------------------------------
// 1. AUTHENTICATION ENDPOINTS
// ----------------------------------------------------

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, password, email, gender, age, rank } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const cleanUsername = username.trim();
    if (cleanUsername.length < 2 || cleanUsername.length > 30) {
      return res.status(400).json({ error: 'Username must be between 2 and 30 characters' });
    }

    const usernameLower = cleanUsername.toLowerCase();
    const existing = await getOne('SELECT id FROM users WHERE LOWER(username) = ?', [usernameLower]);
    if (existing) {
      return res.status(400).json({ error: 'This username is already taken. Please choose another.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = `user_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const todayKey = new Date().toISOString().slice(0, 10);
    const initialWallet = JSON.stringify({ ruby: 5, gold: 1000 });
    const initialEffects = JSON.stringify({ starEffect: true, borderEffect: 'subtle-glow', pfpBorder: 'square-neon' });
    const initialBio = JSON.stringify([{ id: 'b1', text: 'Chatting on Chatlaxy. Connect and chill!' }]);
    const initialRank = usernameLower === 'null' ? 'DEV' : (rank || 'VIP');
    const now = Date.now();

    await execute(
      `INSERT INTO users (
        id, username, displayName, passwordHash, email, gender, age,
        profilePicture, banner, bioSegments, mood, rank, customRankName,
        avatarFrame, profileBorder, profileEffect, profileMusic, chatBackground,
        effects, usernameStyle, chatTextStyle, globalTags, likesCount, likedBy, wallet,
        dailyMessagesDate, dailyMessagesCount, claimedDailyMilestones, lastDailyClaim,
        lastActive, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, cleanUsername, cleanUsername, passwordHash, email || `${usernameLower}@chatlaxy.internal`,
        gender || '', age || '', null, null, initialBio, 'Exploring Chatlaxy', initialRank, null,
        null, null, null, null, null, initialEffects, null, null, '[]', 0, '[]', initialWallet,
        todayKey, 0, '[]', 0, now, now, now
      ]
    );

    const token = await generateToken(cleanUsername);
    const created = await getOne('SELECT * FROM users WHERE id = ?', [userId]);
    return res.status(201).json({ token, user: formatUser(created) });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: err.message || 'Server signup failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username/email and password are required' });
    }

    const cleanId = identifier.trim().toLowerCase();
    const userRow = await getOne(
      'SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?',
      [cleanId, cleanId]
    );

    if (!userRow) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const match = await bcrypt.compare(password, userRow.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    await execute('UPDATE users SET lastActive = ?, updatedAt = ? WHERE id = ?', [Date.now(), Date.now(), userRow.id]);

    const token = await generateToken(userRow.username);
    const freshUser = await getOne('SELECT * FROM users WHERE id = ?', [userRow.id]);
    return res.json({ token, user: formatUser(freshUser) });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: err.message || 'Server login failed' });
  }
});

app.get('/api/auth/me', verifyAuth, async (req, res) => {
  try {
    const userRow = await getOne('SELECT * FROM users WHERE LOWER(username) = ?', [req.username]);
    if (!userRow) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ user: formatUser(userRow) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : req.query.token;
  if (token) {
    tokenCache.delete(token);
    await execute('DELETE FROM sessions WHERE token = ?', [token]).catch(() => {});
  }
  return res.json({ success: true });
});

// ----------------------------------------------------
// 2. USERS & PROFILES ENDPOINTS
// ----------------------------------------------------

app.get('/api/users/:username', async (req, res) => {
  try {
    const username = req.params.username.toLowerCase().trim();
    const userRow = await getOne('SELECT * FROM users WHERE LOWER(username) = ?', [username]);
    if (!userRow) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json(formatUser(userRow));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:username', verifyAuth, async (req, res) => {
  try {
    const targetUsername = req.params.username.toLowerCase().trim();
    const requestingUser = req.username;

    // Authorization: User can edit own profile or if DEV/Admin
    if (requestingUser !== targetUsername) {
      const requesterRow = await getOne('SELECT rank FROM users WHERE LOWER(username) = ?', [requestingUser]);
      const requesterRank = requesterRow?.rank?.toUpperCase();
      if (requesterRank !== 'DEV' && requesterRank !== 'FOUNDER' && requesterRank !== 'CO-FOUNDER') {
        return res.status(403).json({ error: 'Forbidden: You cannot modify another user\'s profile' });
      }
    }

    const existing = await getOne('SELECT * FROM users WHERE LOWER(username) = ?', [targetUsername]);
    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updates = req.body;
    const now = Date.now();

    await execute(
      `UPDATE users SET
        displayName = COALESCE(?, displayName),
        email = COALESCE(?, email),
        gender = COALESCE(?, gender),
        age = COALESCE(?, age),
        profilePicture = ?,
        banner = ?,
        bioSegments = COALESCE(?, bioSegments),
        mood = COALESCE(?, mood),
        rank = COALESCE(?, rank),
        customRankName = ?,
        avatarFrame = ?,
        profileBorder = ?,
        profileEffect = ?,
        profileMusic = ?,
        chatBackground = ?,
        effects = COALESCE(?, effects),
        usernameStyle = ?,
        chatTextStyle = ?,
        globalTags = COALESCE(?, globalTags),
        likesCount = COALESCE(?, likesCount),
        likedBy = COALESCE(?, likedBy),
        wallet = COALESCE(?, wallet),
        dailyMessagesDate = COALESCE(?, dailyMessagesDate),
        dailyMessagesCount = COALESCE(?, dailyMessagesCount),
        claimedDailyMilestones = COALESCE(?, claimedDailyMilestones),
        lastDailyClaim = COALESCE(?, lastDailyClaim),
        lastActive = ?,
        updatedAt = ?
      WHERE LOWER(username) = ?`,
      [
        updates.displayName ?? null,
        updates.email ?? null,
        updates.gender ?? null,
        updates.age ?? null,
        updates.profilePicture !== undefined ? updates.profilePicture : existing.profilePicture,
        updates.banner !== undefined ? updates.banner : existing.banner,
        updates.bioSegments ? JSON.stringify(updates.bioSegments) : null,
        updates.mood ?? null,
        updates.rank ?? null,
        updates.customRankName !== undefined ? updates.customRankName : existing.customRankName,
        updates.avatarFrame !== undefined ? updates.avatarFrame : existing.avatarFrame,
        updates.profileBorder !== undefined ? updates.profileBorder : existing.profileBorder,
        updates.profileEffect !== undefined ? updates.profileEffect : existing.profileEffect,
        updates.profileMusic !== undefined ? updates.profileMusic : existing.profileMusic,
        updates.chatBackground !== undefined ? updates.chatBackground : existing.chatBackground,
        updates.effects ? JSON.stringify(updates.effects) : null,
        updates.usernameStyle !== undefined ? (updates.usernameStyle ? JSON.stringify(updates.usernameStyle) : null) : existing.usernameStyle,
        updates.chatTextStyle !== undefined ? (updates.chatTextStyle ? JSON.stringify(updates.chatTextStyle) : null) : existing.chatTextStyle,
        updates.globalTags ? JSON.stringify(updates.globalTags) : null,
        updates.likesCount ?? null,
        updates.likedBy ? JSON.stringify(updates.likedBy) : null,
        updates.wallet ? JSON.stringify(updates.wallet) : null,
        updates.dailyMessagesDate ?? null,
        updates.dailyMessagesCount ?? null,
        updates.claimedDailyMilestones ? JSON.stringify(updates.claimedDailyMilestones) : null,
        updates.lastDailyClaim ?? null,
        now,
        now,
        targetUsername
      ]
    );

    const updated = await getOne('SELECT * FROM users WHERE LOWER(username) = ?', [targetUsername]);
    const formattedUser = formatUser(updated);

    broadcast({
      type: 'user_updated',
      user: formattedUser,
    });

    return res.json(formattedUser);
  } catch (err) {
    console.error('Update user error:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const limitNum = Math.min(Number(req.query.limit) || 30, 100);
    const rows = await query('SELECT * FROM users ORDER BY updatedAt DESC LIMIT ?', [limitNum]);
    return res.json(rows.map(formatUser));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:username', verifyAuth, async (req, res) => {
  try {
    const targetUsername = req.params.username.toLowerCase().trim();
    await execute('DELETE FROM users WHERE LOWER(username) = ?', [targetUsername]);
    broadcast({
      type: 'user_deleted',
      username: targetUsername,
    });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 3. MESSAGES & REALTIME CHAT ENDPOINTS
// ----------------------------------------------------

function formatMessage(row) {
  if (!row) return null;
  const now = new Date(Number(row.timestamp));
  return {
    id: row.id,
    serverId: row.serverId || null,
    channelId: row.channelId || null,
    senderId: row.senderName === 'Chatlaxy' ? 'system' : 'user',
    senderName: row.senderName,
    senderHandle: `@${row.senderName.toLowerCase().replace(/\s+/g, '')}`,
    content: row.content,
    timestamp: Number(row.timestamp),
    formattedTime: now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    senderAvatar: row.senderAvatar || null,
    senderAvatarFrame: row.senderAvatarFrame || null,
    senderRank: row.senderRank || 'VIP',
    senderCustomRankName: row.senderCustomRankName || null,
    senderUsernameStyle: row.senderUsernameStyle ? (typeof row.senderUsernameStyle === 'string' ? JSON.parse(row.senderUsernameStyle) : row.senderUsernameStyle) : null,
    isSystemBot: Boolean(row.isSystemBot),
    replyTo: row.replyTo ? (typeof row.replyTo === 'string' ? JSON.parse(row.replyTo) : row.replyTo) : null,
    attachments: row.attachments ? (typeof row.attachments === 'string' ? JSON.parse(row.attachments) : row.attachments) : null,
    mediaUrl: row.mediaUrl || null,
    mediaType: row.mediaType || null,
    gamblePayload: row.gamblePayload ? (typeof row.gamblePayload === 'string' ? JSON.parse(row.gamblePayload) : row.gamblePayload) : null,
  };
}

app.get('/api/messages', async (req, res) => {
  try {
    const { before } = req.query;
    const limitNum = Math.min(Number(req.query.limit) || 50, 100);

    let sql = 'SELECT * FROM messages ';
    const params = [];

    if (before) {
      sql += 'WHERE timestamp < ? ';
      params.push(Number(before));
    }

    sql += 'ORDER BY timestamp DESC LIMIT ?';
    params.push(limitNum);

    const rows = await query(sql, params);
    const messages = rows.map(formatMessage).sort((a, b) => a.timestamp - b.timestamp);
    return res.json(messages);
  } catch (err) {
    console.error('Fetch messages error in server.js:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/messages', optionalAuth, async (req, res) => {
  try {
    const msg = req.body;
    if (!msg || (!msg.content && !msg.mediaUrl) || !msg.senderName) {
      return res.status(400).json({ error: 'Message content or media and senderName are required' });
    }

    const id = msg.id || `msg-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const timestamp = msg.timestamp || Date.now();

    await execute(
      `INSERT INTO messages (
        id, senderName, content, timestamp,
        senderAvatar, senderAvatarFrame, senderRank, senderCustomRankName,
        senderUsernameStyle, isSystemBot, replyTo, attachments, mediaUrl, mediaType, gamblePayload, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        msg.senderName,
        msg.content || '',
        timestamp,
        msg.senderAvatar || null,
        msg.senderAvatarFrame || null,
        msg.senderRank || 'VIP',
        msg.senderCustomRankName || null,
        msg.senderUsernameStyle ? JSON.stringify(msg.senderUsernameStyle) : null,
        msg.isSystemBot ? 1 : 0,
        msg.replyTo ? JSON.stringify(msg.replyTo) : null,
        msg.attachments ? JSON.stringify(msg.attachments) : null,
        msg.mediaUrl || null,
        msg.mediaType || null,
        msg.gamblePayload ? JSON.stringify(msg.gamblePayload) : null,
        Date.now(),
      ]
    );

    const formatted = formatMessage({
      id,
      senderName: msg.senderName,
      content: msg.content || '',
      timestamp,
      senderAvatar: msg.senderAvatar,
      senderAvatarFrame: msg.senderAvatarFrame,
      senderRank: msg.senderRank,
      senderCustomRankName: msg.senderCustomRankName,
      senderUsernameStyle: msg.senderUsernameStyle ? JSON.stringify(msg.senderUsernameStyle) : null,
      isSystemBot: msg.isSystemBot ? 1 : 0,
      replyTo: msg.replyTo ? JSON.stringify(msg.replyTo) : null,
      attachments: msg.attachments ? JSON.stringify(msg.attachments) : null,
      mediaUrl: msg.mediaUrl || null,
      mediaType: msg.mediaType || null,
      gamblePayload: msg.gamblePayload ? JSON.stringify(msg.gamblePayload) : null,
    });

    broadcast({
      type: 'chat_message',
      message: formatted,
    });

    return res.status(201).json(formatted);
  } catch (err) {
    console.error('Send message error:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/messages/:id', verifyAuth, async (req, res) => {
  try {
    const id = req.params.id;
    await execute('DELETE FROM messages WHERE id = ?', [id]);

    broadcast({
      type: 'message_deleted',
      id,
    });

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/messages', verifyAuth, async (req, res) => {
  try {
    await execute('DELETE FROM messages');

    broadcast({
      type: 'messages_cleared',
    });

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 4. DAILY REWARDS & LEADERBOARD
// ----------------------------------------------------

app.post('/api/rewards/message-sent', verifyAuth, async (req, res) => {
  try {
    const username = req.username;
    const todayKey = new Date().toISOString().slice(0, 10);
    const userRow = await getOne('SELECT * FROM users WHERE LOWER(username) = ?', [username]);

    if (!userRow) return res.status(404).json({ error: 'User not found' });

    let currentCount = 1;
    if (userRow.dailyMessagesDate === todayKey) {
      currentCount = (Number(userRow.dailyMessagesCount) || 0) + 1;
      await execute(
        'UPDATE users SET dailyMessagesCount = ?, updatedAt = ? WHERE id = ?',
        [currentCount, Date.now(), userRow.id]
      );
    } else {
      currentCount = 1;
      await execute(
        "UPDATE users SET dailyMessagesCount = 1, dailyMessagesDate = ?, claimedDailyMilestones = '[]', updatedAt = ? WHERE id = ?",
        [todayKey, Date.now(), userRow.id]
      );
    }

    return res.json({ count: currentCount, date: todayKey });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/rewards/claim', verifyAuth, async (req, res) => {
  try {
    const username = req.username;
    const { milestoneCount, gold, rubies } = req.body;
    const userRow = await getOne('SELECT * FROM users WHERE LOWER(username) = ?', [username]);

    if (!userRow) return res.status(404).json({ error: 'User not found' });

    const claimed = userRow.claimedDailyMilestones ? JSON.parse(userRow.claimedDailyMilestones) : [];
    if (claimed.includes(milestoneCount)) {
      return res.status(400).json({ error: 'Milestone already claimed' });
    }

    const currentWallet = userRow.wallet ? JSON.parse(userRow.wallet) : { ruby: 5, gold: 1000 };
    const updatedWallet = {
      gold: (currentWallet.gold || 0) + (Number(gold) || 0),
      ruby: (currentWallet.ruby || 0) + (Number(rubies) || 0),
    };
    const updatedClaimed = [...claimed, milestoneCount];

    await execute(
      'UPDATE users SET wallet = ?, claimedDailyMilestones = ?, lastDailyClaim = ?, updatedAt = ? WHERE id = ?',
      [JSON.stringify(updatedWallet), JSON.stringify(updatedClaimed), Date.now(), Date.now(), userRow.id]
    );

    const fresh = await getOne('SELECT * FROM users WHERE id = ?', [userRow.id]);
    return res.json(formatUser(fresh));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/rewards/leaderboard', async (req, res) => {
  try {
    const todayKey = new Date().toISOString().slice(0, 10);
    const rows = await query(
      'SELECT * FROM users WHERE dailyMessagesDate = ? AND dailyMessagesCount > 0 ORDER BY dailyMessagesCount DESC LIMIT 10',
      [todayKey]
    );
    return res.json(rows.map(formatUser));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 5. SERVERS, CHANNELS, ROLES & MEMBERS
// ----------------------------------------------------

app.get('/api/servers', optionalAuth, async (req, res) => {
  try {
    const servers = await query('SELECT * FROM servers ORDER BY createdAt ASC');
    const onlineUsernames = new Set(
      Array.from(clients.values()).map((c) => (c.username || '').toLowerCase()).filter(Boolean)
    );

    const enriched = await Promise.all(
      servers.map(async (srv) => {
        const members = await query('SELECT username, roles FROM members WHERE serverId = ?', [srv.id]);
        const channels = await query('SELECT id, name, position FROM channels WHERE serverId = ? ORDER BY position ASC, name ASC', [srv.id]);
        const roles = await query('SELECT id, name, colour, position, permissions FROM roles WHERE serverId = ? ORDER BY position ASC', [srv.id]);

        const memberUsernames = members.map((m) => (m.username || '').toLowerCase());
        const activeCount = memberUsernames.filter((u) => onlineUsernames.has(u)).length;
        const isJoined = req.username ? memberUsernames.includes(req.username.toLowerCase()) : false;

        return {
          ...srv,
          memberCount: members.length,
          activeCount: Math.max(activeCount, srv.owner && onlineUsernames.has(srv.owner.toLowerCase()) ? 1 : 0),
          channelCount: channels.length,
          channels,
          roles: roles.map((r) => ({
            ...r,
            permissions: r.permissions ? JSON.parse(r.permissions) : [],
          })),
          isJoined,
        };
      })
    );

    return res.json(enriched);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/servers/:id', optionalAuth, async (req, res) => {
  try {
    const serverRow = await getOne('SELECT * FROM servers WHERE id = ?', [req.params.id]);
    if (!serverRow) return res.status(404).json({ error: 'Server not found' });
    const channels = await query('SELECT * FROM channels WHERE serverId = ? ORDER BY position ASC, name ASC', [req.params.id]);
    const roles = await query('SELECT * FROM roles WHERE serverId = ? ORDER BY position ASC', [req.params.id]);
    const members = await query('SELECT * FROM members WHERE serverId = ?', [req.params.id]);
    const onlineUsernames = new Set(
      Array.from(clients.values()).map((c) => (c.username || '').toLowerCase()).filter(Boolean)
    );

    const memberUsernames = members.map((m) => (m.username || '').toLowerCase());
    const activeCount = memberUsernames.filter((u) => onlineUsernames.has(u)).length;

    return res.json({
      ...serverRow,
      memberCount: members.length,
      activeCount: Math.max(activeCount, serverRow.owner && onlineUsernames.has(serverRow.owner.toLowerCase()) ? 1 : 0),
      channelCount: channels.length,
      channels,
      roles: roles.map(r => ({ ...r, permissions: r.permissions ? JSON.parse(r.permissions) : [] })),
      members: members.map(m => ({ ...m, roles: m.roles ? JSON.parse(m.roles) : [] })),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/servers/:id', verifyAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const serverRow = await getOne('SELECT * FROM servers WHERE id = ?', [serverId]);
    if (!serverRow) return res.status(404).json({ error: 'Server not found' });

    // Verify owner or admin
    if (serverRow.owner.toLowerCase() !== req.username.toLowerCase()) {
      return res.status(403).json({ error: 'Only server owner can edit server settings' });
    }

    const { name, iconUrl, bannerUrl, description } = req.body;
    await execute(
      `UPDATE servers SET
        name = COALESCE(?, name),
        iconUrl = ?,
        bannerUrl = ?,
        description = COALESCE(?, description)
      WHERE id = ?`,
      [
        name ?? null,
        iconUrl !== undefined ? iconUrl : serverRow.iconUrl,
        bannerUrl !== undefined ? bannerUrl : serverRow.bannerUrl,
        description ?? null,
        serverId,
      ]
    );

    const updated = await getOne('SELECT * FROM servers WHERE id = ?', [serverId]);
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/servers/:id', verifyAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const serverRow = await getOne('SELECT * FROM servers WHERE id = ?', [serverId]);
    if (!serverRow) return res.status(404).json({ error: 'Server not found' });

    if (serverRow.owner.toLowerCase() !== req.username.toLowerCase()) {
      return res.status(403).json({ error: 'Only the server owner can delete this server' });
    }

    await execute('DELETE FROM servers WHERE id = ?', [serverId]);
    await execute('DELETE FROM channels WHERE serverId = ?', [serverId]);
    await execute('DELETE FROM roles WHERE serverId = ?', [serverId]);
    await execute('DELETE FROM members WHERE serverId = ?', [serverId]);
    await execute('DELETE FROM messages WHERE serverId = ?', [serverId]);

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/servers/:id/channels/:channelId', verifyAuth, async (req, res) => {
  try {
    const { id: serverId, channelId } = req.params;
    await execute('DELETE FROM channels WHERE serverId = ? AND id = ?', [serverId, channelId]);
    await execute('DELETE FROM messages WHERE serverId = ? AND channelId = ?', [serverId, channelId]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/servers/:id/members/:username', verifyAuth, async (req, res) => {
  try {
    const { id: serverId, username: targetUser } = req.params;
    await execute('DELETE FROM members WHERE serverId = ? AND LOWER(username) = ?', [serverId, targetUser.toLowerCase()]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/servers', verifyAuth, async (req, res) => {
  try {
    const { name, iconUrl, bannerUrl, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Server name is required' });

    const serverId = `server-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const owner = req.username;
    const now = Date.now();

    await execute(
      'INSERT INTO servers (id, name, owner, iconUrl, bannerUrl, description, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [serverId, name, owner, iconUrl || null, bannerUrl || null, description || '', now]
    );

    // Add owner as member
    await execute(
      'INSERT INTO members (serverId, username, roles, joinedAt) VALUES (?, ?, ?, ?)',
      [serverId, owner, JSON.stringify(['Owner']), now]
    );

    // Create default channel #general
    const channelId = `ch-${Date.now()}-general`;
    await execute(
      'INSERT INTO channels (id, serverId, name, position, createdAt) VALUES (?, ?, ?, ?, ?)',
      [channelId, serverId, 'general', 0, now]
    );

    const created = await getOne('SELECT * FROM servers WHERE id = ?', [serverId]);
    return res.status(201).json(created);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/servers/:id/join', verifyAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const username = req.username;
    await execute(
      'INSERT OR IGNORE INTO members (serverId, username, roles, joinedAt) VALUES (?, ?, ?, ?)',
      [serverId, username, JSON.stringify(['Member']), Date.now()]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/servers/:id/leave', verifyAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const username = req.username;
    await execute('DELETE FROM members WHERE serverId = ? AND LOWER(username) = ?', [serverId, username.toLowerCase()]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/servers/:id/members', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM members WHERE serverId = ?', [req.params.id]);
    return res.json(rows.map((r) => ({
      serverId: r.serverId,
      username: r.username,
      roles: r.roles ? JSON.parse(r.roles) : [],
      joinedAt: Number(r.joinedAt),
    })));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/servers/:id/members/:username/roles', verifyAuth, async (req, res) => {
  try {
    const { roles } = req.body;
    await execute(
      'UPDATE members SET roles = ? WHERE serverId = ? AND LOWER(username) = ?',
      [JSON.stringify(roles || []), req.params.id, req.params.username.toLowerCase()]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/servers/:id/channels', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM channels WHERE serverId = ? ORDER BY position ASC, name ASC', [req.params.id]);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/servers/:id/channels', verifyAuth, async (req, res) => {
  try {
    const { name, position } = req.body;
    const cleanName = (name || 'channel').toLowerCase().replace(/\s+/g, '-');
    const channelId = `ch-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    await execute(
      'INSERT INTO channels (id, serverId, name, position, createdAt) VALUES (?, ?, ?, ?, ?)',
      [channelId, req.params.id, cleanName, position || 0, Date.now()]
    );
    const created = await getOne('SELECT * FROM channels WHERE id = ?', [channelId]);
    return res.status(201).json(created);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/servers/:id/roles', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM roles WHERE serverId = ? ORDER BY position ASC', [req.params.id]);
    return res.json(rows.map((r) => ({
      id: r.id,
      serverId: r.serverId,
      name: r.name,
      colour: r.colour,
      position: Number(r.position),
      permissions: r.permissions ? JSON.parse(r.permissions) : [],
    })));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/servers/:id/roles', verifyAuth, async (req, res) => {
  try {
    const { name, colour, permissions, position } = req.body;
    const roleId = `role-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    await execute(
      'INSERT INTO roles (id, serverId, name, colour, position, permissions, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [roleId, req.params.id, name || 'new-role', colour || '#99aab5', position || 0, JSON.stringify(permissions || []), Date.now()]
    );
    const created = await getOne('SELECT * FROM roles WHERE id = ?', [roleId]);
    return res.status(201).json({
      ...created,
      permissions: created.permissions ? JSON.parse(created.permissions) : [],
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/servers/:id/roles/:roleId', verifyAuth, async (req, res) => {
  try {
    await execute('DELETE FROM roles WHERE serverId = ? AND id = ?', [req.params.id, req.params.roleId]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 6. NEWS ANNOUNCEMENTS
// ----------------------------------------------------

function formatNews(row) {
  if (!row) return null;
  return {
    id: row.id,
    author: row.author,
    authorAvatar: row.authorAvatar || null,
    authorRank: row.authorRank || 'VIP',
    authorCustomRank: row.authorCustomRank || null,
    content: row.content,
    timestamp: Number(row.timestamp),
    mediaUrl: row.mediaUrl || null,
    mediaType: row.mediaType || null,
    reactions: row.reactions ? JSON.parse(row.reactions) : {},
  };
}

app.get('/api/news', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM news ORDER BY timestamp DESC LIMIT 30');
    return res.json(rows.map(formatNews));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/news', verifyAuth, async (req, res) => {
  try {
    const post = req.body;
    const id = post.id || `news-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const timestamp = post.timestamp || Date.now();

    await execute(
      `INSERT INTO news (id, author, authorAvatar, authorRank, authorCustomRank, content, timestamp, mediaUrl, mediaType, reactions, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        post.author || req.username,
        post.authorAvatar || null,
        post.authorRank || 'VIP',
        post.authorCustomRank || null,
        post.content,
        timestamp,
        post.mediaUrl || null,
        post.mediaType || null,
        JSON.stringify(post.reactions || {}),
        Date.now(),
      ]
    );

    const created = formatNews(await getOne('SELECT * FROM news WHERE id = ?', [id]));
    broadcast({ type: 'news_created', post: created });
    return res.status(201).json(created);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/news/:id', verifyAuth, async (req, res) => {
  try {
    const post = req.body;
    await execute(
      `UPDATE news SET content = COALESCE(?, content), mediaUrl = ?, mediaType = ?, reactions = COALESCE(?, reactions) WHERE id = ?`,
      [
        post.content ?? null,
        post.mediaUrl !== undefined ? post.mediaUrl : null,
        post.mediaType !== undefined ? post.mediaType : null,
        post.reactions ? JSON.stringify(post.reactions) : null,
        req.params.id,
      ]
    );

    const updated = formatNews(await getOne('SELECT * FROM news WHERE id = ?', [req.params.id]));
    broadcast({ type: 'news_updated', post: updated });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/news/:id', verifyAuth, async (req, res) => {
  try {
    await execute('DELETE FROM news WHERE id = ?', [req.params.id]);
    broadcast({ type: 'news_deleted', id: req.params.id });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 7. NOTIFICATIONS
// ----------------------------------------------------

function formatNotif(row) {
  if (!row) return null;
  return {
    id: row.id,
    recipientUsername: row.recipientUsername,
    senderUsername: row.senderUsername,
    senderAvatar: row.senderAvatar || null,
    senderAvatarFrame: row.senderAvatarFrame || null,
    senderUsernameStyle: row.senderUsernameStyle ? JSON.parse(row.senderUsernameStyle) : null,
    type: row.type,
    text: row.text,
    timestamp: Number(row.timestamp),
    read: Boolean(row.read),
  };
}

app.get('/api/notifications', verifyAuth, async (req, res) => {
  try {
    const user = req.username.toLowerCase();
    const rows = await query(
      'SELECT * FROM notifications WHERE LOWER(recipientUsername) = ? OR recipientUsername = "all" ORDER BY timestamp DESC LIMIT 30',
      [user]
    );
    return res.json(rows.map(formatNotif));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/notifications', verifyAuth, async (req, res) => {
  try {
    const notif = req.body;
    const id = notif.id || `notif-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const timestamp = notif.timestamp || Date.now();

    await execute(
      `INSERT INTO notifications (id, recipientUsername, senderUsername, senderAvatar, senderAvatarFrame, senderUsernameStyle, type, text, timestamp, read)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        notif.recipientUsername,
        notif.senderUsername || req.username,
        notif.senderAvatar || null,
        notif.senderAvatarFrame || null,
        notif.senderUsernameStyle ? JSON.stringify(notif.senderUsernameStyle) : null,
        notif.type || 'info',
        notif.text || '',
        timestamp,
        notif.read ? 1 : 0,
      ]
    );

    const created = formatNotif(await getOne('SELECT * FROM notifications WHERE id = ?', [id]));
    broadcast({ type: 'notification', notification: created });
    return res.status(201).json(created);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/notifications/:id', verifyAuth, async (req, res) => {
  try {
    await execute('DELETE FROM notifications WHERE id = ?', [req.params.id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/notifications', verifyAuth, async (req, res) => {
  try {
    const user = req.username.toLowerCase();
    await execute('DELETE FROM notifications WHERE LOWER(recipientUsername) = ? OR recipientUsername = "all"', [user]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 8. AUDIT LOGS & SYSTEM CONFIG
// ----------------------------------------------------

app.get('/api/audit-logs', verifyAuth, async (req, res) => {
  try {
    const rows = await query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 50');
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/audit-logs', verifyAuth, async (req, res) => {
  try {
    const entry = req.body;
    const id = entry.id || `log-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const timestamp = entry.timestamp || Date.now();
    await execute(
      'INSERT INTO audit_logs (id, timestamp, formattedTime, actor, action, details, category) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, timestamp, entry.formattedTime || new Date(timestamp).toLocaleTimeString(), entry.actor || req.username, entry.action, entry.details || '', entry.category || 'admin']
    );
    return res.status(201).json({ success: true, id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/audit-logs', verifyAuth, async (req, res) => {
  try {
    await execute('DELETE FROM audit_logs');
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/system/rigged-users', async (req, res) => {
  try {
    const row = await getOne('SELECT value FROM system_config WHERE key = "rigged_users"');
    const users = row && row.value ? JSON.parse(row.value) : [];
    return res.json(users);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/system/rigged-users', verifyAuth, async (req, res) => {
  try {
    const { username, rigged } = req.body;
    const cleanName = username.trim().toLowerCase();
    const row = await getOne('SELECT value FROM system_config WHERE key = "rigged_users"');
    const current = row && row.value ? JSON.parse(row.value) : [];
    const filtered = current.filter((u) => u.toLowerCase() !== cleanName);
    if (rigged) filtered.push(cleanName);

    await execute(
      'INSERT INTO system_config (key, value) VALUES ("rigged_users", ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [JSON.stringify(filtered)]
    );

    return res.json(filtered);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// FRONTEND SERVING (Vite in Dev or Dist in Prod)
// ----------------------------------------------------
async function startServer() {
  await initDatabase();

  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      console.log('⚡ Vite development middleware mounted');
    } catch (err) {
      console.warn('Vite middleware could not be mounted (standalone mode):', err.message);
    }
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Chatlaxy backend running on http://localhost:${PORT}`);
    console.log(`💬 WebSocket endpoint ready at ws://localhost:${PORT}/ws`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
