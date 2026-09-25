-- +goose Up
ALTER TABLE messages
  ADD COLUMN user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;

UPDATE messages m
SET user_id = u.id
FROM users u
WHERE u.username = m.username;

CREATE INDEX messages_conversation_id_id_idx ON messages (conversation_id, id);
CREATE INDEX messages_user_id_idx ON messages (user_id);
CREATE INDEX conversations_initiator_idx ON conversations (initiator_id);
CREATE INDEX conversations_recipient_idx ON conversations (recipient_id);

-- +goose Down
DROP INDEX IF EXISTS conversations_recipient_idx;
DROP INDEX IF EXISTS conversations_initiator_idx;
DROP INDEX IF EXISTS messages_user_id_idx;
DROP INDEX IF EXISTS messages_conversation_id_id_idx;

UPDATE messages m
SET username = u.username
FROM users u
WHERE u.id = m.user_id;

ALTER TABLE messages DROP COLUMN IF EXISTS user_id;
