-- D1 schema for the AI-vs-human quiz.
--
-- Apply with:
--   wrangler d1 execute englishproject-db --file=migrations/0001_init.sql --remote
-- (omit --remote to apply to the local dev D1 instance).

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sessions (
  id           TEXT PRIMARY KEY,
  started_at   INTEGER NOT NULL,
  finished_at  INTEGER NOT NULL,
  ua_hint      TEXT,
  country      TEXT,
  created_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS answers (
  session_id  TEXT    NOT NULL,
  q_index     INTEGER NOT NULL,
  pair_genre  TEXT    NOT NULL,
  ai_side     TEXT    NOT NULL CHECK (ai_side IN ('A','B')),
  user_pick   TEXT    NOT NULL CHECK (user_pick IN ('A','B')),
  correct     INTEGER NOT NULL CHECK (correct IN (0,1)),
  latency_ms  INTEGER NOT NULL,
  PRIMARY KEY (session_id, q_index),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_answers_genre        ON answers(pair_genre);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at  ON sessions(created_at);
