-- =========================================
-- 1️⃣ Asegurar columnas necesarias
-- =========================================

ALTER TABLE IF EXISTS matches
ADD COLUMN IF NOT EXISTS players uuid[];

ALTER TABLE IF EXISTS matches
ADD COLUMN IF NOT EXISTS winner_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS matches
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

ALTER TABLE IF EXISTS matches
ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();


-- =========================================
-- 2️⃣ Índices para performance
-- =========================================

CREATE INDEX IF NOT EXISTS idx_matches_players
ON matches USING GIN (players);

CREATE INDEX IF NOT EXISTS idx_matches_winner
ON matches (winner_id);


-- =========================================
-- 3️⃣ VIEW de estadísticas
-- =========================================

CREATE OR REPLACE VIEW user_stats AS
SELECT
  p.id AS user_id,
  COUNT(m.id) AS total_matches,
  COUNT(
    CASE 
      WHEN m.winner_id = p.id THEN 1
    END
  ) AS total_wins,
  CASE 
    WHEN COUNT(m.id) > 0 
      THEN ROUND(
        (
          COUNT(CASE WHEN m.winner_id = p.id THEN 1 END)::decimal
          / COUNT(m.id)
        ) * 5,
        1
      )
    ELSE 5.0
  END AS rating
FROM profiles p
LEFT JOIN matches m
  ON p.id = ANY(m.players)
GROUP BY p.id;