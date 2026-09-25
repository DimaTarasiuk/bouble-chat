-- +goose Up
ALTER TABLE users
  ADD COLUMN first_name VARCHAR(100) NOT NULL DEFAULT '',
  ADD COLUMN last_name VARCHAR(100) NOT NULL DEFAULT '',
  ADD COLUMN birth_date DATE,
  ADD COLUMN gender VARCHAR(20) NOT NULL DEFAULT '';

ALTER TABLE users
  ADD CONSTRAINT users_gender_check
  CHECK (gender IN ('', 'male', 'female', 'other'));

-- +goose Down
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_gender_check;
ALTER TABLE users
  DROP COLUMN IF EXISTS first_name,
  DROP COLUMN IF EXISTS last_name,
  DROP COLUMN IF EXISTS birth_date,
  DROP COLUMN IF EXISTS gender;
