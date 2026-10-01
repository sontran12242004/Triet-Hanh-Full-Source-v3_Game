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

    // ── GET ?action=list — Danh sach toan bo nguoi choi (ket hop players va scores) ──
    if (req.method === 'GET' && action === 'list') {
      const result = await pool.query(
        `SELECT 
           COALESCE(s.id, p.name_lower) AS id,
           COALESCE(p.name, s.name) AS name,
           COALESCE(p.gender, s.gender) AS gender,
           COALESCE(s.mode, 'full') AS mode,
           COALESCE(s.score, 0) AS score,
           COALESCE(s.duration, 0) AS duration,
           COALESCE(s.mistakes, 0) AS mistakes,
           COALESCE(s.answered, jsonb_array_length(COALESCE(p.game_state->'answers', '[]'::jsonb)), 0) AS answered,
           COALESCE(s.npc_count, 0) AS npc_count,
           COALESCE(s.rules_version, 2) AS rules_version,
           COALESCE(s.created_at, (EXTRACT(EPOCH FROM p.created_at)*1000)::bigint) AS created_at,
           COALESCE(p.updated_at, s.updated_at) AS updated_at,
           p.ip_address
         FROM players p
         FULL OUTER JOIN scores s ON p.name_lower = LOWER(TRIM(s.name))
         ORDER BY updated_at DESC`
      );
      return json(res, { players: result.rows, total: result.rows.length });
    }

    // ── GET ?action=stats — Thong ke tong quat ──
    if (req.method === 'GET' && action === 'stats') {
      const result = await pool.query(
        `SELECT
           (SELECT COUNT(*) FROM players) AS total_players,
           (SELECT COUNT(DISTINCT ip_address) FROM players WHERE ip_address IS NOT NULL) AS unique_ips,
           COUNT(*) FILTER (WHERE npc_count = 18) AS completed,
           COALESCE(AVG(score), 0) AS avg_score,
           COALESCE(MAX(score), 0) AS max_score,
           COALESCE(AVG(duration), 0) AS avg_duration
         FROM scores WHERE rules_version = 2`
      );
      return json(res, result.rows[0]);
    }

    // ── DELETE ?action=delete&id=xxx — Xoa 1 nguoi choi khoi ca scores va players ──
    if (req.method === 'DELETE' && action === 'delete') {
      const id = req.query.id;
      let name = (req.query.name || '').trim();
      if (!id && !name) return json(res, { error: 'Missing id or name' }, 400);

      if (!name && id) {
        const s = await pool.query('SELECT name FROM scores WHERE id = $1', [id]);
        if (s.rows.length) name = s.rows[0].name;
        else {
          const p = await pool.query('SELECT name FROM players WHERE name_lower = LOWER(TRIM($1))', [id]);
          if (p.rows.length) name = p.rows[0].name;
        }
      }

      let deletedCount = 0;
      if (id) {
        const r = await pool.query('DELETE FROM scores WHERE id = $1', [id]);
        deletedCount += r.rowCount;
      }
      if (name) {
        const r1 = await pool.query('DELETE FROM scores WHERE LOWER(TRIM(name)) = LOWER($1)', [name]);
        const r2 = await pool.query('DELETE FROM players WHERE name_lower = LOWER(TRIM($1))', [name]);
        deletedCount += (r1.rowCount + r2.rowCount);
      }

      return json(res, { deleted: deletedCount > 0, id, name });
    }

    // ── DELETE ?action=delete-by-name&name=xxx — Xoa theo ten khoi ca scores va players ──
    if (req.method === 'DELETE' && action === 'delete-by-name') {
      const name = (req.query.name || '').trim();
      if (!name) return json(res, { error: 'Missing name' }, 400);
      const r1 = await pool.query('DELETE FROM scores WHERE LOWER(TRIM(name)) = LOWER($1)', [name]);
      const r2 = await pool.query('DELETE FROM players WHERE name_lower = LOWER(TRIM($1))', [name]);
      return json(res, { deleted: r1.rowCount > 0 || r2.rowCount > 0, name });
    }

    // ── DELETE ?action=clear-all — Xoa toan bo du lieu ca scores va players ──
    if (req.method === 'DELETE' && action === 'clear-all') {
      const r1 = await pool.query('DELETE FROM scores');
      const r2 = await pool.query('DELETE FROM players');
      return json(res, { deleted: r1.rowCount + r2.rowCount });
    }

    return json(res, { error: 'Unknown action' }, 400);
  } catch (error) {
    console.error('Admin API error:', error.code || 'UNKNOWN', error.message);
    return json(res, { error: 'Server error' }, 503);
  }
}
