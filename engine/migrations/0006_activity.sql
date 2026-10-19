-- Every agent step, across conversations, for the live activity feed.
-- ts is a sortable number (ms * 100 + step index), so newest-first needs no date parsing.
CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  ts INTEGER NOT NULL,
  at TEXT NOT NULL,
  question TEXT NOT NULL,
  agent TEXT NOT NULL,
  action TEXT NOT NULL,
  tool TEXT,
  handoff_to TEXT,
  ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS activity_ts ON activity (ts DESC);
