-- Who opened the demo. Visibility for a prototype with no real users.
CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  ip TEXT,
  country TEXT,
  city TEXT,
  path TEXT NOT NULL,
  user_agent TEXT
);
