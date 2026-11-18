-- +goose Up
ALTER TABLE random.messages
  ADD COLUMN reply_to_message_id BIGINT REFERENCES random.messages(id) ON DELETE SET NULL;

CREATE INDEX random_messages_reply_to_message_id_idx ON random.messages (reply_to_message_id);

-- +goose Down
DROP INDEX IF EXISTS random_messages_reply_to_message_id_idx;
ALTER TABLE random.messages DROP COLUMN IF EXISTS reply_to_message_id;
