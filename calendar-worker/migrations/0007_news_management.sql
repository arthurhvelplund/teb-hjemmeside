-- Private moderation feedback does not become public post content.
ALTER TABLE posts ADD COLUMN moderation_note TEXT NOT NULL DEFAULT '';
CREATE INDEX posts_association ON posts(association_id, status, created_at);
