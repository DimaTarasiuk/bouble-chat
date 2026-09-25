-- +goose Up
ALTER TABLE users
  ADD COLUMN last_seen_at TIMESTAMPTZ;

-- +goose Down
ALTER TABLE users DROP COLUMN IF EXISTS last_seen_at;
