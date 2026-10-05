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
          isedited: 'isEdited',
          ispinned: 'isPinned',
          polldata: 'pollData',
          customstatus: 'customStatus',
          statusemoji: 'statusEmoji',
          blockedusers: 'blockedUsers',
          mutedusers: 'mutedUsers',
          sociallinks: 'socialLinks',
          profilevisitors: 'profileVisitors',
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
  // Instantly persist database on every write
  persistDbNow();
  return { success: true };
}

// Helper to ensure SQLite table has all needed columns
function ensureSqliteColumns(tableName, expectedCols) {
  if (isPostgres || !sqliteDb) return;
  try {
    const res = sqliteDb.exec(`PRAGMA table_info(${tableName});`);
    if (!res || res.length === 0) return;
    const existing = new Set(res[0].values.map((row) => row[1].toLowerCase()));

    for (const [colName, colType] of Object.entries(expectedCols)) {
      if (!existing.has(colName.toLowerCase())) {
        try {
          sqliteDb.run(`ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colType};`);
          console.log(`✨ Added missing column ${colName} (${colType}) to ${tableName}`);
        } catch (colErr) {
          console.warn(`Could not add column ${colName} to ${tableName}:`, colErr.message);
        }
      }
    }
  } catch (err) {
    console.warn(`Pragma check error on ${tableName}:`, err.message);
  }
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

      -- Postgres Column Migrations (in case table was created with earlier schema)
      ALTER TABLE users ADD COLUMN IF NOT EXISTS displayName TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS globalTags TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS usernameStyle TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS chatTextStyle TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS customRankName TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatarFrame TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS profileBorder TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS profileEffect TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS profileMusic TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS chatBackground TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS likesCount BIGINT DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS likedBy TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS dailyMessagesDate TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS dailyMessagesCount BIGINT DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS claimedDailyMilestones TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS lastDailyClaim BIGINT DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'online';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS customStatus TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS statusEmoji TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS xp BIGINT DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS level INT DEFAULT 1;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS streak INT DEFAULT 1;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS blockedUsers TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS mutedUsers TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS following TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS followers TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS bookmarks TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS socialLinks TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS profileVisitors BIGINT DEFAULT 0;

      ALTER TABLE messages ADD COLUMN IF NOT EXISTS isEdited INT DEFAULT 0;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS isPinned INT DEFAULT 0;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS reactions TEXT;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS pollData TEXT;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS codeLanguage TEXT;

      ALTER TABLE servers ADD COLUMN IF NOT EXISTS iconUrl TEXT;
      ALTER TABLE servers ADD COLUMN IF NOT EXISTS bannerUrl TEXT;
      ALTER TABLE servers ADD COLUMN IF NOT EXISTS description TEXT;

      CREATE INDEX IF NOT EXISTS idx_messages_server_chan ON messages(serverId, channelId, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users(LOWER(username));
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
    `);

    console.log('✅ Hosted PostgreSQL database schema initialized successfully!');
    return;
  }

  // SQLite Schema Creation
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

  // Ensure all columns exist in existing SQLite tables
  ensureSqliteColumns('users', {
    displayName: 'TEXT',
    globalTags: 'TEXT',
    usernameStyle: 'TEXT',
    chatTextStyle: 'TEXT',
    customRankName: 'TEXT',
    avatarFrame: 'TEXT',
    profileBorder: 'TEXT',
    profileEffect: 'TEXT',
    profileMusic: 'TEXT',
    chatBackground: 'TEXT',
    effects: 'TEXT',
    likesCount: 'INTEGER DEFAULT 0',
    likedBy: 'TEXT',
    wallet: 'TEXT',
    dailyMessagesDate: 'TEXT',
    dailyMessagesCount: 'INTEGER DEFAULT 0',
    claimedDailyMilestones: 'TEXT',
    lastDailyClaim: 'INTEGER DEFAULT 0',
    status: 'TEXT DEFAULT "online"',
    customStatus: 'TEXT',
    statusEmoji: 'TEXT',
    xp: 'INTEGER DEFAULT 0',
    level: 'INTEGER DEFAULT 1',
    streak: 'INTEGER DEFAULT 1',
    blockedUsers: 'TEXT',
    mutedUsers: 'TEXT',
    following: 'TEXT',
    followers: 'TEXT',
    bookmarks: 'TEXT',
    socialLinks: 'TEXT',
    profileVisitors: 'INTEGER DEFAULT 0',
  });

  ensureSqliteColumns('messages', {
    serverId: 'TEXT',
    channelId: 'TEXT',
    senderAvatar: 'TEXT',
    senderAvatarFrame: 'TEXT',
    senderRank: 'TEXT',
    senderCustomRankName: 'TEXT',
    senderUsernameStyle: 'TEXT',
    isSystemBot: 'INTEGER DEFAULT 0',
    replyTo: 'TEXT',
    attachments: 'TEXT',
    mediaUrl: 'TEXT',
    mediaType: 'TEXT',
    gamblePayload: 'TEXT',
    isEdited: 'INTEGER DEFAULT 0',
    isPinned: 'INTEGER DEFAULT 0',
    reactions: 'TEXT',
    pollData: 'TEXT',
    codeLanguage: 'TEXT',
  });

  ensureSqliteColumns('servers', {
    iconUrl: 'TEXT',
    bannerUrl: 'TEXT',
    description: 'TEXT',
  });

  persistDbNow();
  console.log('✅ SQLite schema and column migrations completed successfully.');
}
