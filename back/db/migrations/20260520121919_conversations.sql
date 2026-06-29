-- +goose Up
CREATE TABLE conversations (
    id BIGSERIAL NOT NULL PRIMARY KEY,
    initiator_id BIGINT NOT NULL REFERENCES users(id),
    recipient_id BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    
);

-- +goose Down
DROP TABLE conversations;
