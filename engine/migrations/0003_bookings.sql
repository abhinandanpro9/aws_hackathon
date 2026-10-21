-- Tour bookings. One row per held slot; UNIQUE enforces one tour at a time.
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(date, time)
);
