/**
 * Railway PostgreSQL Health Check Script
 * Kiem tra ket noi, bang, du lieu va hieu nang database.
 * Chay: node scripts/health-check.mjs
 */
import { pool } from '../server/db.mjs';

const log = (level, icon, msg, data) => {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] ${icon} [${level}]`;
  if (data !== undefined) {
    console.log(`${prefix} ${msg}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
  } else {
    console.log(`${prefix} ${msg}`);
  }
};

const info  = (msg, data) => log('INFO',  '🔵', msg, data);
const ok    = (msg, data) => log('OK',    '✅', msg, data);
const warn  = (msg, data) => log('WARN',  '⚠️', msg, data);
const fail  = (msg, data) => log('ERROR', '❌', msg, data);
const sep   = () => console.log('─'.repeat(60));

async function healthCheck() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     🏥 RAILWAY POSTGRESQL HEALTH CHECK                  ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  const results = { passed: 0, failed: 0, warnings: 0 };
  let client;

  // ── 1. Kiem tra ket noi co ban ──
  sep();
  info('1️⃣  KIEM TRA KET NOI CO BAN');
  sep();

  try {
    const start = performance.now();
    client = await pool.connect();
    const latency = (performance.now() - start).toFixed(2);
    ok(`Ket noi thanh cong! (${latency}ms)`);
    results.passed++;
  } catch (err) {
    fail('KHONG THE KET NOI DATABASE!', {
      code: err.code,
      message: err.message,
      host: process.env.PGHOST || '(from DATABASE_URL)',
      port: process.env.PGPORT || '(from DATABASE_URL)',
    });
    results.failed++;
    console.log('\n💡 Goi y: Kiem tra lai .env, dam bao Railway DB dang chay va public networking da bat.\n');
    await pool.end();
    process.exit(1);
  }

  // ── 2. Thong tin server ──
  sep();
  info('2️⃣  THONG TIN SERVER');
  sep();

  try {
    const verRes = await client.query('SELECT version()');
    ok('PostgreSQL Version:', verRes.rows[0].version);

    const dbRes = await client.query('SELECT current_database() AS db, current_user AS usr, inet_server_addr() AS addr, inet_server_port() AS port');
    ok('Database:', dbRes.rows[0].db);
    ok('User:', dbRes.rows[0].usr);
    ok('Server:', `${dbRes.rows[0].addr || 'N/A'}:${dbRes.rows[0].port || 'N/A'}`);
    results.passed++;
  } catch (err) {
    fail('Khong lay duoc thong tin server:', err.message);
    results.failed++;
  }

  // ── 3. Kiem tra SSL ──
  sep();
  info('3️⃣  KIEM TRA SSL/TLS');
  sep();

  try {
    const sslRes = await client.query("SELECT ssl, version FROM pg_stat_ssl WHERE pid = pg_backend_pid()");
    if (sslRes.rows.length > 0 && sslRes.rows[0].ssl) {
      ok('SSL dang BAT', { version: sslRes.rows[0].version });
    } else {
      warn('SSL dang TAT — Railway ho tro SSL, nen bat de bao mat.');
      results.warnings++;
    }
    results.passed++;
  } catch (err) {
    warn('Khong kiem tra duoc SSL:', err.message);
    results.warnings++;
  }

  // ── 4. Kiem tra bang scores ──
  sep();
  info('4️⃣  KIEM TRA BANG SCORES');
  sep();

  try {
    const tableRes = await client.query(`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'scores' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);

    if (tableRes.rows.length === 0) {
      warn('Bang "scores" CHUA TON TAI — Can chay: npm run db:init');
      results.warnings++;
    } else {
      ok(`Bang "scores" co ${tableRes.rows.length} cot:`);
      console.table(tableRes.rows.map(r => ({
        Column: r.column_name,
        Type: r.data_type,
        Nullable: r.is_nullable
      })));
      results.passed++;
    }
  } catch (err) {
    fail('Khong kiem tra duoc bang:', err.message);
    results.failed++;
  }

  // ── 5. Kiem tra du lieu ──
  sep();
  info('5️⃣  THONG KE DU LIEU');
  sep();

  try {
    const countRes = await client.query('SELECT count(*) AS total FROM scores');
    const total = parseInt(countRes.rows[0].total, 10);
    ok(`Tong so ban ghi: ${total}`);

    if (total > 0) {
      const statsRes = await client.query(`
        SELECT 
          min(score) AS min_score,
          max(score) AS max_score,
          round(avg(score)) AS avg_score,
          min(created_at) AS oldest,
          max(created_at) AS newest
        FROM scores
      `);
      ok('Thong ke diem:', statsRes.rows[0]);

      const top5 = await client.query(`
        SELECT name, score, gender, duration, mistakes
        FROM scores 
        ORDER BY score DESC, duration ASC 
        LIMIT 5
      `);
      if (top5.rows.length > 0) {
        info('Top 5 diem cao nhat:');
        console.table(top5.rows);
      }
    } else {
      info('Chua co du lieu — Day la database moi.');
    }
    results.passed++;
  } catch (err) {
    if (err.code === '42P01') {
      warn('Bang "scores" chua ton tai — Chay: npm run db:init');
      results.warnings++;
    } else {
      fail('Khong truy van duoc du lieu:', err.message);
      results.failed++;
    }
  }

  // ── 6. Kiem tra index ──
  sep();
  info('6️⃣  KIEM TRA INDEX');
  sep();

  try {
    const idxRes = await client.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'scores' AND schemaname = 'public'
    `);
    if (idxRes.rows.length > 0) {
      ok(`Tim thay ${idxRes.rows.length} index:`);
      idxRes.rows.forEach(r => info(`  📌 ${r.indexname}`));
    } else {
      warn('Khong co index nao — Hieu nang co the bi anh huong.');
      results.warnings++;
    }
    results.passed++;
  } catch (err) {
    warn('Khong kiem tra duoc index:', err.message);
    results.warnings++;
  }

  // ── 7. Kiem tra kich thuoc database ──
  sep();
  info('7️⃣  KICH THUOC DATABASE');
  sep();

  try {
    const sizeRes = await client.query(`
      SELECT 
        pg_size_pretty(pg_database_size(current_database())) AS db_size,
        (SELECT count(*) FROM pg_stat_activity) AS active_connections,
        (SELECT setting FROM pg_settings WHERE name = 'max_connections') AS max_connections
    `);
    ok('Kich thuoc DB:', sizeRes.rows[0].db_size);
    ok('Ket noi hien tai:', `${sizeRes.rows[0].active_connections} / ${sizeRes.rows[0].max_connections}`);
    results.passed++;
  } catch (err) {
    warn('Khong lay duoc kich thuoc:', err.message);
    results.warnings++;
  }

  // ── 8. Do do tre (latency) ──
  sep();
  info('8️⃣  DO DO TRE (LATENCY)');
  sep();

  try {
    const pings = [];
    for (let i = 0; i < 5; i++) {
      const s = performance.now();
      await client.query('SELECT 1');
      pings.push(performance.now() - s);
    }
    const avg = (pings.reduce((a, b) => a + b, 0) / pings.length).toFixed(2);
    const min = Math.min(...pings).toFixed(2);
    const max = Math.max(...pings).toFixed(2);
    ok(`Latency (5 queries): avg=${avg}ms, min=${min}ms, max=${max}ms`);

    if (parseFloat(avg) < 100) {
      ok('Latency TOT (< 100ms)');
    } else if (parseFloat(avg) < 300) {
      warn('Latency CHAP NHAN DUOC (100-300ms)');
      results.warnings++;
    } else {
      warn('Latency CAO (> 300ms) — Nen kiem tra mang hoac chon region Railway gan hon.');
      results.warnings++;
    }
    results.passed++;
  } catch (err) {
    fail('Khong do duoc latency:', err.message);
    results.failed++;
  }

  // ── Tong ket ──
  sep();
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     📊 TONG KET HEALTH CHECK                           ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
  ok(`Passed:   ${results.passed}`);
  if (results.warnings > 0) warn(`Warnings: ${results.warnings}`);
  if (results.failed > 0) fail(`Failed:   ${results.failed}`);
  console.log('');

  if (results.failed === 0) {
    console.log('🎉 Database Railway HOAT DONG TOT! San sang su dung.');
  } else {
    console.log('🔧 Co loi can xu ly. Xem chi tiet phia tren.');
  }
  console.log('');

  client.release();
  await pool.end();
  process.exit(results.failed > 0 ? 1 : 0);
}

healthCheck().catch(err => {
  fail('Loi khong mong doi:', err.message);
  pool.end().then(() => process.exit(1));
});
