-- +goose Up
ALTER TABLE random.guests ADD COLUMN anon_id UUID;
UPDATE random.guests SET anon_id = id WHERE anon_id IS NULL;
ALTER TABLE random.guests ALTER COLUMN anon_id SET NOT NULL;
CREATE INDEX random_guests_anon_id_idx ON random.guests (anon_id);

-- +goose Down
DROP INDEX IF EXISTS random_guests_anon_id_idx;
ALTER TABLE random.guests DROP COLUMN IF EXISTS anon_id;
