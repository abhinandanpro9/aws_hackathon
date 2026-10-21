-- One rolling, model-written summary per session; turns_covered marks how far it reaches.
CREATE TABLE IF NOT EXISTS session_summaries (
  session_id TEXT PRIMARY KEY,
  summary TEXT NOT NULL,
  turns_covered INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
