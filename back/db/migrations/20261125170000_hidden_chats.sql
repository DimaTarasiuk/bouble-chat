-- +goose Up
ALTER TABLE users
    ADD COLUMN hidden_code TEXT,
    ADD COLUMN hidden_code_hash TEXT;

CREATE TABLE conversation_hidden (
    conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE conversation_dismissed (
    conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (conversation_id, user_id)
);

-- +goose Down
DROP TABLE IF EXISTS conversation_dismissed;
DROP TABLE IF EXISTS conversation_hidden;
ALTER TABLE users DROP COLUMN IF EXISTS hidden_code_hash;
ALTER TABLE users DROP COLUMN IF EXISTS hidden_code;
