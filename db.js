import pg from 'pg';
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.resolve(__dirname, 'chatlaxy.sqlite');

let isPostgres = false;
let pgPool = null;
let sqliteDb = null;
let saveTimer = null;

export function isUsingPostgres() {
  return isPostgres;
}

export function persistDbNow() {
  if (!isPostgres && sqliteDb) {
    try {
      const data = sqliteDb.export();
      fs.writeFileSync(DB_PATH, Buffer.from(data));
    } catch (err) {
      console.error('Failed to persist SQLite database to disk:', err);
    }
  }
}

function scheduleSqliteSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    persistDbNow();
  }, 50);
}

// Convert ? placeholders to $1, $2, ... for PostgreSQL
function convertPlaceholders(sql) {
  let paramIndex = 1;
  return sql.replace(/\?/g, () => `$${paramIndex++}`);
}

// Translate SQLite idioms (like INSERT OR REPLACE, INSERT OR IGNORE) to Postgres syntax
function adaptSqlForPostgres(sql) {
  let postgresSql = sql;

  // Adapt INSERT OR IGNORE INTO members ...
  if (/INSERT\s+OR\s+IGNORE\s+INTO\s+members/i.test(postgresSql)) {
    postgresSql = postgresSql.replace(/INSERT\s+OR\s+IGNORE\s+INTO\s+members/i, 'INSERT INTO members');
    if (!/ON\s+CONFLICT/i.test(postgresSql)) {
      postgresSql += ' ON CONFLICT (serverId, username) DO NOTHING';
    }
  }

  // Adapt INSERT OR REPLACE INTO sessions ...
  if (/INSERT\s+OR\s+REPLACE\s+INTO\s+sessions/i.test(postgresSql)) {
    postgresSql = postgresSql.replace(/INSERT\s+OR\s+REPLACE\s+INTO\s+sessions/i, 'INSERT INTO sessions');
    if (!/ON\s+CONFLICT/i.test(postgresSql)) {
      postgresSql += ' ON CONFLICT (token) DO UPDATE SET username = EXCLUDED.username, createdAt = EXCLUDED.createdAt, expiresAt = EXCLUDED.expiresAt';
    }
  }

  // Adapt INSERT OR REPLACE INTO users ...
  if (/INSERT\s+OR\s+REPLACE\s+INTO\s+users/i.test(postgresSql)) {
    postgresSql = postgresSql.replace(/INSERT\s+OR\s+REPLACE\s+INTO\s+users/i, 'INSERT INTO users');
    if (!/ON\s+CONFLICT/i.test(postgresSql)) {
      postgresSql += ' ON CONFLICT (id) DO UPDATE SET updatedAt = EXCLUDED.updatedAt';
    }
  }

  return convertPlaceholders(postgresSql);
}

export async function getDatabase() {
  if (isPostgres && pgPool) return pgPool;
  if (!isPostgres && sqliteDb) return sqliteDb;

  const dbUrl = process.env.DATABASE_URL;

  if (dbUrl && dbUrl.trim().length > 0 && !dbUrl.includes('placeholder')) {
    try {
      console.log('🔌 Connecting to hosted PostgreSQL database...');
      pgPool = new Pool({
        connectionString: dbUrl,
        ssl: dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') ? false : { rejectUnauthorized: false },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      // Test connection
      const client = await pgPool.connect();
      await client.query('SELECT 1');
      client.release();

      isPostgres = true;
      console.log('✅ Hosted PostgreSQL database connected successfully!');
      return pgPool;
    } catch (err) {
      console.warn('⚠️ Could not connect to DATABASE_URL, falling back to local SQLite:', err.message);
      isPostgres = false;
    }
  }

  // Fallback to local SQLite
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    try {
      const fileBuffer = fs.readFileSync(DB_PATH);
      sqliteDb = new SQL.Database(fileBuffer);
      console.log('✅ SQLite database loaded from:', DB_PATH);
    } catch (err) {
      console.warn('Could not read existing SQLite database, creating fresh one:', err.message);
      sqliteDb = new SQL.Database();
    }
  } else {
    sqliteDb = new SQL.Database();
    console.log('✅ SQLite fresh database initialized at:', DB_PATH);
  }

  isPostgres = false;
  return sqliteDb;
}

export async function query(sql, params = []) {
  await getDatabase();

  if (isPostgres && pgPool) {
    const adaptedSql = adaptSqlForPostgres(sql);
    const res = await pgPool.query(adaptedSql, params);
    // Normalize column names to lowercase/camelCase if needed
    return res.rows.map((row) => {
      const normalized = {};
      for (const [k, v] of Object.entries(row)) {
        // Postgres returns lowercased keys by default, map common camelCase fields
        const keyMap = {
          displayname: 'displayName',
          passwordhash: 'passwordHash',
          profilepicture: 'profilePicture',
          biosegments: 'bioSegments',
          customrankname: 'customRankName',
          avatarframe: 'avatarFrame',
          profileborder: 'profileBorder',
          profileeffect: 'profileEffect',
          profilemusic: 'profileMusic',
          chatbackground: 'chatBackground',
          usernamestyle: 'usernameStyle',
          chattextstyle: 'chatTextStyle',
          globaltags: 'globalTags',
          likescount: 'likesCount',
          likedby: 'likedBy',
          dailymessagesdate: 'dailyMessagesDate',
          dailymessagescount: 'dailyMessagesCount',
          claimeddailymilestones: 'claimedDailyMilestones',
          lastdailyclaim: 'lastDailyClaim',
          lastactive: 'lastActive',
          createdat: 'createdAt',
          updatedat: 'updatedAt',
          expiresat: 'expiresAt',
          serverid: 'serverId',
          channelid: 'channelId',
          iconurl: 'iconUrl',
          bannerurl: 'bannerUrl',
          joinedat: 'joinedAt',
          sendername: 'senderName',
          senderavatar: 'senderAvatar',
          senderavatarframe: 'senderAvatarFrame',
          senderrank: 'senderRank',
          sendercustomrankname: 'senderCustomRankName',
          senderusernamestyle: 'senderUsernameStyle',
          issystembot: 'isSystemBot',
          replyto: 'replyTo',
          authoravatar: 'authorAvatar',
          authorrank: 'authorRank',
          authorcustomrank: 'authorCustomRank',
          mediaurl: 'mediaUrl',
          mediatype: 'mediaType',
          recipientusername: 'recipientUsername',
          senderusername: 'senderUsername',
          formattedtime: 'formattedTime',
        };
        const mappedKey = keyMap[k.toLowerCase()] || k;
        normalized[mappedKey] = v;
      }
      return normalized;
    });
  }

  // SQLite execution
  const stmt = sqliteDb.prepare(sql);
  if (params && params.length > 0) {
    stmt.bind(params);
  }

  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

export async function getOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function execute(sql, params = []) {
  await getDatabase();

  if (isPostgres && pgPool) {
    const adaptedSql = adaptSqlForPostgres(sql);
    await pgPool.query(adaptedSql, params);
    return { success: true };
  }

  // SQLite execution
  if (params && params.length > 0) {
    sqliteDb.run(sql, params);
  } else {
    sqliteDb.run(sql);
  }
  scheduleSqliteSave();
  return { success: true };
}

export async function initDatabase() {
  await getDatabase();

  if (isPostgres && pgPool) {
    console.log('📦 Running PostgreSQL schema migrations...');

    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        displayName TEXT,
        passwordHash TEXT NOT NULL,
        email TEXT,
        gender TEXT,
        age TEXT,
        profilePicture TEXT,
        banner TEXT,
        bioSegments TEXT,
        mood TEXT,
        rank TEXT,
        customRankName TEXT,
        avatarFrame TEXT,
        profileBorder TEXT,
        profileEffect TEXT,
        profileMusic TEXT,
        chatBackground TEXT,
        effects TEXT,
        usernameStyle TEXT,
        chatTextStyle TEXT,
        globalTags TEXT,
        likesCount BIGINT DEFAULT 0,
        likedBy TEXT,
        wallet TEXT,
        dailyMessagesDate TEXT,
        dailyMessagesCount BIGINT DEFAULT 0,
        claimedDailyMilestones TEXT,
        lastDailyClaim BIGINT DEFAULT 0,
        lastActive BIGINT,
        createdAt BIGINT NOT NULL,
        updatedAt BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        createdAt BIGINT NOT NULL,
        expiresAt BIGINT
      );

      CREATE TABLE IF NOT EXISTS servers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner TEXT NOT NULL,
        iconUrl TEXT,
        bannerUrl TEXT,
        description TEXT,
        createdAt BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS channels (
        id TEXT PRIMARY KEY,
        serverId TEXT NOT NULL,
        name TEXT NOT NULL,
        position INT DEFAULT 0,
        createdAt BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS roles (
        id TEXT PRIMARY KEY,
        serverId TEXT NOT NULL,
        name TEXT NOT NULL,
        colour TEXT DEFAULT '#99aab5',
        position INT DEFAULT 0,
        permissions TEXT,
        createdAt BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS members (
        serverId TEXT NOT NULL,
        username TEXT NOT NULL,
        roles TEXT,
        joinedAt BIGINT NOT NULL,
        PRIMARY KEY (serverId, username)
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        serverId TEXT,
        channelId TEXT,
        senderName TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp BIGINT NOT NULL,
        senderAvatar TEXT,
        senderAvatarFrame TEXT,
        senderRank TEXT,
        senderCustomRankName TEXT,
        senderUsernameStyle TEXT,
        isSystemBot INT DEFAULT 0,
        replyTo TEXT,
        attachments TEXT,
        createdAt BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS news (
        id TEXT PRIMARY KEY,
        author TEXT NOT NULL,
        authorAvatar TEXT,
        authorRank TEXT,
        authorCustomRank TEXT,
        content TEXT NOT NULL,
        timestamp BIGINT NOT NULL,
        mediaUrl TEXT,
        mediaType TEXT,
        reactions TEXT,
        createdAt BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        recipientUsername TEXT NOT NULL,
        senderUsername TEXT NOT NULL,
        senderAvatar TEXT,
        senderAvatarFrame TEXT,
        senderUsernameStyle TEXT,
        type TEXT NOT NULL,
        text TEXT NOT NULL,
        timestamp BIGINT NOT NULL,
        read INT DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        timestamp BIGINT NOT NULL,
        formattedTime TEXT NOT NULL,
        actor TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        category TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS system_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_messages_server_chan ON messages(serverId, channelId, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users(LOWER(username));
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
    `);

    console.log('✅ Hosted PostgreSQL database schema initialized successfully!');
    return;
  }

  // SQLite Schema
  await execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      displayName TEXT,
      passwordHash TEXT NOT NULL,
      email TEXT,
      gender TEXT,
      age TEXT,
      profilePicture TEXT,
      banner TEXT,
      bioSegments TEXT,
      mood TEXT,
      rank TEXT,
      customRankName TEXT,
      avatarFrame TEXT,
      profileBorder TEXT,
      profileEffect TEXT,
      profileMusic TEXT,
      chatBackground TEXT,
      effects TEXT,
      usernameStyle TEXT,
      chatTextStyle TEXT,
      globalTags TEXT,
      likesCount INTEGER DEFAULT 0,
      likedBy TEXT,
      wallet TEXT,
      dailyMessagesDate TEXT,
      dailyMessagesCount INTEGER DEFAULT 0,
      claimedDailyMilestones TEXT,
      lastDailyClaim INTEGER DEFAULT 0,
      lastActive INTEGER,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      expiresAt INTEGER
    );
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner TEXT NOT NULL,
      iconUrl TEXT,
      bannerUrl TEXT,
      description TEXT,
      createdAt INTEGER NOT NULL
    );
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      serverId TEXT NOT NULL,
      name TEXT NOT NULL,
      position INTEGER DEFAULT 0,
      createdAt INTEGER NOT NULL
    );
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      serverId TEXT NOT NULL,
      name TEXT NOT NULL,
      colour TEXT DEFAULT '#99aab5',
      position INTEGER DEFAULT 0,
      permissions TEXT,
      createdAt INTEGER NOT NULL
    );
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS members (
      serverId TEXT NOT NULL,
      username TEXT NOT NULL,
      roles TEXT,
      joinedAt INTEGER NOT NULL,
      PRIMARY KEY (serverId, username)
    );
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      serverId TEXT,
      channelId TEXT,
      senderName TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      senderAvatar TEXT,
      senderAvatarFrame TEXT,
      senderRank TEXT,
      senderCustomRankName TEXT,
      senderUsernameStyle TEXT,
      isSystemBot INTEGER DEFAULT 0,
      replyTo TEXT,
      attachments TEXT,
      createdAt INTEGER NOT NULL
    );
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS news (
      id TEXT PRIMARY KEY,
      author TEXT NOT NULL,
      authorAvatar TEXT,
      authorRank TEXT,
      authorCustomRank TEXT,
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      mediaUrl TEXT,
      mediaType TEXT,
      reactions TEXT,
      createdAt INTEGER NOT NULL
    );
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      recipientUsername TEXT NOT NULL,
      senderUsername TEXT NOT NULL,
      senderAvatar TEXT,
      senderAvatarFrame TEXT,
      senderUsernameStyle TEXT,
      type TEXT NOT NULL,
      text TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      read INTEGER DEFAULT 0
    );
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      formattedTime TEXT NOT NULL,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      category TEXT NOT NULL
    );
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS system_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  persistDbNow();
  console.log('✅ SQLite schema initialized successfully.');
}
