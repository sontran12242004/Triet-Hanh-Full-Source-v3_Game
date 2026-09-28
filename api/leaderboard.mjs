/**
 * Vercel Serverless Function — /api/leaderboard
 * Ket noi Railway PostgreSQL tu Vercel Edge.
 */
import pg from 'pg';

// Vercel serverless: tao pool 1 lan, tai su dung giua cac invocation trong cung container.
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
  // ── CORS cho frontend ──
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    // ── GET /api/leaderboard ──
    if (req.method === 'GET') {
      const mode = 'full';
      const result = await pool.query(
        `SELECT name, gender, score, duration, npc_count, answered
         FROM scores WHERE mode = $1 AND rules_version = 2
         ORDER BY score DESC, duration ASC, created_at ASC LIMIT 50`,
        [mode]
      );
      return json(res, result.rows);
    }

    // ── POST /api/leaderboard ──
    if (req.method !== 'POST') return json(res, { error: 'Method not allowed' }, 405);

    const x = req.body;
    if (!x || typeof x !== 'object') return json(res, { error: 'Invalid JSON' }, 400);

    const rules = x?.rulesVersion ?? 1;
    if (![1, 2].includes(rules)) return json(res, { error: 'Invalid game version' }, 400);
    const maps = rules === 2 ? 6 : 4;
    const questions = rules === 2 ? 5 : 4;
    const total = maps * 3 * questions;

    if (
      !Array.isArray(x.answers) ||
      x.answers.length > total ||
      x.answers.some(k =>
        typeof k !== 'string' ||
        !(rules === 2 ? /^([0-5]):([0-2]):([0-4])$/ : /^([0-3]):([0-2]):([0-3])$/).test(k)
      ) ||
      new Set(x.answers).size !== x.answers.length
    ) return json(res, { error: 'Invalid progress' }, 400);

    const answered = x.answers.length;
    let npcCount = 0;
    for (let m = 0; m < maps; m++)
      for (let n = 0; n < 3; n++)
        if (Array.from({ length: questions }, (_, i) => i).every(q => x.answers.includes(`${m}:${n}:${q}`)))
          npcCount++;

    if (npcCount < 1 || x.npcCount !== npcCount) return json(res, { error: 'Incomplete NPC' }, 400);

    if (
      (x.mode !== undefined && x.mode !== 'full') ||
      !['male', 'female'].includes(x.gender) ||
      typeof x.name !== 'string' || !x.name.trim() || x.name.length > 24 || /[\u0000-\u001f]/.test(x.name) ||
      typeof x.id !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(x.id) ||
      !Number.isInteger(x.mistakes) || x.mistakes < 0 || x.mistakes > maps * 2 ||
      !Number.isInteger(x.duration) || x.duration < 1 || x.duration > 31536000 ||
      x.score !== Math.max(0, answered * 100 - x.mistakes * 25)
    ) return json(res, { error: 'Invalid result' }, 400);

    await pool.query(
      `INSERT INTO scores (id,name,gender,mode,score,duration,mistakes,created_at,answered,npc_count,answers_json,rules_version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT(id) DO UPDATE SET
         score=excluded.score, duration=excluded.duration, mistakes=excluded.mistakes,
         answered=excluded.answered, npc_count=excluded.npc_count, answers_json=excluded.answers_json,
         updated_at=CURRENT_TIMESTAMP
       WHERE excluded.npc_count > scores.npc_count AND excluded.rules_version = scores.rules_version`,
      [x.id, x.name.trim(), x.gender, 'full', x.score, x.duration, x.mistakes,
       Date.now(), answered, npcCount, JSON.stringify(x.answers), rules]
    );

    return json(res, { ok: true });
  } catch (error) {
    console.error('Leaderboard error:', error.code || 'UNKNOWN', error.message);
    return json(res, { error: 'Bảng xếp hạng tạm thời chưa kết nối được.' }, 503);
  }
}
