-- +goose Up
CREATE SCHEMA IF NOT EXISTS random;

CREATE TABLE random.guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  age_min INT NOT NULL CHECK (age_min BETWEEN 18 AND 99),
  age_max INT NOT NULL CHECK (age_max BETWEEN 18 AND 99),
  seek_gender TEXT NOT NULL CHECK (seek_gender IN ('male', 'female', 'any')),
  seek_age_min INT NOT NULL CHECK (seek_age_min BETWEEN 18 AND 99),
  seek_age_max INT NOT NULL CHECK (seek_age_max BETWEEN 18 AND 99),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (age_min <= age_max),
  CHECK (seek_age_min <= seek_age_max)
);

CREATE TABLE random.queue (
  guest_id UUID PRIMARY KEY REFERENCES random.guests(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX random_queue_created_at_idx ON random.queue (created_at);

CREATE TABLE random.sessions (
  id BIGSERIAL PRIMARY KEY,
  guest_a UUID NOT NULL REFERENCES random.guests(id) ON DELETE CASCADE,
  guest_b UUID NOT NULL REFERENCES random.guests(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  CHECK (guest_a <> guest_b)
);

CREATE UNIQUE INDEX random_sessions_active_a_idx ON random.sessions (guest_a) WHERE status = 'active';
CREATE UNIQUE INDEX random_sessions_active_b_idx ON random.sessions (guest_b) WHERE status = 'active';
CREATE INDEX random_sessions_activity_idx ON random.sessions ((COALESCE(last_message_at, created_at)));
CREATE INDEX random_sessions_guest_a_idx ON random.sessions (guest_a);
CREATE INDEX random_sessions_guest_b_idx ON random.sessions (guest_b);

CREATE TABLE random.messages (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES random.sessions(id) ON DELETE CASCADE,
  from_guest UUID NOT NULL REFERENCES random.guests(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX random_messages_session_id_idx ON random.messages (session_id, id);

-- +goose Down
DROP SCHEMA IF EXISTS random CASCADE;
