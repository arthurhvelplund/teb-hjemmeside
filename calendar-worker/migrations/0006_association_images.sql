-- Keep existing association records and use a city photo until they add an image.
ALTER TABLE associations ADD COLUMN image_url TEXT NOT NULL DEFAULT '';
