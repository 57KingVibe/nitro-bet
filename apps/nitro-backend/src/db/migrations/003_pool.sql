-- Lite markets can now be a points pool (parimutuel) instead of fixed odds. Existing markets stay 'fixed'.
ALTER TABLE markets  ADD COLUMN IF NOT EXISTS model TEXT NOT NULL DEFAULT 'fixed' CHECK (model IN ('fixed', 'pool'));
-- Opening points the house puts on each outcome so the first prices make sense. They are not player money.
ALTER TABLE outcomes ADD COLUMN IF NOT EXISTS seed_minor BIGINT NOT NULL DEFAULT 0 CHECK (seed_minor >= 0);
-- What was actually paid out at settlement (pool payouts differ from the estimate shown at placement).
ALTER TABLE wagers   ADD COLUMN IF NOT EXISTS payout_minor BIGINT;
