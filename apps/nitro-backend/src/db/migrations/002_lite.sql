-- Lite tier: ghost mode (hide your name on the public leaderboard) and a faster leaderboard query.
ALTER TABLE players ADD COLUMN ghost_mode BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX wagers_settled_idx ON wagers (settled_at) WHERE status IN ('won','lost');
