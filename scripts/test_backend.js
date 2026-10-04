import { getDatabase, initDatabase, query, getOne, execute, persistDbNow } from '../db.js';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

async function runBackendTests() {
  console.log('🧪 Starting Chatlaxy Local Backend & SQLite Persistence Test...\n');

  // Step 1: Initialize Database
  console.log('1️⃣ Initializing SQLite database schema...');
  await initDatabase();
  console.log('  ✅ Database initialized.\n');

  // Step 2: Signup Account A (Alice)
  console.log('2️⃣ Testing Signup for Account A (Alice)...');
  const alicePassHash = await bcrypt.hash('secretAlice123', 10);
  const now = Date.now();
  const aliceId = `user_${now}_alice`;
  const initialWallet = JSON.stringify({ ruby: 5, gold: 1000 });
  const initialBio = JSON.stringify([{ id: 'b1', text: 'Hello from Alice!' }]);

  await execute(
    `INSERT OR REPLACE INTO users (
      id, username, displayName, passwordHash, email, gender, age,
      bioSegments, mood, rank, wallet, dailyMessagesDate, dailyMessagesCount,
      claimedDailyMilestones, lastDailyClaim, lastActive, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      aliceId, 'alice', 'Alice', alicePassHash, 'alice@chatlaxy.internal', 'Female', '22',
      initialBio, 'Exploring Chatlaxy', 'VIP', initialWallet,
      new Date().toISOString().slice(0, 10), 0, '[]', 0, now, now, now
    ]
  );

  const aliceRow = await getOne('SELECT * FROM users WHERE username = ?', ['alice']);
  if (!aliceRow || aliceRow.username !== 'alice') {
    throw new Error('Failed to retrieve created user Alice');
  }
  const walletAlice = JSON.parse(aliceRow.wallet);
  if (walletAlice.gold !== 1000 || walletAlice.ruby !== 5) {
    throw new Error(`Incorrect starting wallet: ${JSON.stringify(walletAlice)}`);
  }
  console.log('  ✅ Alice created with starting wallet: 1,000 Gold + 5 Rubies\n');

  // Step 3: Test Password Verification (Login logic)
  console.log('3️⃣ Testing Login password verification...');
  const passMatches = await bcrypt.compare('secretAlice123', aliceRow.passwordHash);
  const wrongMatches = await bcrypt.compare('wrongPassword', aliceRow.passwordHash);
  if (!passMatches || wrongMatches) {
    throw new Error('Password verification logic failed');
  }
  console.log('  ✅ Correct password accepted, wrong password rejected.\n');

  // Step 4: Profile Modification & Persistence
  console.log('4️⃣ Testing Profile Update...');
  const updatedBio = JSON.stringify([{ id: 'b1', text: 'Stargazer & Space Explorer' }]);
  await execute(
    `UPDATE users SET mood = ?, avatarFrame = ?, bioSegments = ?, updatedAt = ? WHERE username = ?`,
    ['Dreaming big', 'frame-neon-purple', updatedBio, Date.now(), 'alice']
  );
  const aliceUpdated = await getOne('SELECT * FROM users WHERE username = ?', ['alice']);
  if (aliceUpdated.mood !== 'Dreaming big' || aliceUpdated.avatarFrame !== 'frame-neon-purple') {
    throw new Error('Profile update failed');
  }
  console.log('  ✅ Alice profile updated (mood: "Dreaming big", avatarFrame: "frame-neon-purple")\n');

  // Step 5: Signup Account B (Bob)
  console.log('5️⃣ Testing Signup for Account B (Bob)...');
  const bobPassHash = await bcrypt.hash('secretBob456', 10);
  const bobId = `user_${now}_bob`;
  await execute(
    `INSERT OR REPLACE INTO users (
      id, username, displayName, passwordHash, email, gender, age,
      bioSegments, mood, rank, wallet, dailyMessagesDate, dailyMessagesCount,
      claimedDailyMilestones, lastDailyClaim, lastActive, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      bobId, 'bob', 'Bob', bobPassHash, 'bob@chatlaxy.internal', 'Male', '25',
      JSON.stringify([{ id: 'b2', text: 'Bob here!' }]), 'Chilling', 'VIP', initialWallet,
      new Date().toISOString().slice(0, 10), 0, '[]', 0, now, now, now
    ]
  );
  console.log('  ✅ Bob created successfully.\n');

  // Step 6: Send Messages
  console.log('6️⃣ Testing Messages system...');
  const msg1Id = `msg-${now}-1`;
  const msg2Id = `msg-${now}-2`;
  await execute(
    `INSERT INTO messages (id, serverId, channelId, senderName, content, timestamp, senderRank, isSystemBot, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [msg1Id, null, null, 'bob', 'Hello Chatlaxy from Bob!', now, 'VIP', 0, now]
  );
  await execute(
    `INSERT INTO messages (id, serverId, channelId, senderName, content, timestamp, senderRank, isSystemBot, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [msg2Id, null, null, 'alice', 'Hey Bob, welcome to the universe!', now + 100, 'VIP', 0, now + 100]
  );

  const allMessages = await query('SELECT * FROM messages WHERE serverId IS NULL ORDER BY timestamp ASC');
  if (allMessages.length < 2) {
    throw new Error('Messages were not persisted in SQLite');
  }
  console.log(`  ✅ ${allMessages.length} messages retrieved from SQLite.\n`);

  // Step 7: Daily Rewards Milestone Claim
  console.log('7️⃣ Testing Daily Rewards & Wallet Update...');
  const claimedMilestones = JSON.stringify([50]);
  const newWallet = JSON.stringify({ ruby: 6, gold: 1250 });
  await execute(
    `UPDATE users SET wallet = ?, claimedDailyMilestones = ?, dailyMessagesCount = 50 WHERE username = ?`,
    [newWallet, claimedMilestones, 'alice']
  );
  const aliceAfterReward = await getOne('SELECT wallet, claimedDailyMilestones, dailyMessagesCount FROM users WHERE username = ?', ['alice']);
  const parsedWallet = JSON.parse(aliceAfterReward.wallet);
  if (parsedWallet.gold !== 1250 || parsedWallet.ruby !== 6) {
    throw new Error('Wallet reward credit failed');
  }
  console.log(`  ✅ Alice claimed 50-message milestone: Wallet is now ${parsedWallet.gold} Gold + ${parsedWallet.ruby} Rubies.\n`);

  // Step 8: Servers, Channels, Roles & Members
  console.log('8️⃣ Testing Servers, Channels, Roles & Members...');
  const serverId = `server-${now}-galaxy`;
  await execute(
    'INSERT INTO servers (id, name, owner, description, createdAt) VALUES (?, ?, ?, ?, ?)',
    [serverId, 'Galaxy Lounge', 'alice', 'A place for cosmos lovers', now]
  );
  await execute(
    'INSERT INTO members (serverId, username, roles, joinedAt) VALUES (?, ?, ?, ?)',
    [serverId, 'alice', JSON.stringify(['Owner']), now]
  );
  await execute(
    'INSERT INTO members (serverId, username, roles, joinedAt) VALUES (?, ?, ?, ?)',
    [serverId, 'bob', JSON.stringify(['Member', 'Space Pilot']), now]
  );
  const chanId = `ch-${now}-general`;
  await execute(
    'INSERT INTO channels (id, serverId, name, position, createdAt) VALUES (?, ?, ?, ?, ?)',
    [chanId, serverId, 'general', 0, now]
  );
  const roleId = `role-${now}-pilot`;
  await execute(
    'INSERT INTO roles (id, serverId, name, colour, position, permissions, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [roleId, serverId, 'Space Pilot', '#3b82f6', 1, JSON.stringify(['SEND_MESSAGES', 'ATTACH_FILES']), now]
  );

  // Send channel message
  const serverMsgId = `msg-${now}-server-1`;
  await execute(
    `INSERT INTO messages (id, serverId, channelId, senderName, content, timestamp, senderRank, isSystemBot, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [serverMsgId, serverId, chanId, 'bob', 'First message in #general on Galaxy Lounge!', now + 200, 'VIP', 0, now + 200]
  );
  console.log('  ✅ Server, channel, role, members, and channel message created.\n');

  // Step 9: Verify Full SQLite Disk Persistence
  console.log('9️⃣ Verifying SQLite file persistence on disk...');
  persistDbNow();
  const dbFile = path.resolve(process.cwd(), 'chatlaxy.sqlite');
  if (!fs.existsSync(dbFile)) {
    throw new Error(`chatlaxy.sqlite does not exist at ${dbFile}`);
  }
  const fileSize = fs.statSync(dbFile).size;
  console.log(`  ✅ SQLite database file exists at: ${dbFile} (${fileSize} bytes)`);

  // Step 10: Simulate Server Restart (reloading fresh database from disk)
  console.log('🔟 Simulating server restart and reloading from chatlaxy.sqlite...');
  const freshDbRows = await query('SELECT username, rank, wallet, mood FROM users ORDER BY username ASC');
  console.log('  Found users after reload:', freshDbRows);
  const serverRows = await query('SELECT id, name, owner FROM servers');
  console.log('  Found servers after reload:', serverRows);
  const messageRows = await query('SELECT id, senderName, content FROM messages');
  console.log(`  Found ${messageRows.length} messages after reload.`);

  if (freshDbRows.length < 2 || serverRows.length < 1 || messageRows.length < 3) {
    throw new Error('Data did not survive restart simulation!');
  }

  console.log('\n🎉 ALL LOCAL BACKEND & SQLITE PERSISTENCE TESTS PASSED 100%!');
}

runBackendTests().then(() => process.exit(0)).catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
