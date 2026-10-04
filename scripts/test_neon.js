import pg from 'pg';
import { initDatabase, query, getOne, execute, isUsingPostgres } from '../db.js';

const { Pool } = pg;

const NEON_URL = 'postgresql://neondb_owner:npg_Bt9fDkgKojX0@ep-noisy-scene-b5co5yrh-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

// Set DATABASE_URL in process.env
process.env.DATABASE_URL = NEON_URL;

async function testNeon() {
  console.log('🚀 Testing direct connection to Neon PostgreSQL...');

  try {
    const pool = new Pool({
      connectionString: NEON_URL,
      ssl: { rejectUnauthorized: false },
    });

    const res = await pool.query('SELECT NOW() as current_time, version() as pg_version;');
    console.log('✅ Connected to Neon successfully!');
    console.log('🕒 Neon Server Time:', res.rows[0].current_time);
    console.log('🐘 PostgreSQL Version:', res.rows[0].pg_version.split(' ')[0], res.rows[0].pg_version.split(' ')[1]);
    await pool.end();

    console.log('\n📦 Initializing Chatlaxy schema in Neon...');
    await initDatabase();
    console.log('✅ Schema migration complete!');

    console.log('\n🔍 Verifying created tables in Neon PostgreSQL...');
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log('📋 Existing tables in Neon:', tables.map(t => t.table_name || t.tablename));

    console.log('\n🎉 Neon PostgreSQL is 100% connected, migrated, and ready for production!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Neon connection or migration error:', err);
    process.exit(1);
  }
}

testNeon();
