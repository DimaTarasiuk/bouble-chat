-- +goose Up
CREATE TABLE conversation_reads (
    conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_message_id BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (conversation_id, user_id)
);

-- +goose Down
DROP TABLE IF EXISTS conversation_reads;
