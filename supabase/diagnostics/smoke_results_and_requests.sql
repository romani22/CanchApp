-- =====================================================
-- Smoke test: resultados de partido (021) y aprobación para unirse (022)
-- =====================================================
--
-- Cómo correrlo contra la base local:
--
--   supabase db reset
--   docker exec -i supabase_db_CanchApp psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/diagnostics/smoke_results_and_requests.sql
--
-- Cada bloque levanta una excepción si algo no da lo esperado: si termina con
-- ROLLBACK y sin ERROR, pasó todo. Termina en ROLLBACK a propósito — no deja
-- datos de prueba en la base.
--
-- Encontró tres bugs reales cuando se escribió, así que vale volver a correrlo
-- después de tocar cualquiera de las dos migraciones:
--   * winner_id se seteaba con un solo ganador registrado aunque también hubiera
--     ganado un invitado (o sea, había ganado un equipo de dos).
--   * los totales del perfil quedaban en 0 al cargar el resultado: el trigger que
--     los recalcula corría antes de que el partido pasara a 'completed'.
--   * dos triggers avisaban al creador de cada solicitud (005 y 013), así que
--     llegaban notificaciones duplicadas.
-- =====================================================
\set ON_ERROR_STOP on

BEGIN;

-- ── Datos de prueba ────────────────────────────────────────────────────────
-- Los perfiles los crea el trigger handle_new_user() al insertar en auth.users.
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('11111111-1111-1111-1111-111111111111', 'creador@test.com', '{"full_name":"Creador"}'),
       ('22222222-2222-2222-2222-222222222222', 'jugador@test.com', '{"full_name":"Jugador"}'),
       ('33333333-3333-3333-3333-333333333333', 'tercero@test.com', '{"full_name":"Tercero"}');

UPDATE profiles SET sport_levels = '{"futbol":"intermedio"}'::jsonb;

INSERT INTO matches (id, creator_id, sport, title, starts_at, venue_name, total_players, players_needed, team_mode)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
        'futbol', 'Picadito de prueba', NOW() - INTERVAL '2 hours', 'Cancha Test', 4, 4, 'two_teams');

INSERT INTO match_participants (match_id, user_id, team_slot, is_creator)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'A', true),
       ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'B', false);
INSERT INTO match_participants (match_id, guest_name, team_slot)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Invitado Pepe', 'A');

-- ── 1. Sólo el creador puede cargar el resultado ───────────────────────────
DO
$$
    BEGIN
        PERFORM set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
        BEGIN
            PERFORM save_match_result('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 3, 1, '[]'::jsonb, NULL,
                                      '[{"user_id":"22222222-2222-2222-2222-222222222222","display_name":"Jugador","outcome":"win"}]'::jsonb);
            RAISE EXCEPTION 'FALLO: un jugador cualquiera pudo cargar el resultado';
        EXCEPTION
            WHEN sqlstate 'P0001' THEN
                IF SQLERRM LIKE 'FALLO%' THEN RAISE; END IF;
                RAISE NOTICE 'OK 1 — rechazado: %', SQLERRM;
        END;
    END
$$;

-- ── 2. No se puede cargar a alguien que no jugó ────────────────────────────
DO
$$
    BEGIN
        PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
        BEGIN
            PERFORM save_match_result('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 3, 1, '[]'::jsonb, NULL,
                                      '[{"user_id":"33333333-3333-3333-3333-333333333333","display_name":"Tercero","outcome":"win"}]'::jsonb);
            RAISE EXCEPTION 'FALLO: se cargó un jugador que no participó';
        EXCEPTION
            WHEN sqlstate 'P0001' THEN
                IF SQLERRM LIKE 'FALLO%' THEN RAISE; END IF;
                RAISE NOTICE 'OK 2 — rechazado: %', SQLERRM;
        END;
    END
$$;

-- ── 3. El creador carga el resultado ───────────────────────────────────────
DO
$$
    DECLARE
        v_result_id UUID;
    BEGIN
        PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
        v_result_id := save_match_result(
                'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 3, 1, '[]'::jsonb, 'partidazo',
                '[
                  {"user_id":"11111111-1111-1111-1111-111111111111","display_name":"Creador","outcome":"win","goals":2,"assists":1},
                  {"user_id":"22222222-2222-2222-2222-222222222222","display_name":"Jugador","outcome":"loss","goals":1,"saves":4},
                  {"user_id":null,"display_name":"Invitado Pepe","outcome":"win","goals":1}
                ]'::jsonb);
        IF v_result_id IS NULL THEN RAISE EXCEPTION 'FALLO: no devolvió el id del resultado'; END IF;
        RAISE NOTICE 'OK 3 — resultado cargado';
    END
$$;

-- ── 4. Efectos: estado del partido, stats y totales del perfil ─────────────
DO
$$
    DECLARE
        v_status  match_status;
        v_winner  UUID;
        v_played  INTEGER;
        v_wins    INTEGER;
        v_rate    INTEGER;
        v_goals   BIGINT;
        v_avg     NUMERIC;
        v_saves   NUMERIC;
        v_pmatches INTEGER;
        v_pwins   INTEGER;
        v_elo     INTEGER;
    BEGIN
        SELECT status, winner_id INTO v_status, v_winner FROM matches WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
        IF v_status <> 'completed' THEN RAISE EXCEPTION 'FALLO: el partido quedó en %', v_status; END IF;
        -- Ganaron dos (el creador y un invitado), así que winner_id no aplica.
        IF v_winner IS NOT NULL THEN RAISE EXCEPTION 'FALLO: winner_id debería ser NULL con más de un ganador'; END IF;

        SELECT matches_played, wins, win_rate, goals, goals_per_match, saves_per_match
        INTO v_played, v_wins, v_rate, v_goals, v_avg, v_saves
        FROM user_sport_stats
        WHERE user_id = '11111111-1111-1111-1111-111111111111' AND sport = 'futbol';

        IF v_played <> 1 OR v_wins <> 1 OR v_rate <> 100 OR v_goals <> 2 OR v_avg <> 2.00 THEN
            RAISE EXCEPTION 'FALLO: stats del creador: jugados=% ganados=% rate=% goles=% prom=%', v_played, v_wins, v_rate, v_goals, v_avg;
        END IF;
        -- El creador no tiene atajadas cargadas: el promedio es NULL, no 0.
        IF v_saves IS NOT NULL THEN RAISE EXCEPTION 'FALLO: saves_per_match debería ser NULL y es %', v_saves; END IF;

        SELECT total_matches, total_wins, elo_rating INTO v_pmatches, v_pwins, v_elo
        FROM profiles WHERE id = '11111111-1111-1111-1111-111111111111';
        IF v_pmatches <> 1 OR v_pwins <> 1 THEN
            RAISE EXCEPTION 'FALLO: totales del perfil: % partidos / % victorias', v_pmatches, v_pwins;
        END IF;
        -- ELO: el ganador tiene que haber subido de 1000.
        IF v_elo <= 1000 THEN RAISE EXCEPTION 'FALLO: el ELO del ganador quedó en %', v_elo; END IF;

        -- El invitado no alimenta ningún perfil, pero su fila existe.
        IF NOT EXISTS (SELECT 1 FROM match_player_stats WHERE display_name = 'Invitado Pepe' AND user_id IS NULL) THEN
            RAISE EXCEPTION 'FALLO: no se guardó la fila del invitado';
        END IF;
        IF EXISTS (SELECT 1 FROM user_sport_stats WHERE user_id IS NULL) THEN
            RAISE EXCEPTION 'FALLO: un invitado entró en las estadísticas por usuario';
        END IF;

        RAISE NOTICE 'OK 4 — partido completed, stats y totales correctos (elo ganador %)', v_elo;
    END
$$;

-- ── 5. Corregir el resultado reemplaza las filas y no duplica ELO ──────────
DO
$$
    DECLARE
        v_rows  INTEGER;
        v_elo_1 INTEGER;
        v_elo_2 INTEGER;
    BEGIN
        SELECT elo_rating INTO v_elo_1 FROM profiles WHERE id = '11111111-1111-1111-1111-111111111111';

        PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
        PERFORM save_match_result('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2, 2, '[]'::jsonb, NULL,
                                  '[
                                    {"user_id":"11111111-1111-1111-1111-111111111111","display_name":"Creador","outcome":"draw","goals":1},
                                    {"user_id":"22222222-2222-2222-2222-222222222222","display_name":"Jugador","outcome":"draw","goals":1}
                                  ]'::jsonb);

        SELECT COUNT(*) INTO v_rows FROM match_player_stats WHERE match_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
        IF v_rows <> 2 THEN RAISE EXCEPTION 'FALLO: quedaron % filas de stats en vez de 2', v_rows; END IF;

        SELECT elo_rating INTO v_elo_2 FROM profiles WHERE id = '11111111-1111-1111-1111-111111111111';
        IF v_elo_2 <> v_elo_1 THEN RAISE EXCEPTION 'FALLO: corregir el resultado volvió a mover el ELO (% -> %)', v_elo_1, v_elo_2; END IF;

        IF (SELECT total_wins FROM profiles WHERE id = '11111111-1111-1111-1111-111111111111') <> 0 THEN
            RAISE EXCEPTION 'FALLO: la victoria vieja no se descontó al corregir a empate';
        END IF;

        RAISE NOTICE 'OK 5 — corrección: 2 filas, ELO sin tocar, totales recalculados';
    END
$$;

-- ── 6. Borrar el resultado devuelve el partido a full/open ─────────────────
DO
$$
    DECLARE
        v_status match_status;
    BEGIN
        PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
        PERFORM delete_match_result('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

        SELECT status INTO v_status FROM matches WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
        -- 3 participantes en un partido de 4 → vuelve a 'open'.
        IF v_status <> 'open' THEN RAISE EXCEPTION 'FALLO: quedó en % después de borrar el resultado', v_status; END IF;
        IF (SELECT total_matches FROM profiles WHERE id = '11111111-1111-1111-1111-111111111111') <> 0 THEN
            RAISE EXCEPTION 'FALLO: los totales del perfil no volvieron a 0';
        END IF;
        RAISE NOTICE 'OK 6 — resultado borrado, partido en open y totales en 0';
    END
$$;

-- ── 7. Nadie se anota solo (RLS de 022) ────────────────────────────────────
DO
$$
    BEGIN
        SET LOCAL ROLE authenticated;
        PERFORM set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
        BEGIN
            INSERT INTO match_participants (match_id, user_id)
            VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333');
            RESET ROLE;
            RAISE EXCEPTION 'FALLO: un jugador se anotó solo, sin aprobación';
        EXCEPTION
            WHEN insufficient_privilege THEN
                RESET ROLE;
                RAISE NOTICE 'OK 7 — RLS bloqueó el auto-anotarse';
        END;
        RESET ROLE;
    END
$$;

-- ── 8. Solicitud: la acepta el creador y entra con el equipo pedido ────────
DO
$$
    DECLARE
        v_request_id UUID;
        v_slot       TEXT;
        v_status     request_status;
        v_notif      INTEGER;
    BEGIN
        INSERT INTO join_requests (match_id, user_id, team_slot, message)
        VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'B', 'me sumo')
        RETURNING id INTO v_request_id;

        -- El creador tiene que haber recibido la notificación del trigger.
        SELECT COUNT(*) INTO v_notif FROM notifications
        WHERE user_id = '11111111-1111-1111-1111-111111111111' AND type = 'join_request';
        IF v_notif <> 1 THEN RAISE EXCEPTION 'FALLO: el creador recibió % notificaciones de solicitud', v_notif; END IF;

        -- Un tercero no puede aceptar solicitudes de un partido ajeno.
        PERFORM set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
        BEGIN
            PERFORM accept_join_request(v_request_id);
            RAISE EXCEPTION 'FALLO: alguien que no es el creador aceptó una solicitud';
        EXCEPTION
            WHEN sqlstate 'P0001' THEN
                IF SQLERRM LIKE 'FALLO%' THEN RAISE; END IF;
                RAISE NOTICE 'OK 8a — rechazado: %', SQLERRM;
        END;

        PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
        PERFORM accept_join_request(v_request_id);

        SELECT team_slot INTO v_slot FROM match_participants
        WHERE match_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND user_id = '33333333-3333-3333-3333-333333333333';
        IF v_slot <> 'B' THEN RAISE EXCEPTION 'FALLO: entró con equipo % en vez de B', COALESCE(v_slot, 'NULL'); END IF;

        SELECT status INTO v_status FROM join_requests WHERE id = v_request_id;
        IF v_status <> 'accepted' THEN RAISE EXCEPTION 'FALLO: la solicitud quedó en %', v_status; END IF;

        -- El partido pasó a 4/4: aceptar otra tiene que fallar por completo.
        IF (SELECT status FROM matches WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') <> 'full' THEN
            RAISE EXCEPTION 'FALLO: el partido no quedó full con 4 de 4';
        END IF;

        -- Y aceptar dos veces la misma solicitud tampoco.
        BEGIN
            PERFORM accept_join_request(v_request_id);
            RAISE EXCEPTION 'FALLO: se aceptó dos veces la misma solicitud';
        EXCEPTION
            WHEN sqlstate 'P0001' THEN
                IF SQLERRM LIKE 'FALLO%' THEN RAISE; END IF;
                RAISE NOTICE 'OK 8b — rechazado: %', SQLERRM;
        END;

        RAISE NOTICE 'OK 8 — solicitud aceptada por el creador, con su equipo';
    END
$$;

-- ── 9. Re-solicitar después de un rechazo vuelve a avisar al creador ───────
DO
$$
    DECLARE
        v_request_id UUID;
        v_notif      INTEGER;
    BEGIN
        -- Se saca al tercero para que haya lugar y su solicitud vuelva a pending.
        DELETE FROM match_participants
        WHERE match_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND user_id = '33333333-3333-3333-3333-333333333333';

        SELECT id INTO v_request_id FROM join_requests WHERE user_id = '33333333-3333-3333-3333-333333333333';
        UPDATE join_requests SET status = 'rejected' WHERE id = v_request_id;

        UPDATE join_requests SET status = 'pending', updated_at = NOW() WHERE id = v_request_id;

        SELECT COUNT(*) INTO v_notif FROM notifications
        WHERE user_id = '11111111-1111-1111-1111-111111111111' AND type = 'join_request';
        IF v_notif <> 2 THEN RAISE EXCEPTION 'FALLO: el re-pedido generó % notificaciones en total (esperado 2)', v_notif; END IF;

        -- Y un update que ya venía pendiente no vuelve a avisar.
        UPDATE join_requests SET message = 'insisto' WHERE id = v_request_id;
        SELECT COUNT(*) INTO v_notif FROM notifications
        WHERE user_id = '11111111-1111-1111-1111-111111111111' AND type = 'join_request';
        IF v_notif <> 2 THEN RAISE EXCEPTION 'FALLO: editar una solicitud pendiente volvió a notificar (% total)', v_notif; END IF;

        RAISE NOTICE 'OK 9 — re-solicitar avisa una vez más, editar no';
    END
$$;

-- ── 10. Rechazar por RPC ───────────────────────────────────────────────────
DO
$$
    DECLARE
        v_request_id UUID;
    BEGIN
        SELECT id INTO v_request_id FROM join_requests WHERE user_id = '33333333-3333-3333-3333-333333333333';

        PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
        PERFORM reject_join_request(v_request_id);

        IF (SELECT status FROM join_requests WHERE id = v_request_id) <> 'rejected' THEN
            RAISE EXCEPTION 'FALLO: la solicitud no quedó rechazada';
        END IF;
        -- El rechazado tiene que haber recibido su notificación (trigger de 013).
        IF NOT EXISTS (SELECT 1 FROM notifications
                       WHERE user_id = '33333333-3333-3333-3333-333333333333' AND type = 'request_rejected') THEN
            RAISE EXCEPTION 'FALLO: no se notificó el rechazo';
        END IF;
        RAISE NOTICE 'OK 10 — rechazo por RPC y notificación al jugador';
    END
$$;

ROLLBACK;
