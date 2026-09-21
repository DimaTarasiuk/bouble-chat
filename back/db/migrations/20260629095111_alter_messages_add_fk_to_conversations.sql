-- Active: 1782728231131@@localhost@909@chat_db
-- +goose Up
ALTER Table messages ADD CONSTRAINT fk_conversations
    Foreign Key (conversation_id) REFERENCES conversations(id);

-- +goose Down
ALTER Table messages DROP CONSTRAINT fk_conversations;
