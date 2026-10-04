-- Core product schema. New tables only: the legacy users/bets/transactions tables are left untouched.

CREATE TABLE players (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT NOT NULL,
  password_hash       TEXT NOT NULL,
  display_name        TEXT NOT NULL,
  date_of_birth       DATE NOT NULL,
  country             TEXT,
  self_excluded_until TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX players_email_lower_idx ON players (lower(email));

-- Append-only ledger: a balance is the SUM of a player's entries, in integer minor units (cents).
CREATE TABLE ledger_entries (
  id              BIGSERIAL PRIMARY KEY,
  player_id       UUID NOT NULL REFERENCES players(id),
  currency        TEXT NOT NULL,
  amount          BIGINT NOT NULL CHECK (amount <> 0),
  kind            TEXT NOT NULL CHECK (kind IN
                    ('signup_credit','deposit','withdrawal','bet_stake','bet_payout','bet_refund','cashback','adjustment')),
  ref_id          UUID,
  idempotency_key TEXT UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ledger_entries_player_idx ON ledger_entries (player_id, currency);

CREATE FUNCTION ledger_entries_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_entries_no_change
  BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_entries_immutable();

CREATE TABLE markets (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport              TEXT NOT NULL DEFAULT 'F1',
  title              TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','settled','void')),
  closes_at          TIMESTAMPTZ,
  winning_outcome_id UUID,
  settled_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE outcomes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id  UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  odds_centi INTEGER NOT NULL CHECK (odds_centi > 100),   -- 1.59 is stored as 159
  sort       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX outcomes_market_idx ON outcomes (market_id);

CREATE TABLE wagers (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id              UUID NOT NULL REFERENCES players(id),
  market_id              UUID NOT NULL REFERENCES markets(id),
  outcome_id             UUID NOT NULL REFERENCES outcomes(id),
  currency               TEXT NOT NULL,
  stake_minor            BIGINT NOT NULL CHECK (stake_minor > 0),
  odds_centi             INTEGER NOT NULL CHECK (odds_centi > 100),  -- locked at placement, never changes
  potential_payout_minor BIGINT NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','won','lost','void')),
  idempotency_key        TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at             TIMESTAMPTZ,
  UNIQUE (player_id, idempotency_key)
);
CREATE INDEX wagers_player_idx ON wagers (player_id, created_at DESC);
CREATE INDEX wagers_market_idx ON wagers (market_id, status);

CREATE TABLE audit_log (
  id         BIGSERIAL PRIMARY KEY,
  actor      TEXT NOT NULL,
  action     TEXT NOT NULL,
  details    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
