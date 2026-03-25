-- ================================
-- MIGRATION: Team mode for matches
-- ================================

-- 1. Modo de equipos en el partido
--    'none'       → sin equipos (comportamiento actual)
--    'two_teams'  → Equipo A y Equipo B predefinidos
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS team_mode TEXT NOT NULL DEFAULT 'none'
CHECK (team_mode IN ('none', 'two_teams'));

-- 2. Slot de equipo en cada participante
--    NULL → sin equipo asignado (team_mode = 'none' o pendiente de asignar)
--    'A'  → Equipo A
--    'B'  → Equipo B
ALTER TABLE match_participants
ADD COLUMN IF NOT EXISTS team_slot TEXT
CHECK (team_slot IN ('A', 'B') OR team_slot IS NULL);

-- 3. Índice para consultas por equipo
CREATE INDEX IF NOT EXISTS idx_match_participants_team_slot
ON match_participants (match_id, team_slot)
WHERE team_slot IS NOT NULL;