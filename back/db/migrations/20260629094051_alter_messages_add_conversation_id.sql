-- +goose Up
ALTER TABLE messages ADD COLUMN conversation_id BIGINT;


-- +goose Down
ALTER TABLE messages DROP COLUMN conversation_id; 
