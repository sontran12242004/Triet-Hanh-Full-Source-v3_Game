/**
 * Vercel Serverless Function — /api/player
 * Quản lý thông tin và tiến độ game của người chơi trên PostgreSQL:
 * - GET ?name=xxx: Lấy tiến độ của người chơi
 * - POST { action: 'create', name, gender, gameState }: Tạo người chơi mới
 * - POST { action: 'update', name, gameState }: Cập nhật tiến độ người chơi
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    // ── GET ?name=xxx: Lấy tiến độ người chơi từ DB ──
    if (req.method === 'GET') {
      const name = (req.query.name || '').trim();
      if (!name || name.length > 24) return json(res, { error: 'Invalid name' }, 400);

      const result = await pool.query(
        'SELECT name, gender, game_state, created_at, updated_at FROM players WHERE name_lower = LOWER(TRIM($1))',
        [name]
      );

      if (result.rows.length === 0) {
        return json(res, { exists: false });
      }

      const row = result.rows[0];
      return json(res, {
        exists: true,
        player: {
          name: row.name,
          gender: row.gender,
          gameState: row.game_state,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }
      });
    }

    // ── POST: Tạo mới hoặc cập nhật tiến độ ──
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch {}
      }
      body = body || {};

      const action = body.action || 'update';
      const name = (body.name || '').trim();
      const gender = body.gender === 'female' ? 'female' : 'male';

      if (!name || name.length > 24) return json(res, { error: 'Invalid name' }, 400);

      // Action 1: 'create' — Tạo hoặc khởi tạo lại người chơi khi bấm Bắt đầu
      if (action === 'create') {
        const gameState = body.gameState && typeof body.gameState === 'object' ? body.gameState : {};
        const result = await pool.query(
          `INSERT INTO players (name_lower, name, gender, game_state, updated_at)
           VALUES (LOWER(TRIM($1)), $1, $2, $3, CURRENT_TIMESTAMP)
           ON CONFLICT (name_lower)
           DO UPDATE SET
             name = excluded.name,
             gender = excluded.gender,
             game_state = excluded.game_state,
             updated_at = CURRENT_TIMESTAMP
           RETURNING name, gender, game_state, updated_at`,
          [name, gender, JSON.stringify(gameState)]
        );
        return json(res, { ok: true, player: result.rows[0] });
      }

      // Action 2: 'update' — Cập nhật tiến độ trong khi chơi
      if (action === 'update') {
        const gameState = body.gameState;
        if (!gameState || typeof gameState !== 'object') {
          return json(res, { error: 'Invalid gameState' }, 400);
        }

        // CHỈ update nếu người chơi vẫn tồn tại trong DB.
        // Nếu admin đã xóa -> rowCount = 0 -> thông báo để client xóa sạch local.
        const result = await pool.query(
          `UPDATE players
           SET game_state = $1, updated_at = CURRENT_TIMESTAMP
           WHERE name_lower = LOWER(TRIM($2))`,
          [JSON.stringify(gameState), name]
        );

        if (result.rowCount === 0) {
          return json(res, { ok: false, deleted: true, message: 'Người chơi đã bị xóa bởi quản trị viên.' });
        }

        return json(res, { ok: true });
      }

      return json(res, { error: 'Unknown action' }, 400);
    }

    return json(res, { error: 'Method not allowed' }, 405);
  } catch (error) {
    console.error('Player API error:', error.code || 'UNKNOWN', error.message);
    return json(res, { error: 'Server error' }, 500);
  }
}
