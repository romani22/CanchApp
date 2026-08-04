-- =====================================================
-- Migration 021: Resultados de partido y estadísticas reales
-- =====================================================
--
-- Problema que resuelve: las cards de estadísticas del perfil leen
-- profiles.total_matches / total_wins, que ninguna parte del sistema escribía
-- nunca, así que mostraban 0 (o números inventados) para todos. No había dónde
-- guardar el resultado de un partido: sólo matches.winner_id, un único UUID que
-- únicamente sirve para deportes 1 contra 1, y una tabla match_scores creada en
-- 003 que quedó sin usar ni consumir.
--
-- Modelo elegido: el resultado se guarda POR JUGADOR.
--
--   match_results       → el marcador del partido (goles o sets).
--   match_player_stats  → una fila por jugador: si ganó, perdió o empató, más
--                         sus métricas individuales del partido.
--
-- Guardar el resultado por jugador es lo que hace que las estadísticas funcionen
-- igual en un fútbol 5vs5 con equipos cargados, en un tenis 1vs1 y en un pádel
-- donde nadie usó el modo equipos: no dependen de team_mode ni de que los equipos
-- estén bien asignados.
-- =====================================================


-- ── 1. Enum del resultado por jugador ──────────────────────────────────────
DO
$$
    BEGIN
        CREATE TYPE match_outcome AS ENUM ('win', 'loss', 'draw');
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END
$$;

-- Tipo de notificación nuevo. No se puede USAR el valor en esta misma
-- transacción, pero sí referenciarlo dentro del cuerpo de una función: el cast
-- ocurre recién cuando la función corre.
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'match_result';


-- ── 2. La tabla muerta de 003 ──────────────────────────────────────────────
-- match_scores nunca se escribió ni se leyó desde la app, y su forma (home/away
-- + sets en columnas fijas) no sirve para partidos sin equipos. La reemplaza
-- match_results.
DROP TABLE IF EXISTS match_scores;


-- ── 3. Resultado del partido ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_results
(
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id    UUID        NOT NULL UNIQUE REFERENCES matches (id) ON DELETE CASCADE,

    -- Marcador. Orientación de los dos lados:
    --   team_mode = 'two_teams' → score_a es el Equipo A y score_b el Equipo B.
    --   team_mode = 'none'      → score_a es el lado ganador y score_b el perdedor;
    --                             en un empate los dos números son iguales.
    -- Quedan en NULL cuando el deporte no se cuenta por goles/puntos (tenis y
    -- pádel usan `sets`) o cuando el creador cargó sólo quién ganó.
    score_a     INTEGER CHECK (score_a >= 0),
    score_b     INTEGER CHECK (score_b >= 0),

    -- Sets, con la misma orientación que score_a/score_b: [{"a":6,"b":4},{"a":3,"b":6}]
    sets        JSONB       NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(sets) = 'array'),

    notes       TEXT,

    -- Quién lo cargó. Nullable para no perder el resultado si se borra la cuenta.
    reported_by UUID REFERENCES profiles (id) ON DELETE SET NULL,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE match_results IS 'Marcador de un partido finalizado. El detalle por jugador va en match_player_stats.';
COMMENT ON COLUMN match_results.score_a IS 'Equipo A si el partido usa equipos; si no, el lado ganador.';
COMMENT ON COLUMN match_results.sets IS 'Sets en orden: [{"a":6,"b":4},...]. Para tenis y pádel.';


-- ── 4. Resultado y métricas por jugador ────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_player_stats
(
    id           UUID PRIMARY KEY   DEFAULT gen_random_uuid(),
    match_id     UUID          NOT NULL REFERENCES matches (id) ON DELETE CASCADE,

    -- NULL en las filas de invitados (participantes sin cuenta). Se cargan igual
    -- —un invitado puede haber hecho los goles— pero no alimentan ningún perfil.
    user_id      UUID REFERENCES profiles (id) ON DELETE CASCADE,

    -- Para invitados es su guest_name. Para usuarios registrados es una copia del
    -- full_name al momento de cargar el resultado, así el historial no cambia si
    -- después se renombran.
    display_name TEXT          NOT NULL,

    outcome      match_outcome NOT NULL,

    -- Métricas individuales. NULLABLE a propósito: NULL significa "no se cargó",
    -- distinto de un 0 real. Los promedios del tipo "goles por partido" dividen
    -- por COUNT(goals), que ignora los NULL, así que un partido donde el creador
    -- no cargó nada no baja el promedio de nadie.
    goals        INTEGER CHECK (goals >= 0),   -- fútbol
    assists      INTEGER CHECK (assists >= 0), -- fútbol
    saves        INTEGER CHECK (saves >= 0),   -- fútbol (arquero)
    points       INTEGER CHECK (points >= 0),  -- básquet / vóley

    -- Métricas que se agreguen más adelante (bloqueos, aces, MVP) sin migrar de
    -- nuevo. Las que se vuelvan importantes pueden promoverse a columna después.
    extra        JSONB         NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(extra) = 'object'),

    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Un jugador registrado aparece una sola vez por partido. Los invitados se
-- desambiguan por nombre, que es lo único que los identifica.
CREATE UNIQUE INDEX IF NOT EXISTS idx_player_stats_unique_user
    ON match_player_stats (match_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_player_stats_unique_guest
    ON match_player_stats (match_id, display_name) WHERE user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_player_stats_match ON match_player_stats (match_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_user ON match_player_stats (user_id) WHERE user_id IS NOT NULL;

COMMENT ON TABLE match_player_stats IS 'Una fila por jugador de un partido finalizado: si ganó y sus métricas individuales.';
COMMENT ON COLUMN match_player_stats.goals IS 'NULL = no se cargó. Distinto de 0.';


-- ── 5. RLS ─────────────────────────────────────────────────────────────────
-- Los resultados son públicos, igual que los partidos. Escribe sólo el creador
-- del partido (la RPC save_match_result además valida capacidad y estado).
ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_player_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Results are viewable by everyone" ON match_results;
CREATE POLICY "Results are viewable by everyone"
    ON match_results FOR SELECT USING (true);

DROP POLICY IF EXISTS "Match creators can write results" ON match_results;
CREATE POLICY "Match creators can write results"
    ON match_results FOR ALL
    USING (auth.uid() IN (SELECT creator_id FROM matches WHERE id = match_id))
    WITH CHECK (auth.uid() IN (SELECT creator_id FROM matches WHERE id = match_id));

DROP POLICY IF EXISTS "Player stats are viewable by everyone" ON match_player_stats;
CREATE POLICY "Player stats are viewable by everyone"
    ON match_player_stats FOR SELECT USING (true);

DROP POLICY IF EXISTS "Match creators can write player stats" ON match_player_stats;
CREATE POLICY "Match creators can write player stats"
    ON match_player_stats FOR ALL
    USING (auth.uid() IN (SELECT creator_id FROM matches WHERE id = match_id))
    WITH CHECK (auth.uid() IN (SELECT creator_id FROM matches WHERE id = match_id));


-- ── 6. Estadísticas por usuario y deporte ──────────────────────────────────
-- Es la fuente de las cards del perfil (con selector de deporte) y de los datos
-- que muestra el modal de participante dentro de un partido.
CREATE OR REPLACE VIEW public.user_sport_stats AS
SELECT s.user_id,
       m.sport,
       COUNT(*)                                             AS matches_played,
       COUNT(*) FILTER (WHERE s.outcome = 'win')             AS wins,
       COUNT(*) FILTER (WHERE s.outcome = 'loss')            AS losses,
       COUNT(*) FILTER (WHERE s.outcome = 'draw')            AS draws,
       ROUND(100.0 * COUNT(*) FILTER (WHERE s.outcome = 'win') / COUNT(*))::INTEGER
                                                            AS win_rate,
       -- Totales de las métricas individuales.
       SUM(s.goals)                                         AS goals,
       SUM(s.assists)                                       AS assists,
       SUM(s.saves)                                         AS saves,
       SUM(s.points)                                        AS points,
       -- Promedios sobre los partidos donde la métrica SÍ se cargó: COUNT(col)
       -- ignora los NULL, así que los partidos sin datos no diluyen el promedio.
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
WHERE s.user_id IS NOT NULL
  AND m.status = 'completed'
GROUP BY s.user_id, m.sport;

COMMENT ON VIEW public.user_sport_stats IS 'Estadísticas de cada usuario en cada deporte, sobre partidos finalizados con resultado cargado.';


-- ── 7. user_stats: mismo contrato, datos de verdad ─────────────────────────
-- La versión de 003 contaba victorias con matches.winner_id (un solo UUID) y
-- partidos con match_participants, así que un partido sin resultado cargado ya
-- contaba como jugado. Ahora las dos cosas salen de match_player_stats, y se
-- mantienen las columnas que ya leía getUserStats().
--
-- DROP y no CREATE OR REPLACE: se agregan columnas en el medio, y reemplazar una
-- vista sólo admite sumar columnas al final.
DROP VIEW IF EXISTS public.user_stats;
CREATE VIEW public.user_stats AS
SELECT p.id                            AS user_id,
       COALESCE(s.total_matches, 0)    AS total_matches,
       COALESCE(s.total_wins, 0)       AS total_wins,
       COALESCE(s.total_losses, 0)     AS total_losses,
       COALESCE(s.total_draws, 0)      AS total_draws,
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
                    WHERE st.user_id IS NOT NULL
                      AND m.status = 'completed'
                    GROUP BY st.user_id) s ON s.user_id = p.id;

GRANT SELECT ON public.user_stats TO anon, authenticated;
GRANT SELECT ON public.user_sport_stats TO anon, authenticated;

-- get_my_stats() (004) contaba lo mismo que la user_stats vieja: partidos por
-- match_participants y victorias por winner_id. Nadie la llama desde la app, y si
-- alguien la usara devolvería los números equivocados. Se borra en vez de
-- mantener dos definiciones de "mis estadísticas".
DROP FUNCTION IF EXISTS get_my_stats();


-- ── 8. profiles.total_matches / total_wins dejan de ser decorativos ────────
-- Varias pantallas ya los leen (la tarjeta de solicitud muestra "N partidos").
-- En vez de cambiar todos esos consumidores, se mantienen sincronizados desde
-- las stats: se RECALCULAN, no se incrementan, así que no pueden desfasarse.
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
          WHERE s.user_id = p_user_id
            AND m.status = 'completed') c
    WHERE p.id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Un solo trigger para INSERT/UPDATE/DELETE. Las ramas son explícitas por TG_OP y
-- no una condición combinada: en un DELETE no existe NEW y en un INSERT no existe
-- OLD, y el orden en que se evalúa un AND/OR no está garantizado.
CREATE OR REPLACE FUNCTION sync_profile_match_totals()
    RETURNS TRIGGER AS
$$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM recompute_profile_match_totals(NEW.user_id);
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM recompute_profile_match_totals(OLD.user_id);
    ELSE
        PERFORM recompute_profile_match_totals(NEW.user_id);
        -- Un UPDATE que cambia de jugador deja dos perfiles para recalcular.
        IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
            PERFORM recompute_profile_match_totals(OLD.user_id);
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_player_stats_change ON match_player_stats;
CREATE TRIGGER on_player_stats_change
    AFTER INSERT OR UPDATE OR DELETE
    ON match_player_stats
    FOR EACH ROW
EXECUTE FUNCTION sync_profile_match_totals();


-- ── 9. ELO para partidos de más de dos jugadores ───────────────────────────
-- El trigger de 003 buscaba "el otro participante" con LIMIT 1: en un fútbol
-- 5vs5 elegía a uno al azar y no tocaba a nadie más. Este aplica el ELO a todos
-- los jugadores usando el promedio del lado rival como oponente.
CREATE OR REPLACE FUNCTION apply_match_elo(p_match_id UUID)
    RETURNS VOID AS
$$
DECLARE
    v_avg_winners numeric;
    v_avg_losers  numeric;
BEGIN
    SELECT AVG(pr.elo_rating) FILTER (WHERE s.outcome = 'win'),
           AVG(pr.elo_rating) FILTER (WHERE s.outcome = 'loss')
    INTO v_avg_winners, v_avg_losers
    FROM match_player_stats s
             JOIN profiles pr ON pr.id = s.user_id
    WHERE s.match_id = p_match_id
      AND s.user_id IS NOT NULL;

    -- Sin los dos lados no hay nada que comparar: pasa en un empate (todos
    -- 'draw', que no mueve el ELO) o si un lado son todos invitados.
    IF v_avg_winners IS NULL OR v_avg_losers IS NULL THEN
        RETURN;
    END IF;

    UPDATE profiles p
    SET elo_rating = calculate_elo(p.elo_rating, ROUND(v_avg_losers)::INTEGER, 1),
        updated_at = NOW()
    FROM match_player_stats s
    WHERE s.match_id = p_match_id
      AND s.user_id = p.id
      AND s.outcome = 'win';

    UPDATE profiles p
    SET elo_rating = calculate_elo(p.elo_rating, ROUND(v_avg_winners)::INTEGER, 0),
        updated_at = NOW()
    FROM match_player_stats s
    WHERE s.match_id = p_match_id
      AND s.user_id = p.id
      AND s.outcome = 'loss';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- El trigger viejo se dispara al pasar a 'completed' y volvería a mover el ELO
-- cada vez que se corrige un resultado. Ahora lo aplica save_match_result una
-- sola vez, cuando el resultado se carga por primera vez.
DROP TRIGGER IF EXISTS on_match_completed_elo ON matches;
DROP FUNCTION IF EXISTS update_elo_after_match();


-- ── 10. Guardar el resultado ───────────────────────────────────────────────
-- Todo en una transacción y con las validaciones del lado del servidor: es el
-- único camino por el que la app carga o corrige un resultado.
--
-- p_players: [{ "user_id": uuid|null, "display_name": text, "outcome": "win"|"loss"|"draw",
--               "goals": int|null, "assists": int|null, "saves": int|null,
--               "points": int|null, "extra": {} }]
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
    v_match     matches;
    v_result_id UUID;
    v_is_new    BOOLEAN;
    v_row       JSONB;
    v_win_count INTEGER;
    v_winner    UUID;
    v_user      RECORD;
BEGIN
    SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Partido no encontrado';
    END IF;

    IF v_match.creator_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Sólo el creador del partido puede cargar el resultado';
    END IF;

    IF v_match.status = 'cancelled' THEN
        RAISE EXCEPTION 'El partido fue cancelado';
    END IF;

    -- end_time quedó como TIME desde 001 (006 sólo migró date + start_time a
    -- starts_at), así que no se puede comparar con NOW(). El corte es starts_at.
    IF v_match.starts_at > NOW() THEN
        RAISE EXCEPTION 'El partido todavía no empezó';
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

    SELECT id INTO v_result_id FROM match_results WHERE match_id = p_match_id;
    v_is_new := v_result_id IS NULL;

    INSERT INTO match_results (match_id, score_a, score_b, sets, notes, reported_by)
    VALUES (p_match_id, p_score_a, p_score_b, COALESCE(p_sets, '[]'::JSONB), p_notes, auth.uid())
    ON CONFLICT (match_id) DO UPDATE
        SET score_a    = EXCLUDED.score_a,
            score_b    = EXCLUDED.score_b,
            sets       = EXCLUDED.sets,
            notes      = EXCLUDED.notes,
            updated_at = NOW()
    RETURNING id INTO v_result_id;

    -- El partido pasa a 'completed' ANTES de escribir las stats, y el orden importa:
    -- el trigger que recalcula profiles.total_matches / total_wins sólo cuenta
    -- partidos completed, así que corriendo al revés contaba 0 y los totales del
    -- perfil quedaban en cero justo después de cargar el resultado.
    UPDATE matches
    SET status     = 'completed',
        updated_at = NOW()
    WHERE id = p_match_id;

    -- Reemplazo completo: corregir un resultado no puede dejar filas viejas de
    -- jugadores que el creador sacó de la lista.
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

    -- winner_id sigue existiendo y hay selects que lo traen. Sólo tiene sentido
    -- cuando ganó UNA sola persona (tenis, pádel 1vs1): en un 5vs5 queda NULL y
    -- las victorias se cuentan por match_player_stats.
    --
    -- El COUNT incluye a los invitados a propósito: si ganaron un usuario y un
    -- invitado, ganó un equipo de dos y winner_id no representa eso. Queda NULL
    -- también si el único ganador fue un invitado, que no tiene perfil.
    --
    -- Dos consultas y no un COUNT + MIN: Postgres no tiene min(uuid).
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

    -- Segundo UPDATE, porque el ganador se conoce recién con las stats escritas.
    UPDATE matches
    SET winner_id  = v_winner,
        updated_at = NOW()
    WHERE id = p_match_id;

    IF v_is_new THEN
        -- El ELO se aplica una sola vez. Corregir el resultado después no lo
        -- vuelve a mover: no es idempotente y se duplicaría en cada edición.
        PERFORM apply_match_elo(p_match_id);

        FOR v_user IN SELECT DISTINCT mp.user_id
                      FROM match_participants mp
                               JOIN profiles pr ON pr.id = mp.user_id
                      WHERE mp.match_id = p_match_id
                        AND mp.user_id IS NOT NULL
                        AND mp.user_id <> v_match.creator_id
                        AND pr.notifications_enabled = TRUE
            LOOP
                PERFORM create_notification(
                        v_user.user_id,
                        'match_result',
                        'Resultado cargado 📊',
                        format('Ya está el resultado de "%s"', v_match.title),
                        jsonb_build_object('match_id', p_match_id, 'match_title', v_match.title)
                        );
            END LOOP;
    END IF;

    RETURN v_result_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION save_match_result IS 'Carga o corrige el resultado de un partido (sólo el creador). Marca el partido completed, aplica ELO la primera vez y avisa a los jugadores.';


-- ── 11. Borrar un resultado cargado por error ──────────────────────────────
-- Vuelve el partido al estado que le corresponda por cantidad de jugadores. No
-- revierte el ELO que ya se aplicó.
CREATE OR REPLACE FUNCTION delete_match_result(p_match_id UUID)
    RETURNS VOID AS
$$
DECLARE
    v_match matches;
    v_count INTEGER;
BEGIN
    SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Partido no encontrado';
    END IF;

    IF v_match.creator_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Sólo el creador del partido puede borrar el resultado';
    END IF;

    DELETE FROM match_player_stats WHERE match_id = p_match_id;
    DELETE FROM match_results WHERE match_id = p_match_id;

    SELECT COUNT(*) INTO v_count FROM match_participants WHERE match_id = p_match_id;

    UPDATE matches
    SET status     = CASE
                         -- 'cancelled' es final: no lo revive borrar un resultado.
                         WHEN status = 'cancelled' THEN status
                         WHEN v_count >= total_players THEN 'full'::match_status
                         ELSE 'open'::match_status
        END,
        winner_id  = NULL,
        updated_at = NOW()
    WHERE id = p_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ── 12. Sincronizar los totales de los perfiles existentes ─────────────────
-- Sin resultados cargados todavía esto deja todo en 0, que es exactamente lo que
-- corresponde: hasta ahora los números que se mostraban no venían de ningún lado.
DO
$$
    DECLARE
        v_id UUID;
    BEGIN
        FOR v_id IN SELECT id FROM profiles
            LOOP
                PERFORM recompute_profile_match_totals(v_id);
            END LOOP;
    END
$$;


-- ── 13. Realtime ───────────────────────────────────────────────────────────
-- Para que el detalle del partido actualice el resultado sin refrescar a mano.
-- duplicate_object: la tabla ya está en la publicación (migración reaplicada).
DO
$$
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE match_results;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END
$$;
