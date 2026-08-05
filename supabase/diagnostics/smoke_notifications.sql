-- =====================================================
-- Smoke test: un solo canal de notificaciones (024)
-- =====================================================
--
-- Cómo correrlo contra la base local:
--
--   supabase db reset
--   docker exec -i supabase_db_CanchApp psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/diagnostics/smoke_notifications.sql
--
-- Cada bloque levanta una excepción si algo no da lo esperado: si termina con
-- ROLLBACK y sin ERROR, pasó todo. Termina en ROLLBACK a propósito — no deja
-- datos de prueba en la base.
--
-- Cubre lo que 024 cambió:
--   * la notificación de partido cercano ya no depende de tener push token
--   * el encolado de recordatorios es idempotente (el cron lo llama cada 5 min)
--   * respeta las preferencias y no le avisa a los invitados
--   * el pedido de resultado sólo va al creador, sólo si falta, y sólo si es reciente
-- =====================================================
\set ON_ERROR_STOP on

BEGIN;

-- ── Datos de prueba ────────────────────────────────────────────────────────
-- Los perfiles los crea el trigger handle_new_user() al insertar en auth.users.
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('11111111-1111-1111-1111-111111111111', 'creador@test.com', '{"full_name":"Creador"}'),
       ('22222222-2222-2222-2222-222222222222', 'jugador@test.com', '{"full_name":"Jugador"}'),
       ('33333333-3333-3333-3333-333333333333', 'vecino@test.com', '{"full_name":"Vecino"}');

-- El vecino vive en la zona del partido y NUNCA registró push: es el caso que
-- antes se quedaba sin la notificación incluso en el listado.
UPDATE profiles SET zone = 'Palermo', push_token = NULL WHERE id = '33333333-3333-3333-3333-333333333333';

-- ── 1. Partido cercano: avisa aunque no haya push token ────────────────────
DO
$$
    DECLARE
        v_notif INTEGER;
    BEGIN
        IF EXISTS (SELECT 1 FROM get_nearby_users(NULL::point, 'Palermo', '11111111-1111-1111-1111-111111111111')
                   WHERE user_id = '33333333-3333-3333-3333-333333333333') IS NOT TRUE THEN
            RAISE EXCEPTION 'FALLO: get_nearby_users no encuentra al vecino sin push token';
        END IF;

        INSERT INTO matches (id, creator_id, sport, title, starts_at, venue_name, venue_zone, total_players, players_needed)
        VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
                'futbol', 'Picadito en Palermo', NOW() + INTERVAL '3 days', 'Cancha Test', 'Palermo', 4, 4);

        SELECT COUNT(*) INTO v_notif FROM notifications
        WHERE user_id = '33333333-3333-3333-3333-333333333333' AND type = 'new_match';
        IF v_notif <> 1 THEN
            RAISE EXCEPTION 'FALLO: el vecino recibió % avisos de partido cercano (esperado 1)', v_notif;
        END IF;

        -- Y al creador no se le avisa de su propio partido.
        IF EXISTS (SELECT 1 FROM notifications
                   WHERE user_id = '11111111-1111-1111-1111-111111111111' AND type = 'new_match') THEN
            RAISE EXCEPTION 'FALLO: el creador recibió el aviso de su propio partido';
        END IF;

        RAISE NOTICE 'OK 1 — el partido cercano avisa sin depender del push token';
    END
$$;

-- ── 2. Recordatorio del partido: encola una sola vez ───────────────────────
INSERT INTO matches (id, creator_id, sport, title, starts_at, venue_name, total_players, players_needed, status)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111',
        'futbol', 'Arranca ya', NOW() + INTERVAL '10 minutes', 'Cancha Test', 4, 4, 'open');

INSERT INTO match_participants (match_id, user_id, is_creator)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', true),
       ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', false);
-- Un invitado no tiene a quién avisarle.
INSERT INTO match_participants (match_id, guest_name)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Invitado Pepe');

DO
$$
    DECLARE
        v_count INTEGER;
        v_body  TEXT;
    BEGIN
        v_count := enqueue_due_match_reminders();
        IF v_count <> 2 THEN
            RAISE EXCEPTION 'FALLO: encoló % recordatorios (esperado 2, sin contar al invitado)', v_count;
        END IF;

        SELECT body INTO v_body FROM notifications
        WHERE user_id = '22222222-2222-2222-2222-222222222222' AND type = 'match_reminder';
        IF v_body NOT LIKE '%Arranca ya%' OR v_body NOT LIKE '%minutos%' THEN
            RAISE EXCEPTION 'FALLO: el cuerpo del recordatorio quedó raro: %', v_body;
        END IF;

        -- Idempotencia: el cron lo llama cada 5 minutos sobre una ventana de 15.
        v_count := enqueue_due_match_reminders();
        IF v_count <> 0 THEN
            RAISE EXCEPTION 'FALLO: la segunda corrida encoló % recordatorios de nuevo', v_count;
        END IF;

        RAISE NOTICE 'OK 2 — recordatorio a los jugadores, una sola vez, sin invitados';
    END
$$;

-- ── 3. Preferencia apagada: no se encola ───────────────────────────────────
DO
$$
    DECLARE
        v_count INTEGER;
    BEGIN
        UPDATE profiles SET notify_match_reminder = FALSE WHERE id = '22222222-2222-2222-2222-222222222222';

        INSERT INTO matches (id, creator_id, sport, title, starts_at, venue_name, total_players, players_needed, status)
        VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111',
                'padel', 'Otro que arranca', NOW() + INTERVAL '8 minutes', 'Cancha Test', 2, 2, 'open');
        INSERT INTO match_participants (match_id, user_id, is_creator)
        VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', false);

        v_count := enqueue_due_match_reminders();
        IF v_count <> 0 THEN
            RAISE EXCEPTION 'FALLO: encoló % recordatorios para quien los tiene apagados', v_count;
        END IF;

        UPDATE profiles SET notify_match_reminder = TRUE WHERE id = '22222222-2222-2222-2222-222222222222';
        RAISE NOTICE 'OK 3 — con la preferencia apagada no se encola nada';
    END
$$;

-- ── 4. Partido cancelado o ya empezado: tampoco ────────────────────────────
DO
$$
    DECLARE
        v_count INTEGER;
    BEGIN
        UPDATE matches SET status = 'cancelled' WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
        v_count := enqueue_due_match_reminders();
        IF v_count <> 0 THEN RAISE EXCEPTION 'FALLO: encoló el recordatorio de un partido cancelado'; END IF;

        -- Un partido que ya arrancó quedó fuera de la ventana: avisar tarde no sirve.
        UPDATE matches SET status = 'open', starts_at = NOW() - INTERVAL '5 minutes'
        WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
        v_count := enqueue_due_match_reminders();
        IF v_count <> 0 THEN RAISE EXCEPTION 'FALLO: encoló el recordatorio de un partido que ya empezó'; END IF;

        RAISE NOTICE 'OK 4 — cancelado o ya empezado no genera recordatorio';
    END
$$;

-- ── 5. Pedido de resultado: sólo al creador, sólo si falta ─────────────────
-- Fútbol dura 90 minutos estimados + 15 de gracia: a las 2 horas ya corresponde.
INSERT INTO matches (id, creator_id, sport, title, starts_at, venue_name, total_players, players_needed, status)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111',
        'futbol', 'Terminado sin resultado', NOW() - INTERVAL '2 hours', 'Cancha Test', 2, 2, 'full');

INSERT INTO match_participants (match_id, user_id, is_creator)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', true),
       ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', false);

DO
$$
    DECLARE
        v_count INTEGER;
    BEGIN
        v_count := enqueue_due_result_requests();
        IF v_count <> 1 THEN
            RAISE EXCEPTION 'FALLO: encoló % pedidos de resultado (esperado 1, sólo al creador)', v_count;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM notifications
                       WHERE user_id = '11111111-1111-1111-1111-111111111111'
                         AND type = 'match_result'
                         AND data ->> 'match_id' = 'dddddddd-dddd-dddd-dddd-dddddddddddd') THEN
            RAISE EXCEPTION 'FALLO: el pedido de resultado no le llegó al creador';
        END IF;

        IF EXISTS (SELECT 1 FROM notifications
                   WHERE user_id = '22222222-2222-2222-2222-222222222222'
                     AND type = 'match_result'
                     AND data ->> 'match_id' = 'dddddddd-dddd-dddd-dddd-dddddddddddd') THEN
            RAISE EXCEPTION 'FALLO: el pedido de resultado le llegó a un jugador que no lo carga';
        END IF;

        v_count := enqueue_due_result_requests();
        IF v_count <> 0 THEN
            RAISE EXCEPTION 'FALLO: la segunda corrida volvió a pedir el resultado (%)', v_count;
        END IF;

        RAISE NOTICE 'OK 5 — el pedido de resultado va sólo al creador y una sola vez';
    END
$$;

-- ── 6. Recién terminado, con resultado, o muy viejo: no se pide ────────────
DO
$$
    DECLARE
        v_count INTEGER;
    BEGIN
        -- Recién terminado: fútbol a los 90 minutos todavía está en la cancha.
        INSERT INTO matches (id, creator_id, sport, title, starts_at, venue_name, total_players, players_needed, status)
        VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111',
                'futbol', 'Recién terminado', NOW() - INTERVAL '95 minutes', 'Cancha Test', 2, 2, 'full');
        v_count := enqueue_due_result_requests();
        IF v_count <> 0 THEN
            RAISE EXCEPTION 'FALLO: pidió el resultado de un partido que recién terminó';
        END IF;

        -- Y a las 2 horas ya sí.
        UPDATE matches SET starts_at = NOW() - INTERVAL '2 hours' WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
        v_count := enqueue_due_result_requests();
        IF v_count <> 1 THEN
            RAISE EXCEPTION 'FALLO: pasada la gracia encoló % pedidos (esperado 1)', v_count;
        END IF;

        -- Un partido viejo no se reclama: al habilitar esto no se dispara el historial.
        INSERT INTO matches (id, creator_id, sport, title, starts_at, venue_name, total_players, players_needed, status)
        VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '11111111-1111-1111-1111-111111111111',
                'futbol', 'Del mes pasado', NOW() - INTERVAL '30 days', 'Cancha Test', 2, 2, 'full');
        v_count := enqueue_due_result_requests();
        IF v_count <> 0 THEN
            RAISE EXCEPTION 'FALLO: pidió el resultado de un partido de hace 30 días';
        END IF;

        RAISE NOTICE 'OK 6 — ni recién terminado ni viejo: sólo la ventana que importa';
    END
$$;

-- ── 7. El punto de entrada del cron suma las dos cosas ─────────────────────
DO
$$
    DECLARE
        v_count INTEGER;
    BEGIN
        -- Nada pendiente en este momento: todo lo de arriba ya quedó registrado.
        v_count := enqueue_due_match_notifications();
        IF v_count <> 0 THEN
            RAISE EXCEPTION 'FALLO: el encolado del cron duplicó % avisos', v_count;
        END IF;

        -- Un partido nuevo dentro de la ventana tiene que salir por esta puerta.
        INSERT INTO matches (id, creator_id, sport, title, starts_at, venue_name, total_players, players_needed, status)
        VALUES ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '11111111-1111-1111-1111-111111111111',
                'tenis', 'Ya casi', NOW() + INTERVAL '12 minutes', 'Cancha Test', 2, 2, 'open');
        INSERT INTO match_participants (match_id, user_id, is_creator)
        VALUES ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '22222222-2222-2222-2222-222222222222', false);

        v_count := enqueue_due_match_notifications();
        IF v_count <> 1 THEN
            RAISE EXCEPTION 'FALLO: el encolado del cron devolvió % (esperado 1)', v_count;
        END IF;

        RAISE NOTICE 'OK 7 — enqueue_due_match_notifications encola y no repite';
    END
$$;

-- ── 8. El log queda consistente con lo notificado ─────────────────────────
DO
$$
    DECLARE
        v_log    INTEGER;
        v_notifs INTEGER;
    BEGIN
        SELECT COUNT(*) INTO v_log FROM match_notification_log;
        SELECT COUNT(*) INTO v_notifs FROM notifications WHERE type IN ('match_reminder', 'match_result');
        IF v_log <> v_notifs THEN
            RAISE EXCEPTION 'FALLO: % filas en el log contra % notificaciones automáticas', v_log, v_notifs;
        END IF;

        -- Borrar el partido se lleva su registro: no queda basura apuntando a nada.
        DELETE FROM matches WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
        IF EXISTS (SELECT 1 FROM match_notification_log WHERE match_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') THEN
            RAISE EXCEPTION 'FALLO: el log quedó con filas de un partido borrado';
        END IF;

        RAISE NOTICE 'OK 8 — log consistente y se limpia en cascada';
    END
$$;

ROLLBACK;
