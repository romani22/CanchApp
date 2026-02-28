-- =============================================
-- 1️⃣ ELIMINAR COLUMNA LEGACY
-- =============================================

DROP VIEW IF EXISTS user_stats;

ALTER TABLE matches DROP COLUMN IF EXISTS players;
DROP INDEX IF EXISTS idx_matches_players;


-- =============================================
-- 2️⃣ ASEGURAR winner_id
-- =============================================

ALTER TABLE matches DROP COLUMN IF EXISTS winner_id;

ALTER TABLE matches
ADD COLUMN winner_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_matches_winner
ON matches(winner_id);


-- =============================================
-- 3️⃣ MATCH SCORES
-- =============================================

CREATE TABLE IF NOT EXISTS match_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    home_score INTEGER NOT NULL DEFAULT 0,
    away_score INTEGER NOT NULL DEFAULT 0,
    home_sets INTEGER DEFAULT 0,
    away_sets INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(match_id)
);


-- =============================================
-- 4️⃣ ELO
-- =============================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS elo_rating INTEGER DEFAULT 1000;


CREATE OR REPLACE FUNCTION calculate_elo(
    player_rating INTEGER,
    opponent_rating INTEGER,
    score FLOAT,
    k_factor INTEGER DEFAULT 32
)
RETURNS INTEGER AS $$
DECLARE
    expected_score FLOAT;
BEGIN
    expected_score := 1.0 / (1.0 + POWER(10, (opponent_rating - player_rating) / 400.0));
    RETURN ROUND(player_rating + k_factor * (score - expected_score));
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION update_elo_after_match()
RETURNS TRIGGER AS $$
DECLARE
    winner UUID;
    loser UUID;
    winner_rating INTEGER;
    loser_rating INTEGER;
BEGIN
    IF NEW.status <> 'completed' OR NEW.winner_id IS NULL THEN
        RETURN NEW;
    END IF;

    winner := NEW.winner_id;

    SELECT user_id INTO loser
    FROM match_participants
    WHERE match_id = NEW.id
    AND user_id <> winner
    LIMIT 1;

    IF loser IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT elo_rating INTO winner_rating FROM profiles WHERE id = winner;
    SELECT elo_rating INTO loser_rating FROM profiles WHERE id = loser;

    UPDATE profiles
    SET elo_rating = calculate_elo(winner_rating, loser_rating, 1)
    WHERE id = winner;

    UPDATE profiles
    SET elo_rating = calculate_elo(loser_rating, winner_rating, 0)
    WHERE id = loser;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


DROP TRIGGER IF EXISTS on_match_completed_elo ON matches;

CREATE TRIGGER on_match_completed_elo
AFTER UPDATE ON matches
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM 'completed' AND NEW.status = 'completed')
EXECUTE FUNCTION update_elo_after_match();


-- =============================================
-- 5️⃣ CONSTRAINT
-- =============================================

ALTER TABLE matches
DROP CONSTRAINT IF EXISTS winner_only_if_completed;

ALTER TABLE matches
ADD CONSTRAINT winner_only_if_completed
CHECK (
    winner_id IS NULL
    OR status = 'completed'
);


-- =============================================
-- 6️⃣ NUEVA VIEW PROFESIONAL
-- =============================================

CREATE OR REPLACE VIEW public.user_stats AS
SELECT
    p.id AS user_id,
    COUNT(DISTINCT mp.match_id) FILTER (
        WHERE m.status = 'completed'
    ) AS total_matches,
    COUNT(DISTINCT mp.match_id) FILTER (
        WHERE m.status = 'completed'
        AND m.winner_id = p.id
    ) AS total_wins,
    p.elo_rating,
    p.rating,
    p.rating_count
FROM profiles p
LEFT JOIN match_participants mp ON mp.user_id = p.id
LEFT JOIN matches m ON m.id = mp.match_id
GROUP BY p.id;