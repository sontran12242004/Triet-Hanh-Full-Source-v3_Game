/**
 * Vercel Serverless Function — /api/admin
 * API admin: xem danh sach nguoi choi, xoa nguoi choi, thong ke.
 * Bao mat bang ADMIN_KEY trong env.
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

function checkAuth(req) {
  const key = req.headers['x-admin-key'] || req.query.key || '';
  return key === process.env.ADMIN_KEY;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!checkAuth(req)) return json(res, { error: 'Unauthorized' }, 401);

  try {
    const action = req.query.action || 'list';

    // ── GET ?action=list — Danh sach toan bo nguoi choi ──
    if (req.method === 'GET' && action === 'list') {
      const result = await pool.query(
        `SELECT id, name, gender, mode, score, duration, mistakes, answered, npc_count,
                rules_version, created_at, updated_at
         FROM scores
         ORDER BY updated_at DESC`
      );
      return json(res, { players: result.rows, total: result.rows.length });
    }

    // ── GET ?action=stats — Thong ke tong quat ──
    if (req.method === 'GET' && action === 'stats') {
      const result = await pool.query(
        `SELECT
           COUNT(*) AS total_players,
           COUNT(*) FILTER (WHERE npc_count = 18) AS completed,
           COALESCE(AVG(score), 0) AS avg_score,
           COALESCE(MAX(score), 0) AS max_score,
           COALESCE(AVG(duration), 0) AS avg_duration
         FROM scores WHERE rules_version = 2`
      );
      return json(res, result.rows[0]);
    }

    // ── DELETE ?action=delete&id=xxx — Xoa 1 nguoi choi theo id ──
    if (req.method === 'DELETE' && action === 'delete') {
      const id = req.query.id;
      if (!id) return json(res, { error: 'Missing id' }, 400);
      const result = await pool.query('DELETE FROM scores WHERE id = $1', [id]);
      return json(res, { deleted: result.rowCount > 0, id });
    }

    // ── DELETE ?action=delete-by-name&name=xxx — Xoa theo ten ──
    if (req.method === 'DELETE' && action === 'delete-by-name') {
      const name = (req.query.name || '').trim();
      if (!name) return json(res, { error: 'Missing name' }, 400);
      const result = await pool.query('DELETE FROM scores WHERE LOWER(TRIM(name)) = LOWER($1)', [name]);
      return json(res, { deleted: result.rowCount, name });
    }

    // ── DELETE ?action=clear-all — Xoa toan bo ──
    if (req.method === 'DELETE' && action === 'clear-all') {
      const result = await pool.query('DELETE FROM scores');
      return json(res, { deleted: result.rowCount });
    }

    return json(res, { error: 'Unknown action' }, 400);
  } catch (error) {
    console.error('Admin API error:', error.code || 'UNKNOWN', error.message);
    return json(res, { error: 'Server error' }, 503);
  }
}
