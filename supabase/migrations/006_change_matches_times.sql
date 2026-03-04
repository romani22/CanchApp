ALTER TABLE matches
ADD COLUMN starts_at timestamptz;

UPDATE matches
SET starts_at = (date + start_time);

-- opcional cuando estés seguro
ALTER TABLE matches DROP COLUMN date;
ALTER TABLE matches DROP COLUMN start_time;

CREATE INDEX idx_matches_starts_at ON matches(starts_at);