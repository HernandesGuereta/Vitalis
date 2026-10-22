CREATE TABLE units (
  id text PRIMARY KEY CHECK (id IN ('centro', 'jardim')),
  name text NOT NULL,
  city text NOT NULL
);
CREATE TABLE accounts (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE CHECK (email = lower(email)),
  name text NOT NULL CHECK (length(name) BETWEEN 3 AND 100),
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('donor', 'admin')),
  unit_id text REFERENCES units(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((role = 'admin' AND unit_id IS NOT NULL) OR (role = 'donor' AND unit_id IS NULL))
);
CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE slots (
  id uuid PRIMARY KEY,
  unit_id text NOT NULL REFERENCES units(id),
  starts_at timestamptz NOT NULL,
  capacity integer NOT NULL CHECK (capacity BETWEEN 1 AND 20),
  UNIQUE(unit_id, starts_at)
);
CREATE TABLE appointments (
  id uuid PRIMARY KEY,
  donor_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  slot_id uuid NOT NULL REFERENCES slots(id),
  service_date date NOT NULL,
  status text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'cancelled')),
  request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  UNIQUE(donor_id, request_id)
);
CREATE UNIQUE INDEX one_visit_per_day ON appointments(donor_id, service_date) WHERE status = 'booked';
CREATE INDEX appointments_slot ON appointments(slot_id) WHERE status = 'booked';
CREATE TABLE audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public_alerts (
  id text PRIMARY KEY,
  unit_id text NOT NULL REFERENCES units(id),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  message text NOT NULL CHECK (length(message) BETWEEN 1 AND 1000),
  blood_type text NOT NULL CHECK (blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  region text NOT NULL CHECK (length(region) BETWEEN 1 AND 100),
  published_at timestamptz NOT NULL DEFAULT now()
);
