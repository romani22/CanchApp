-- =====================================================
-- Migration 023: los demás jugadores confirman u objetan el resultado
-- =====================================================
--
-- Problema: el resultado lo cargaba sólo el creador y nadie podía decir nada. Si
-- el creador se equivocaba —o desaparecía sin cargarlo— no había salida.
--
-- Regla de oro para no terminar con dos personas editando el mismo marcador: hay
-- UN SOLO autor por resultado, y los demás sólo aportan un booleano. El conflicto
-- de edición no se evita por acuerdo, no puede existir.
--
--   * Carga el creador. Si a las 24 horas del partido no lo hizo, puede cargarlo
--     cualquier jugador registrado del partido (queda como reported_by).
--   * Un resultado ya cargado lo edita su autor o el creador. Nadie más lo pisa.
--   * El resto confirma u objeta. Las confirmaciones son señal social; la que tiene
--     efecto es la objeción.
--
-- Y la decisión importante: **sin objeciones el resultado vale**. No hace falta que
-- confirmen todos ni un quórum — nunca van a estar todos abriendo la app, y un
-- resultado bien cargado no puede quedarse sin contar por eso. Una objeción sí lo
-- saca de las estadísticas, hasta que el autor lo corrija.
-- =====================================================


-- ── 1. Voto de cada jugador ────────────────────────────────────────────────
DO
$$
    BEGIN
        CREATE TYPE result_vote AS ENUM ('confirm', 'dispute');
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END
$$;

CREATE TABLE IF NOT EXISTS match_result_confirmations
(
    id         UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    result_id  UUID        NOT NULL REFERENCES match_results (id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    vote       result_vote NOT NULL,
    -- Sólo tiene sentido en una objeción: qué dice que estuvo mal.
    comment    TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Un voto por jugador. Cambiar de opinión actualiza el voto, no suma otro.
    CONSTRAINT unique_vote_per_player UNIQUE (result_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_result_confirmations_result ON match_result_confirmations (result_id);

COMMENT ON TABLE match_result_confirmations IS 'Voto de cada jugador sobre el resultado cargado. Se borran al corregir el resultado: confirmar "3-2" no es confirmar "2-2".';


-- ── 2. ¿Este resultado está objetado? ──────────────────────────────────────
-- Columna derivada en vez de un EXISTS en cada vista: la consultan las dos vistas
-- de estadísticas y el recálculo de los totales del perfil. Se RECALCULA (no se
-- incrementa), así que no puede desfasarse de los votos que existen.
ALTER TABLE match_results
    ADD COLUMN IF NOT EXISTS has_dispute BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN match_results.has_dispute IS 'TRUE si algún jugador objetó. Un resultado objetado no cuenta para las estadísticas hasta que se corrija.';


-- ── 3. RLS ─────────────────────────────────────────────────────────────────
ALTER TABLE match_result_confirmations ENABLE ROW LEVEL SECURITY;

-- Los votos son públicos: la tarjeta del resultado muestra "5 de 8 confirmaron" y
-- quién objetó.
DROP POLICY IF EXISTS "Result votes are viewable by everyone" ON match_result_confirmations;
CREATE POLICY "Result votes are viewable by everyone"
    ON match_result_confirmations FOR SELECT USING (true);

-- Escribir el voto va por la RPC (valida que sea jugador del partido y que no sea
-- el propio autor del resultado), pero cada uno puede borrar el suyo.
DROP POLICY IF EXISTS "Players can delete their own vote" ON match_result_confirmations;
CREATE POLICY "Players can delete their own vote"
    ON match_result_confirmations FOR DELETE
    USING (auth.uid() = user_id);


-- ── 4. Mantener has_dispute y los totales de los perfiles ──────────────────
-- Una objeción saca el partido de las estadísticas de TODOS los que jugaron, así
-- que hay que recalcular los totales de cada uno cuando aparece o se retira.
CREATE OR REPLACE FUNCTION sync_result_dispute_flag()
    RETURNS TRIGGER AS
$$
DECLARE
    v_result_id UUID;
    v_match_id  UUID;
    v_user      RECORD;
BEGIN
    v_result_id := COALESCE(NEW.result_id, OLD.result_id);

    UPDATE match_results
    SET has_dispute = EXISTS (SELECT 1
                              FROM match_result_confirmations c
                              WHERE c.result_id = v_result_id
                                AND c.vote = 'dispute'),
        updated_at  = NOW()
    WHERE id = v_result_id
    RETURNING match_id INTO v_match_id;

    IF v_match_id IS NULL THEN
        RETURN NULL;
    END IF;

    FOR v_user IN SELECT DISTINCT user_id
                  FROM match_player_stats
                  WHERE match_id = v_match_id
                    AND user_id IS NOT NULL
        LOOP
            PERFORM recompute_profile_match_totals(v_user.user_id);
        END LOOP;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_result_vote_change ON match_result_confirmations;
CREATE TRIGGER on_result_vote_change
    AFTER INSERT OR UPDATE OR DELETE
    ON match_result_confirmations
    FOR EACH ROW
EXECUTE FUNCTION sync_result_dispute_flag();


-- ── 5. Las estadísticas ignoran los resultados objetados ───────────────────
CREATE OR REPLACE FUNCTION recompute_profile_match_totals(p_user_id UUID)
    RETURNS VOID AS
$$
BEGIN
    IF p_user_id IS NULL THEN
        RETURN;
    END IF;

    UPDATE profiles p
    SET total_matches = c.played,
        total_wins    = c.won,
        updated_at    = NOW()
    FROM (SELECT COUNT(*)                                  AS played,
                 COUNT(*) FILTER (WHERE s.outcome = 'win') AS won
          FROM match_player_stats s
                   JOIN matches m ON m.id = s.match_id
                   JOIN match_results r ON r.match_id = s.match_id
          WHERE s.user_id = p_user_id
            AND m.status = 'completed'
            AND NOT r.has_dispute) c
    WHERE p.id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE VIEW public.user_sport_stats AS
SELECT s.user_id,
       m.sport,
       COUNT(*)                                             AS matches_played,
       COUNT(*) FILTER (WHERE s.outcome = 'win')             AS wins,
       COUNT(*) FILTER (WHERE s.outcome = 'loss')            AS losses,
       COUNT(*) FILTER (WHERE s.outcome = 'draw')            AS draws,
       ROUND(100.0 * COUNT(*) FILTER (WHERE s.outcome = 'win') / COUNT(*))::INTEGER
                                                            AS win_rate,
       SUM(s.goals)                                         AS goals,
       SUM(s.assists)                                       AS assists,
       SUM(s.saves)                                         AS saves,
       SUM(s.points)                                        AS points,
       ROUND(AVG(s.goals), 2)                               AS goals_per_match,
       ROUND(AVG(s.assists), 2)                             AS assists_per_match,
       ROUND(AVG(s.saves), 2)                               AS saves_per_match,
       ROUND(AVG(s.points), 2)                              AS points_per_match,
       COUNT(s.goals)                                       AS matches_with_goals,
       COUNT(s.assists)                                     AS matches_with_assists,
       COUNT(s.saves)                                       AS matches_with_saves,
       COUNT(s.points)                                      AS matches_with_points
FROM match_player_stats s
         JOIN matches m ON m.id = s.match_id
         JOIN match_results r ON r.match_id = s.match_id
WHERE s.user_id IS NOT NULL
  AND m.status = 'completed'
  AND NOT r.has_dispute
GROUP BY s.user_id, m.sport;

DROP VIEW IF EXISTS public.user_stats;
CREATE VIEW public.user_stats AS
SELECT p.id                         AS user_id,
       COALESCE(s.total_matches, 0) AS total_matches,
       COALESCE(s.total_wins, 0)    AS total_wins,
       COALESCE(s.total_losses, 0)  AS total_losses,
       COALESCE(s.total_draws, 0)   AS total_draws,
       p.elo_rating,
       p.rating,
       p.rating_count
FROM profiles p
         LEFT JOIN (SELECT st.user_id,
                           COUNT(*)                                   AS total_matches,
                           COUNT(*) FILTER (WHERE st.outcome = 'win')  AS total_wins,
                           COUNT(*) FILTER (WHERE st.outcome = 'loss') AS total_losses,
                           COUNT(*) FILTER (WHERE st.outcome = 'draw') AS total_draws
                    FROM match_player_stats st
                             JOIN matches m ON m.id = st.match_id
                             JOIN match_results r ON r.match_id = st.match_id
                    WHERE st.user_id IS NOT NULL
                      AND m.status = 'completed'
                      AND NOT r.has_dispute
                    GROUP BY st.user_id) s ON s.user_id = p.id;

GRANT SELECT ON public.user_stats TO anon, authenticated;
GRANT SELECT ON public.user_sport_stats TO anon, authenticated;


-- ── 6. Quién puede cargar el resultado ─────────────────────────────────────
-- Cambia respecto de 021: además del creador, pasadas 24 horas del partido puede
-- cargarlo cualquier jugador registrado si nadie lo cargó todavía. Un resultado ya
-- cargado lo edita su autor (reported_by) o el creador — nunca un tercero, que es
-- justo lo que abriría la guerra de ediciones.
--
-- Y guardar borra los votos: confirmar "3-2" no es confirmar "2-2".
CREATE OR REPLACE FUNCTION save_match_result(
    p_match_id UUID,
    p_score_a INTEGER DEFAULT NULL,
    p_score_b INTEGER DEFAULT NULL,
    p_sets JSONB DEFAULT '[]'::JSONB,
    p_notes TEXT DEFAULT NULL,
    p_players JSONB DEFAULT '[]'::JSONB
)
    RETURNS UUID AS
$$
DECLARE
    v_match       matches;
    v_result_id   UUID;
    v_reported_by UUID;
    v_is_new      BOOLEAN;
    v_row         JSONB;
    v_win_count   INTEGER;
    v_winner      UUID;
    v_user        RECORD;
BEGIN
    SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Partido no encontrado';
    END IF;

    IF v_match.status = 'cancelled' THEN
        RAISE EXCEPTION 'El partido fue cancelado';
    END IF;

    -- end_time quedó como TIME desde 001 (006 sólo migró date + start_time a
    -- starts_at), así que no se puede comparar con NOW(). El corte es starts_at.
    IF v_match.starts_at > NOW() THEN
        RAISE EXCEPTION 'El partido todavía no empezó';
    END IF;

    SELECT id, reported_by INTO v_result_id, v_reported_by FROM match_results WHERE match_id = p_match_id;
    v_is_new := v_result_id IS NULL;

    -- Permisos
    IF v_match.creator_id = auth.uid() THEN
        NULL; -- el creador siempre puede
    ELSIF NOT EXISTS (SELECT 1
                      FROM match_participants
                      WHERE match_id = p_match_id
                        AND user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Sólo el creador o los jugadores del partido pueden cargar el resultado';
    ELSIF NOT v_is_new AND v_reported_by IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'El resultado ya lo cargó otra persona: si no coincide, objetalo';
    ELSIF v_is_new AND NOW() < v_match.starts_at + INTERVAL '24 hours' THEN
        RAISE EXCEPTION 'Todavía es el turno del creador: a las 24 horas del partido lo puede cargar cualquier jugador';
    END IF;

    IF jsonb_array_length(COALESCE(p_players, '[]'::JSONB)) = 0 THEN
        RAISE EXCEPTION 'Hay que cargar el resultado de al menos un jugador';
    END IF;

    -- Nadie que no haya jugado el partido puede aparecer en sus estadísticas.
    FOR v_row IN SELECT * FROM jsonb_array_elements(p_players)
        LOOP
            IF NULLIF(v_row ->> 'user_id', '') IS NOT NULL THEN
                IF NOT EXISTS (SELECT 1
                               FROM match_participants
                               WHERE match_id = p_match_id
                                 AND user_id = (v_row ->> 'user_id')::UUID) THEN
                    RAISE EXCEPTION '% no es jugador de este partido', v_row ->> 'display_name';
                END IF;
            ELSIF NOT EXISTS (SELECT 1
                              FROM match_participants
                              WHERE match_id = p_match_id
                                AND guest_name = v_row ->> 'display_name') THEN
                RAISE EXCEPTION 'El invitado % no es jugador de este partido', v_row ->> 'display_name';
            END IF;
        END LOOP;

    -- reported_by pasa a ser quien guardó esta versión: es quien queda habilitado a
    -- corregirla y quien recibe el aviso si alguien la objeta.
    INSERT INTO match_results (match_id, score_a, score_b, sets, notes, reported_by)
    VALUES (p_match_id, p_score_a, p_score_b, COALESCE(p_sets, '[]'::JSONB), p_notes, auth.uid())
    ON CONFLICT (match_id) DO UPDATE
        SET score_a     = EXCLUDED.score_a,
            score_b     = EXCLUDED.score_b,
            sets        = EXCLUDED.sets,
            notes       = EXCLUDED.notes,
            reported_by = EXCLUDED.reported_by,
            has_dispute = FALSE,
            updated_at  = NOW()
    RETURNING id INTO v_result_id;

    -- Los votos son de la versión anterior del resultado, no de esta.
    DELETE FROM match_result_confirmations WHERE result_id = v_result_id;

    -- El partido pasa a 'completed' ANTES de escribir las stats, y el orden importa:
    -- el trigger que recalcula profiles.total_matches / total_wins sólo cuenta
    -- partidos completed, así que corriendo al revés contaba 0.
    UPDATE matches
    SET status     = 'completed',
        updated_at = NOW()
    WHERE id = p_match_id;

    -- Reemplazo completo: corregir un resultado no puede dejar filas viejas de
    -- jugadores que el autor sacó de la lista.
    DELETE FROM match_player_stats WHERE match_id = p_match_id;

    INSERT INTO match_player_stats (match_id, user_id, display_name, outcome,
                                    goals, assists, saves, points, extra)
    SELECT p_match_id,
           NULLIF(r ->> 'user_id', '')::UUID,
           r ->> 'display_name',
           (r ->> 'outcome')::match_outcome,
           NULLIF(r ->> 'goals', '')::INTEGER,
           NULLIF(r ->> 'assists', '')::INTEGER,
           NULLIF(r ->> 'saves', '')::INTEGER,
           NULLIF(r ->> 'points', '')::INTEGER,
           COALESCE(r -> 'extra', '{}'::JSONB)
    FROM jsonb_array_elements(p_players) r;

    -- winner_id sólo tiene sentido si ganó UNA persona (tenis, pádel 1vs1). El
    -- COUNT incluye invitados: si ganaron un usuario y un invitado, ganó un equipo.
    SELECT COUNT(*)
    INTO v_win_count
    FROM match_player_stats
    WHERE match_id = p_match_id
      AND outcome = 'win';

    IF v_win_count = 1 THEN
        SELECT user_id
        INTO v_winner
        FROM match_player_stats
        WHERE match_id = p_match_id
          AND outcome = 'win';
    ELSE
        v_winner := NULL;
    END IF;

    UPDATE matches
    SET winner_id  = v_winner,
        updated_at = NOW()
    WHERE id = p_match_id;

    IF v_is_new THEN
        -- El ELO se aplica una sola vez. Corregir el resultado no lo vuelve a mover:
        -- no es idempotente y se duplicaría en cada edición.
        PERFORM apply_match_elo(p_match_id);
    END IF;

    -- Se avisa en cada guardado, no sólo en el primero: una corrección es justo lo
    -- que los demás querrían ir a mirar. No se avisa a quien lo cargó.
    FOR v_user IN SELECT DISTINCT mp.user_id
                  FROM match_participants mp
                           JOIN profiles pr ON pr.id = mp.user_id
                  WHERE mp.match_id = p_match_id
                    AND mp.user_id IS NOT NULL
                    AND mp.user_id <> auth.uid()
                    AND pr.notifications_enabled = TRUE
        LOOP
            PERFORM create_notification(
                    v_user.user_id,
                    'match_result',
                    CASE WHEN v_is_new THEN 'Resultado cargado 📊' ELSE 'Resultado corregido 📊' END,
                    format('%s de "%s". Si no coincide, podés objetarlo.',
                           CASE WHEN v_is_new THEN 'Ya está el resultado' ELSE 'Cambió el resultado' END,
                           v_match.title),
                    jsonb_build_object('match_id', p_match_id, 'match_title', v_match.title)
                    );
        END LOOP;

    RETURN v_result_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION save_match_result IS 'Carga o corrige el resultado. Creador siempre; el autor puede corregir el suyo; cualquier jugador puede cargarlo si a las 24 h del partido nadie lo hizo.';


-- ── 7. Borrar el resultado: el creador o su autor ──────────────────────────
CREATE OR REPLACE FUNCTION delete_match_result(p_match_id UUID)
    RETURNS VOID AS
$$
DECLARE
    v_match       matches;
    v_reported_by UUID;
    v_count       INTEGER;
BEGIN
    SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Partido no encontrado';
    END IF;

    SELECT reported_by INTO v_reported_by FROM match_results WHERE match_id = p_match_id;

    IF v_match.creator_id IS DISTINCT FROM auth.uid() AND v_reported_by IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Sólo el creador o quien cargó el resultado pueden borrarlo';
    END IF;

    -- Las confirmaciones se van en cascada con el resultado.
    DELETE FROM match_player_stats WHERE match_id = p_match_id;
    DELETE FROM match_results WHERE match_id = p_match_id;

    SELECT COUNT(*) INTO v_count FROM match_participants WHERE match_id = p_match_id;

    UPDATE matches
    SET status     = CASE
                         WHEN status = 'cancelled' THEN status
                         WHEN v_count >= total_players THEN 'full'::match_status
                         ELSE 'open'::match_status
        END,
        winner_id  = NULL,
        updated_at = NOW()
    WHERE id = p_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ── 8. Votar el resultado ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION vote_match_result(
    p_match_id UUID,
    p_vote TEXT,
    p_comment TEXT DEFAULT NULL
)
    RETURNS VOID AS
$$
DECLARE
    v_result_id   UUID;
    v_reported_by UUID;
    v_match_title TEXT;
    v_voter_name  TEXT;
BEGIN
    SELECT r.id, r.reported_by, m.title
    INTO v_result_id, v_reported_by, v_match_title
    FROM match_results r
             JOIN matches m ON m.id = r.match_id
    WHERE r.match_id = p_match_id;

    IF v_result_id IS NULL THEN
        RAISE EXCEPTION 'Este partido todavía no tiene resultado cargado';
    END IF;

    IF v_reported_by = auth.uid() THEN
        RAISE EXCEPTION 'Cargaste vos el resultado: si está mal, corregilo';
    END IF;

    IF NOT EXISTS (SELECT 1
                   FROM match_participants
                   WHERE match_id = p_match_id
                     AND user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Sólo los jugadores del partido pueden confirmar u objetar el resultado';
    END IF;

    INSERT INTO match_result_confirmations (result_id, user_id, vote, comment)
    VALUES (v_result_id, auth.uid(), p_vote::result_vote, NULLIF(TRIM(COALESCE(p_comment, '')), ''))
    ON CONFLICT (result_id, user_id) DO UPDATE
        SET vote       = EXCLUDED.vote,
            comment    = EXCLUDED.comment,
            updated_at = NOW();

    -- Sólo se avisa la objeción: una confirmación no necesita interrumpir a nadie.
    IF p_vote = 'dispute' THEN
        SELECT full_name INTO v_voter_name FROM profiles WHERE id = auth.uid();

        PERFORM create_notification(
                v_reported_by,
                'match_result',
                'Objetaron el resultado ⚠️',
                format('%s dice que el resultado de "%s" no es así', COALESCE(v_voter_name, 'Un jugador'), v_match_title),
                jsonb_build_object('match_id', p_match_id, 'match_title', v_match_title)
                );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION vote_match_result IS 'Confirmar u objetar el resultado. Sin objeciones el resultado vale: no hace falta quórum. Una objeción lo saca de las estadísticas hasta que se corrija.';


-- ── 9. Bajarse del voto ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION clear_match_result_vote(p_match_id UUID)
    RETURNS VOID AS
$$
BEGIN
    DELETE FROM match_result_confirmations c
        USING match_results r
    WHERE c.result_id = r.id
      AND r.match_id = p_match_id
      AND c.user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ── 10. Realtime ───────────────────────────────────────────────────────────
DO
$$
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE match_result_confirmations;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END
$$;
