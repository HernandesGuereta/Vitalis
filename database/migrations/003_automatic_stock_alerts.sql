ALTER TABLE public_alerts ADD COLUMN automatic boolean NOT NULL DEFAULT false;
ALTER TABLE public_alerts ADD COLUMN active boolean NOT NULL DEFAULT false;
ALTER TABLE public_alerts ADD COLUMN level text NOT NULL DEFAULT 'baixo' CHECK (level IN ('baixo','critico'));
ALTER TABLE public_alerts ADD COLUMN notified_level integer NOT NULL DEFAULT 0 CHECK (notified_level BETWEEN 0 AND 2);
CREATE UNIQUE INDEX one_active_stock_alert ON public_alerts(unit_id,blood_type) WHERE automatic AND active;
CREATE TABLE stock_state (
  unit_id text PRIMARY KEY REFERENCES units(id),
  revision integer NOT NULL DEFAULT 0,
  request_id uuid,
  request_hash text,
  quantities jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE push_subscriptions (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  city text NOT NULL,
  blood_type text,
  own_type boolean NOT NULL,
  other_types boolean NOT NULL,
  consent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_subscription_account ON push_subscriptions(account_id);
CREATE TABLE push_deliveries (
  id uuid PRIMARY KEY,
  alert_id text NOT NULL REFERENCES public_alerts(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
  level text NOT NULL CHECK (level IN ('baixo','critico')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','submitted','receipt_ok','failed','cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ticket_id text,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(alert_id,subscription_id,level)
);
CREATE INDEX push_pending ON push_deliveries(next_attempt_at) WHERE status IN ('pending','submitted');
