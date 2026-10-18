-- Additive migration. The pilot tables and all existing content remain intact.
CREATE TABLE users (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL DEFAULT '',
 is_admin INTEGER NOT NULL DEFAULT 0 CHECK(is_admin IN (0,1)), created_at TEXT NOT NULL
);
CREATE TABLE sessions (
 hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id,expires_at);
CREATE TABLE otp_challenges (
 id TEXT PRIMARY KEY, email TEXT NOT NULL, code_hash TEXT NOT NULL,
 created_at TEXT NOT NULL, expires_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
 consumed_at TEXT, verified_at TEXT
);
CREATE INDEX otp_email ON otp_challenges(email,created_at);
CREATE TABLE associations (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT '',
 description TEXT NOT NULL DEFAULT '', chair TEXT NOT NULL DEFAULT '',
 email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', website TEXT NOT NULL DEFAULT '',
 place TEXT NOT NULL DEFAULT '', revision INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE memberships (
 id TEXT PRIMARY KEY, association_id TEXT NOT NULL REFERENCES associations(id),
 email TEXT NOT NULL, user_id TEXT REFERENCES users(id), name TEXT NOT NULL DEFAULT '',
 role TEXT NOT NULL CHECK(role IN ('manager','editor')),
 status TEXT NOT NULL CHECK(status IN ('invited','active','revoked')),
 invited_at TEXT NOT NULL, activated_at TEXT, revoked_at TEXT,
 UNIQUE(association_id,email)
);
CREATE INDEX memberships_user ON memberships(user_id,status);
CREATE TABLE invitations (
 id TEXT PRIMARY KEY, membership_id TEXT NOT NULL REFERENCES memberships(id),
 email TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
 accepted_at TEXT, revoked_at TEXT
);
CREATE UNIQUE INDEX invitations_open ON invitations(membership_id) WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE TABLE access_requests (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), email TEXT NOT NULL,
 name TEXT NOT NULL, association_id TEXT REFERENCES associations(id), new_association_name TEXT NOT NULL DEFAULT '',
 role_note TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 verified INTEGER NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, decided_at TEXT
);
CREATE UNIQUE INDEX access_requests_pending ON access_requests(user_id,ifnull(association_id,''),new_association_name) WHERE status='pending';
CREATE TABLE mail_jobs (
 id TEXT PRIMARY KEY, dedupe_key TEXT NOT NULL UNIQUE, payload TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','sent','failed','uncertain','local','cancelled')),
 event_id TEXT REFERENCES events(id), event_revision INTEGER, state_column TEXT CHECK(state_column IN ('notification_state','receipt_state')),
 attempts INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 lease_until TEXT, expires_at TEXT, provider_id TEXT
);
ALTER TABLE events ADD COLUMN association_id TEXT REFERENCES associations(id);
ALTER TABLE events ADD COLUMN created_by TEXT REFERENCES users(id);
ALTER TABLE editions ADD COLUMN start TEXT;
ALTER TABLE editions ADD COLUMN end TEXT;
ALTER TABLE editions ADD COLUMN format TEXT NOT NULL DEFAULT 'poster';
ALTER TABLE editions ADD COLUMN pdf_key TEXT;
ALTER TABLE editions ADD COLUMN pdf_hash TEXT;
ALTER TABLE editions ADD COLUMN pages INTEGER;
ALTER TABLE editions ADD COLUMN event_count INTEGER;
ALTER TABLE editions ADD COLUMN request_key TEXT;
ALTER TABLE editions ADD COLUMN request_hash TEXT;
CREATE UNIQUE INDEX editions_request ON editions(request_key) WHERE request_key IS NOT NULL;
-- Normalize pilot's pending edit name without changing approved/public content.
UPDATE events SET pending_kind='edit' WHERE pending_kind='update';
UPDATE events SET status='approved' WHERE status='cancelled';
-- Every durable publication records its historical version in the same transaction.
CREATE TRIGGER events_publication_insert AFTER INSERT ON events WHEN NEW.published_json IS NOT NULL BEGIN
 INSERT INTO publications(event_id,revision,data_json,published_at) VALUES(NEW.id,NEW.revision,NEW.published_json,NEW.updated_at);
END;
CREATE TRIGGER events_publication_update AFTER UPDATE OF published_json ON events
 WHEN NEW.published_json IS NOT NULL AND (OLD.published_json IS NULL OR OLD.published_json != NEW.published_json) BEGIN
 INSERT INTO publications(event_id,revision,data_json,published_at) VALUES(NEW.id,NEW.revision,NEW.published_json,NEW.updated_at);
END;
ALTER TABLE otp_challenges ADD COLUMN redemption_hash TEXT;
CREATE TABLE otp_invitations (
 challenge_id TEXT NOT NULL REFERENCES otp_challenges(id), invitation_id TEXT NOT NULL REFERENCES invitations(id),
 PRIMARY KEY(challenge_id,invitation_id)
);
ALTER TABLE memberships ADD COLUMN invitation_id TEXT;
ALTER TABLE access_requests ADD COLUMN decision_key TEXT;
CREATE TABLE edition_builds (
 request_key TEXT PRIMARY KEY, id TEXT NOT NULL UNIQUE, owner TEXT NOT NULL,
 request_hash TEXT NOT NULL, data_json TEXT NOT NULL, created_at TEXT NOT NULL
);
