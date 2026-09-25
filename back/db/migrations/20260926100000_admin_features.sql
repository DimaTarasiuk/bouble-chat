-- +goose Up
ALTER TABLE users
  ADD COLUMN banned_at TIMESTAMPTZ,
  ADD COLUMN ban_reason TEXT NOT NULL DEFAULT '',
  ADD COLUMN sessions_revoked_at TIMESTAMPTZ,
  ADD COLUMN last_announcement_id BIGINT NOT NULL DEFAULT 0;

CREATE TABLE announcements (
  id BIGSERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE online_snapshots (
  taken_at TIMESTAMPTZ PRIMARY KEY,
  online_count INT NOT NULL
);

CREATE INDEX messages_created_at_idx ON messages (created_at);

-- +goose Down
DROP INDEX IF EXISTS messages_created_at_idx;
DROP TABLE IF EXISTS online_snapshots;
DROP TABLE IF EXISTS announcements;
ALTER TABLE users
  DROP COLUMN IF EXISTS last_announcement_id,
  DROP COLUMN IF EXISTS sessions_revoked_at,
  DROP COLUMN IF EXISTS ban_reason,
  DROP COLUMN IF EXISTS banned_at;
