-- +goose Up
CREATE UNIQUE INDEX conversations_pair_uidx
ON conversations (
  LEAST(initiator_id, recipient_id),
  GREATEST(initiator_id, recipient_id)
);

-- +goose Down
DROP INDEX IF EXISTS conversations_pair_uidx;
