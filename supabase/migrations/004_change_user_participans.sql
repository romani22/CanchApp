-- ================================
-- MIGRATION: Support guest players
-- ================================

-- 1️⃣ Agregar columna guest_name si no existe
ALTER TABLE match_participants
ADD COLUMN IF NOT EXISTS guest_name text;

-- 2️⃣ Permitir que user_id sea nullable
ALTER TABLE match_participants
ALTER COLUMN user_id DROP NOT NULL;

-- 3️⃣ Eliminar constraint anterior si existiera
ALTER TABLE match_participants
DROP CONSTRAINT IF EXISTS match_participants_user_or_guest_check;

-- 4️⃣ Agregar constraint: o user_id o guest_name
ALTER TABLE match_participants
ADD CONSTRAINT match_participants_user_or_guest_check
CHECK (
  (user_id IS NOT NULL AND guest_name IS NULL)
  OR
  (user_id IS NULL AND guest_name IS NOT NULL)
);

-- 5️⃣ Índice único para evitar que un usuario se una dos veces al mismo partido
CREATE UNIQUE INDEX IF NOT EXISTS unique_user_per_match
ON match_participants (match_id, user_id)
WHERE user_id IS NOT NULL;

-- 6️⃣ Índice para mejorar performance por match
CREATE INDEX IF NOT EXISTS idx_match_participants_match_id
ON match_participants (match_id);

-- 7️⃣ Asegurar cascade delete (por si no estaba)
ALTER TABLE match_participants
DROP CONSTRAINT IF EXISTS match_participants_match_id_fkey;

ALTER TABLE match_participants
ADD CONSTRAINT match_participants_match_id_fkey
FOREIGN KEY (match_id)
REFERENCES matches(id)
ON DELETE CASCADE;

ALTER TABLE public.match_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view match scores"
ON public.match_scores
FOR SELECT
TO authenticated
USING (true);


CREATE OR REPLACE FUNCTION get_my_stats()
RETURNS TABLE (
    user_id uuid,
    total_matches bigint,
    total_wins bigint,
    elo_rating integer,
    rating numeric,
    rating_count integer
)
LANGUAGE sql
SECURITY INVOKER
AS $$
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
    WHERE p.id = auth.uid()
    GROUP BY p.id;
$$;