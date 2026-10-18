-- Isolated local experiment. Never mixed into the live event/print tables.
CREATE TABLE IF NOT EXISTS experiment_posts (
 id TEXT PRIMARY KEY,
 request_key TEXT NOT NULL UNIQUE,
 request_hash TEXT NOT NULL,
 owner_hash TEXT NOT NULL,
 contact_email TEXT NOT NULL,
 association_id TEXT,
 data_json TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected','withdrawn')),
 revision INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
