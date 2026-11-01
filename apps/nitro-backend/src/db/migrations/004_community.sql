-- Referral program, Google sign-in, linked wallets.
ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_kind_check;
ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_kind_check CHECK (kind IN
  ('signup_credit','deposit','withdrawal','bet_stake','bet_payout','bet_refund','cashback','adjustment','referral_bonus'));

-- Google accounts have no password.
ALTER TABLE players ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE players ADD COLUMN IF NOT EXISTS google_sub TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS players_google_sub_idx ON players (google_sub) WHERE google_sub IS NOT NULL;

ALTER TABLE players ADD COLUMN IF NOT EXISTS referral_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS players_referral_code_idx ON players (referral_code) WHERE referral_code IS NOT NULL;
ALTER TABLE players ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES players(id);
ALTER TABLE players ADD COLUMN IF NOT EXISTS referral_paid_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS players_referred_by_idx ON players (referred_by) WHERE referred_by IS NOT NULL;

-- One verified wallet per player (proved by a signature, see services/web3.js).
CREATE TABLE IF NOT EXISTS player_wallets (
  player_id UUID PRIMARY KEY REFERENCES players(id),
  address   TEXT NOT NULL UNIQUE,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS wallet_challenges (
  player_id  UUID PRIMARY KEY REFERENCES players(id),
  address    TEXT NOT NULL,
  message    TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
