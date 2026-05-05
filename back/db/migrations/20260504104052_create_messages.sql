-- +goose Up
create TABLE messages(
    id BIGSERIAL PRIMARY KEY,
    from_user VARCHAR(10) NOT NULL CHECK (from_user IN ('me', 'them')),
    message_content VARCHAR (1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- +goose Down
DROP TABLE messages;
