export const SCHEMA_SQL = String.raw`
-- Miss Nederland headshot-keuze – databaseschema (idempotent)

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO settings (key, value) VALUES ('extra_photo_price', '15.00') ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS shoots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  province TEXT NOT NULL CHECK (province IN ('Drenthe','Flevoland','Friesland','Gelderland','Groningen','Limburg','Noord-Brabant','Noord-Holland','Overijssel','Utrecht','Zeeland','Zuid-Holland','Dutch Caribbean')),
  name TEXT NOT NULL,
  shootstack_gallery_url TEXT,
  expected_participants INTEGER CHECK (expected_participants IS NULL OR expected_participants >= 0),
  expected_teens INTEGER CHECK (expected_teens IS NULL OR expected_teens >= 0),
  expected_misses INTEGER CHECK (expected_misses IS NULL OR expected_misses >= 0),
  deadline_at TIMESTAMPTZ,
  allow_submissions_after_deadline BOOLEAN NOT NULL DEFAULT false,
  public_link_token TEXT NOT NULL UNIQUE,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shoots_province_idx ON shoots (province);

CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shoot_id UUID NOT NULL REFERENCES shoots(id) ON DELETE RESTRICT,
  participant_number TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Teen','Miss')),
  province TEXT NOT NULL CHECK (province IN ('Drenthe','Flevoland','Friesland','Gelderland','Groningen','Limburg','Noord-Brabant','Noord-Holland','Overijssel','Utrecht','Zeeland','Zuid-Holland','Dutch Caribbean')),
  photo_code TEXT NOT NULL CHECK (photo_code ~ '^TLP[0-9]{1,6}$'),
  extra_photo_codes TEXT[] NOT NULL DEFAULT '{}',
  extra_photo_count INTEGER NOT NULL DEFAULT 0,
  extra_photo_price_each NUMERIC(10,2) NOT NULL DEFAULT 15.00,
  extra_photo_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  review_status TEXT NOT NULL DEFAULT 'ok' CHECK (review_status IN ('ok','possible_duplicate')),
  duplicate_reason TEXT,
  duplicate_of UUID REFERENCES submissions(id) ON DELETE SET NULL,
  admin_note TEXT,
  idempotency_key TEXT UNIQUE
);
CREATE INDEX IF NOT EXISTS submissions_shoot_idx ON submissions (shoot_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS submissions_province_idx ON submissions (province) WHERE deleted_at IS NULL;

ALTER TABLE submissions ALTER COLUMN participant_number DROP NOT NULL;

CREATE TABLE IF NOT EXISTS login_attempts (
  id BIGSERIAL PRIMARY KEY,
  ip TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_attempts_ip_idx ON login_attempts (ip, created_at);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;
