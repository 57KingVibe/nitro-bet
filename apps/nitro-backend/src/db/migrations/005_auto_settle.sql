-- Markets that settle themselves from the official race result. NULL = settled by hand (all existing markets).
ALTER TABLE markets ADD COLUMN IF NOT EXISTS auto_settle TEXT CHECK (auto_settle IN ('f1_race_winner'));
