-- +goose Up
CREATE TABLE app_version (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  build INT NOT NULL DEFAULT 0,
  version TEXT NOT NULL DEFAULT '',
  apk_url TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_version (id, build, version, apk_url) VALUES (1, 0, '', '');

-- +goose Down
DROP TABLE IF EXISTS app_version;
