-- Optional credentials belong to a login email, never to the public contact profile.
CREATE TABLE password_credentials (
 user_id TEXT PRIMARY KEY REFERENCES users(id),
 salt TEXT NOT NULL, password_hash TEXT NOT NULL, version TEXT NOT NULL,
 assigned_membership_id TEXT REFERENCES memberships(id), updated_at TEXT NOT NULL
);
