-- +goose Up
ALTER TABLE messages DROP CONSTRAINT messages_from_user_check;
ALTER TABLE messages RENAME COLUMN from_user TO username;

-- +goose Down
ALTER TABLE messages RENAME COLUMN username TO from_user;
ALTER TABLE messages ADD CONSTRAINT messages_from_user_check 
    CHECK (from_user IN ('me', 'them'));
