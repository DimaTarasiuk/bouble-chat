-- +goose Up
ALTER TABLE messages
  ALTER COLUMN username TYPE VARCHAR(100);

-- +goose Down
ALTER TABLE messages
  ALTER COLUMN username TYPE VARCHAR(10);
