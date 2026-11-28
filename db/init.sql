-- Esquema de HIVE (PostgreSQL). Se ejecuta automáticamente al crear el volumen de la BD por primera vez.

CREATE TABLE IF NOT EXISTS users (
  id             SERIAL PRIMARY KEY,
  username       VARCHAR(30)  NOT NULL UNIQUE,
  email          VARCHAR(120) NOT NULL UNIQUE,
  password_hash  VARCHAR(100) NOT NULL,
  role           VARCHAR(10)  NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  full_name      VARCHAR(60)  NOT NULL DEFAULT '',
  bio            VARCHAR(160) NOT NULL DEFAULT '',
  -- Ajustes de privacidad
  is_private     BOOLEAN NOT NULL DEFAULT FALSE,  -- las solicitudes de seguimiento requieren aprobación
  allow_requests BOOLEAN NOT NULL DEFAULT TRUE,   -- si es FALSE nadie puede seguir a este usuario
  share_activity BOOLEAN NOT NULL DEFAULT TRUE,   -- mostrar a los seguidores a qué eventos asiste
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(80)  NOT NULL,
  venue       VARCHAR(80)  NOT NULL,
  address     VARCHAR(120) NOT NULL DEFAULT '',
  city        VARCHAR(60)  NOT NULL,
  starts_at   TIMESTAMPTZ  NOT NULL,
  price_tier  SMALLINT     NOT NULL DEFAULT 2 CHECK (price_tier BETWEEN 1 AND 3), -- 1 = $, 2 = $$, 3 = $$$
  genre       VARCHAR(40)  NOT NULL DEFAULT '',
  description VARCHAR(600) NOT NULL DEFAULT '',
  creator_id  INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_attendees (
  event_id   INTEGER     NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS follows (
  follower_id INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      VARCHAR(10) NOT NULL CHECK (status IN ('pending', 'accepted')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);

CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events(starts_at);
CREATE INDEX IF NOT EXISTS idx_attendees_user ON event_attendees(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows(followee_id, status);
