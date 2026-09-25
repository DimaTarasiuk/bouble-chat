-- +goose Up
ALTER TABLE messages
  ADD COLUMN reply_to_message_id BIGINT REFERENCES messages(id) ON DELETE SET NULL;

CREATE INDEX messages_reply_to_message_id_idx ON messages (reply_to_message_id);

-- +goose Down
DROP INDEX IF EXISTS messages_reply_to_message_id_idx;
ALTER TABLE messages DROP COLUMN IF EXISTS reply_to_message_id;
