-- PostgreSQL. Ket noi database triet_hanh truoc khi chay.
-- Khong xoa du lieu neu chay lai tren schema nay.
BEGIN;
CREATE TABLE IF NOT EXISTS scores (
    id VARCHAR(80) PRIMARY KEY,
    name VARCHAR(24) NOT NULL CHECK (length(trim(name)) > 0),
    gender VARCHAR(6) NOT NULL CHECK (gender IN ('male', 'female')),
    mode VARCHAR(8) NOT NULL DEFAULT 'full' CHECK (mode = 'full'),
    rules_version INTEGER NOT NULL DEFAULT 2 CHECK (rules_version IN (1, 2)),
    score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 9000),
    duration INTEGER NOT NULL CHECK (duration BETWEEN 1 AND 31536000),
    mistakes INTEGER NOT NULL DEFAULT 0 CHECK (mistakes BETWEEN 0 AND 12),
    answered INTEGER NOT NULL CHECK (answered BETWEEN 1 AND 90),
    npc_count INTEGER NOT NULL CHECK (npc_count BETWEEN 1 AND 18),
    answers_json JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(answers_json) = 'array'),
    created_at BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS scores_ranking
    ON scores (rules_version, mode, score DESC, duration ASC, created_at ASC);
CREATE INDEX IF NOT EXISTS scores_name_lower
    ON scores (LOWER(TRIM(name)));

-- Bang luu toan bo tien do game cua nguoi choi (thay the localStorage)
CREATE TABLE IF NOT EXISTS players (
    name_lower VARCHAR(24) PRIMARY KEY,
    name VARCHAR(24) NOT NULL,
    gender VARCHAR(6) NOT NULL CHECK (gender IN ('male', 'female')),
    game_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45) DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Thêm cột ip_address nếu bảng đã tồn tại (migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'ip_address'
  ) THEN
    ALTER TABLE players ADD COLUMN ip_address VARCHAR(45) DEFAULT NULL;
  END IF;
END $$;
COMMIT;
