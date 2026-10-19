-- Mutable state only. Structured facts (hours, closures, tours, illness) stay in center.json.
-- FLOW: seed from center.json -> operator mutates via /api -> both UIs read
-- 1. labels/questions/trace/before/after are JSON text: read whole, never queried into
-- 2. seq preserves the newest-first insertion order the in-memory arrays gave for free
-- 3. sensitive/helpful are INTEGER 0|1 -- SQLite has no boolean

CREATE TABLE IF NOT EXISTS policies (
  id          TEXT PRIMARY KEY,
  version     INTEGER NOT NULL,
  text        TEXT    NOT NULL,
  labels      TEXT    NOT NULL,
  sensitive   INTEGER NOT NULL,
  owner_id    TEXT,
  reference   TEXT    NOT NULL,
  notes       TEXT    NOT NULL,
  approved_by TEXT    NOT NULL,
  approved_at TEXT    NOT NULL,
  seq         INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS changes (
  id          TEXT PRIMARY KEY,
  kind        TEXT    NOT NULL,
  target_id   TEXT,
  before      TEXT,
  after       TEXT,
  proposed_by TEXT    NOT NULL,
  proposed_at TEXT    NOT NULL,
  note        TEXT    NOT NULL,
  status      TEXT    NOT NULL,
  reviewed_by TEXT,
  reviewed_at TEXT,
  seq         INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id         TEXT PRIMARY KEY,
  session_id TEXT,
  asked_at   TEXT    NOT NULL,
  question   TEXT    NOT NULL,
  outcome    TEXT    NOT NULL,
  route      TEXT    NOT NULL,
  answer     TEXT    NOT NULL,
  citation   TEXT,
  handled_by TEXT    NOT NULL,
  topic      TEXT,
  confidence REAL    NOT NULL,
  trace      TEXT    NOT NULL,
  seq        INTEGER NOT NULL
);

-- Keyed on the POLICY, not id@version: editing wording must not reset a count.
CREATE TABLE IF NOT EXISTS policy_usage (
  policy_id    TEXT PRIMARY KEY,
  labels       TEXT    NOT NULL,
  times_used   INTEGER NOT NULL,
  last_used_at TEXT,
  questions    TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS near_misses (
  topic        TEXT PRIMARY KEY,
  times_asked  INTEGER NOT NULL,
  last_asked_at TEXT,
  questions    TEXT    NOT NULL
);

-- One rating per conversation: a parent changing their mind replaces, never doubles.
CREATE TABLE IF NOT EXISTS feedback (
  conversation_id TEXT PRIMARY KEY,
  route           TEXT    NOT NULL,
  helpful         INTEGER NOT NULL,
  note            TEXT,
  at              TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_seq     ON conversations(seq DESC);
CREATE INDEX IF NOT EXISTS idx_policies_seq          ON policies(seq DESC);
CREATE INDEX IF NOT EXISTS idx_changes_seq           ON changes(seq DESC);
