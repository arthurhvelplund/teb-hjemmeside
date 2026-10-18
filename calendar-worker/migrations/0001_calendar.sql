PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  request_key TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL,
  author_hash TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  pending_json TEXT,
  pending_kind TEXT,
  published_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  revision INTEGER NOT NULL DEFAULT 1,
  moderation_note TEXT NOT NULL DEFAULT '',
  notification_state TEXT NOT NULL DEFAULT 'pending',
  receipt_state TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS publications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL REFERENCES events(id),
  revision INTEGER NOT NULL,
  data_json TEXT NOT NULL,
  published_at TEXT NOT NULL,
  UNIQUE(event_id, revision)
);
CREATE TABLE IF NOT EXISTS tokens (
  hash TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS editions (
  id TEXT PRIMARY KEY,
  month TEXT NOT NULL,
  deadline TEXT NOT NULL,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS local_mail (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_pending ON events(pending_kind, updated_at);
CREATE INDEX IF NOT EXISTS publications_date ON publications(published_at, event_id);
