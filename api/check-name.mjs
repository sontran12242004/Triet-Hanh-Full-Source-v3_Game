/**
 * Vercel Serverless Function — /api/check-name
 * Kiem tra ten nguoi choi da ton tai trong leaderboard chua.
 */
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 5000,
});
pool.on('error', err => console.error('PG pool error:', err.code || 'UNKNOWN'));

const json = (res, data, status = 200) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(data);
};

export default async function handler(req, res) {
  // ── CORS ──
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET') return json(res, { error: 'Method not allowed' }, 405);

  try {
    const name = (req.query.name || '').trim();
    if (!name || name.length > 24) return json(res, { error: 'Invalid name' }, 400);

    const result = await pool.query(
      'SELECT 1 FROM scores WHERE LOWER(TRIM(name)) = LOWER($1) LIMIT 1',
      [name]
    );
    return json(res, { exists: result.rows.length > 0 });
  } catch (error) {
    console.error('Check name error:', error.code || 'UNKNOWN', error.message);
    return json(res, { error: 'Không kiểm tra được tên.' }, 503);
  }
}
