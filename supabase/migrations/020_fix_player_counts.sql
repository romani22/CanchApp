-- Arregla los contadores de jugadores (current_players / players_needed).
--
-- Síntoma reportado: en Explorar una tarjeta mostraba "Faltan 8" con un solo
-- jugador anotado en un partido de 10, mientras el detalle mostraba el número
-- correcto (el detalle cuenta match_participants, la tarjeta leía la columna).
--
-- Había dos descuentos superpuestos:
--
--   1. `current_players` tenía DEFAULT 1 asumiendo "el creador ya cuenta", y
--      Create.tsx además insertaba players_needed = total - 1 - confirmados.
--   2. El trigger on_participant_change volvía a descontar en CADA insert de
--      match_participants — incluido el del creador y el de cada confirmado.
--
--   total 10, creador solo → insert: needed 9 / current 1
--                          → trigger del creador: needed 8 / current 2
--
-- El fix del lado app (Create.tsx manda current_players 0 y players_needed =
-- total, y deja que el trigger cuente) ya alcanza para los partidos nuevos.
-- Acá se arregla la base para que las columnas no puedan volver a desfasarse:
--
--   * El trigger deja de sumar/restar de a uno y RECALCULA contra el COUNT real
--     de match_participants. Es idempotente: no importa cuántas veces corra ni
--     en qué orden, el resultado siempre coincide con las filas que existen.
--   * De paso arregla dos bugs de la versión anterior:
--       - el DELETE tenía piso GREATEST(current_players - 1, 1): un partido sin
--         participantes quedaba en 1.
--       - el DELETE forzaba status = 'open' sin mirar el estado previo, así que
--         sacar un jugador de un partido cancelado lo volvía a publicar.
--   * Backfill de los partidos ya creados con los números viejos.

-- ── 1. El default deja de mentir ───────────────────────────────────────────
-- Un partido recién insertado no tiene participantes todavía: los inserta la app
-- inmediatamente después (creador + confirmados) y el trigger los cuenta.
ALTER TABLE matches
    ALTER COLUMN current_players SET DEFAULT 0;

-- ── 2. Trigger que recalcula en vez de acumular ────────────────────────────
CREATE OR REPLACE FUNCTION update_match_player_count()
    RETURNS TRIGGER AS
$$
DECLARE
    v_match_id UUID;
    v_count    INTEGER;
    v_total    INTEGER;
    v_status   match_status;
BEGIN
    v_match_id := COALESCE(NEW.match_id, OLD.match_id);

    -- FOR UPDATE antes de contar, no por gusto: al crear un partido la app inserta
    -- el creador y todos los confirmados en paralelo (Promise.all). Dos triggers
    -- simultáneos contarían los dos sobre el mismo COUNT viejo y el último en
    -- escribir dejaría un jugador sin contar. Con la fila de matches tomada, el
    -- segundo espera y su COUNT ya ve la fila que commiteó el primero.
    SELECT total_players, status
    INTO v_total, v_status
    FROM matches
    WHERE id = v_match_id
        FOR UPDATE;

    -- El partido puede no existir si el DELETE vino en cascada al borrarlo.
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    SELECT COUNT(*)
    INTO v_count
    FROM match_participants
    WHERE match_id = v_match_id;

    UPDATE matches
    SET current_players = v_count,
        players_needed  = GREATEST(v_total - v_count, 0),
        -- 'cancelled' y 'completed' son estados finales: no los toca nadie acá.
        status          = CASE
                              WHEN v_status IN ('cancelled', 'completed') THEN v_status
                              WHEN v_count >= v_total THEN 'full'::match_status
                              ELSE 'open'::match_status
                              END,
        updated_at      = NOW()
    WHERE id = v_match_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- El trigger de 001 sigue sirviendo (AFTER INSERT OR DELETE), sólo cambió la
-- función. Se recrea igual para que aplicar esta migración sobre una base a la
-- que le falte el trigger también lo deje andando.
DROP TRIGGER IF EXISTS on_participant_change ON match_participants;
CREATE TRIGGER on_participant_change
    AFTER INSERT OR DELETE
    ON match_participants
    FOR EACH ROW
EXECUTE FUNCTION update_match_player_count();

-- ── 3. Backfill de los partidos existentes ─────────────────────────────────
WITH counts AS (SELECT m.id,
                       m.total_players,
                       m.status,
                       (SELECT COUNT(*) FROM match_participants p WHERE p.match_id = m.id) AS real_count
                FROM matches m)
UPDATE matches m
SET current_players = c.real_count,
    players_needed  = GREATEST(c.total_players - c.real_count, 0),
    status          = CASE
                          WHEN c.status IN ('cancelled', 'completed') THEN c.status
                          WHEN c.real_count >= c.total_players THEN 'full'::match_status
                          ELSE 'open'::match_status
                          END
FROM counts c
WHERE m.id = c.id
  AND (m.current_players <> c.real_count
    OR m.players_needed <> GREATEST(c.total_players - c.real_count, 0));
