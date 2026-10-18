-- Preserve existing directory entries. Only new creations receive retry keys.
ALTER TABLE associations ADD COLUMN creation_request_key TEXT;
ALTER TABLE associations ADD COLUMN creation_actor TEXT REFERENCES users(id);
ALTER TABLE associations ADD COLUMN creation_hash TEXT;
CREATE UNIQUE INDEX associations_creation_request ON associations(creation_request_key)
 WHERE creation_request_key IS NOT NULL;
