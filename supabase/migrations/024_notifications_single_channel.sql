-- =====================================================
-- Migration 024: un solo canal de notificaciones
-- =====================================================
--
-- Hasta acá convivían dos sistemas que no se hablaban: los triggers escribían en
-- `notifications`, que sale al teléfono por el webhook `send_notification` del
-- Dashboard (INSERT -> Edge Function send-push-notification, la opción A de 014;
-- el trigger pg_net de la opción B quedó sin usar), y en paralelo el cliente
-- programaba avisos locales con expo-notifications, que llegaban al teléfono pero
-- no al listado y vivían sólo en el dispositivo donde se programaron.
--
-- Esta migración deja `notifications` como única fuente de verdad:
--
--   1. Preferencia propia para los avisos de resultado.
--   2. get_nearby_users deja de exigir push token: el listado no depende del push.
--   3. Se va get_upcoming_matches_for_reminders, que nadie llamaba nunca.
--   4. Los recordatorios (partido que arranca, resultado que falta) los encola el
--      servidor y quedan en la tabla, en vez de vivir en el teléfono.
--
-- El envío al teléfono sigue siendo ese webhook: si se borra, esto llena el listado
-- y no suena nada. Y ojo con la Edge Function, que filtra por preferencia y hay que
-- redeployar cuando cambia: un tipo nuevo de notificación se agrega en los dos lados.
--
-- SOBRE LAS PREFERENCIAS: un recordatorio automático que el usuario apagó no se
-- crea (es un recordatorio, no un hecho: la fila no le sirve de nada). Los avisos
-- de algo que pasó — te aceptaron, objetaron tu resultado — se crean siempre y la
-- preferencia sólo decide si además suena, que es lo que filtra la Edge Function.
-- =====================================================


-- ── 1. Preferencia para los avisos de resultado ────────────────────────────
-- Los 'match_result' se venían mandando sin forma de apagarlos: no tenían columna
-- propia, así que la Edge Function no encontraba preferencia y seguía de largo.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_match_result BOOLEAN DEFAULT true;

COMMENT ON COLUMN profiles.notify_match_result IS 'Avisos de resultado: cargado, corregido, objetado, y el recordatorio al creador';


-- ── 2. get_nearby_users sin push token ────────────────────────────────────
-- El filtro `push_token IS NOT NULL` dejaba sin la notificación de partido cercano
-- a cualquiera que no tuviera push registrado (permiso denegado, Expo Go, sesión
-- web): no le llegaba al teléfono, que es esperable, pero tampoco le aparecía en el
-- listado. Quién puede recibir un push lo decide el envío, no la creación.
-- También se va la columna push_token del resultado: era la legada de 001, que
-- guarda un solo dispositivo, mientras los tokens de verdad están en push_tokens.
DROP FUNCTION IF EXISTS get_nearby_users(POINT, TEXT, UUID);

CREATE FUNCTION get_nearby_users(
    match_coordinates POINT,
    match_zone TEXT,
    creator_user_id UUID
)
    RETURNS TABLE
            (
                user_id             UUID,
                notification_radius INTEGER
            )
AS
$$
BEGIN
    RETURN QUERY
        SELECT p.id,
               p.notification_radius
        FROM profiles p
        WHERE p.id != creator_user_id
          AND p.notifications_enabled = true
          AND p.notify_new_matches = true
          AND (
            -- Zona configurada que coincide con la del partido
            (p.zone IS NOT NULL AND p.zone = match_zone)
                OR
            -- O dentro del radio configurado, por coordenadas
            (
                match_coordinates IS NOT NULL
                    AND p.zone_coordinates IS NOT NULL
                    AND (6371000 * acos(
                        cos(radians(match_coordinates[1])) *
                        cos(radians(p.zone_coordinates[1])) *
                        cos(radians(p.zone_coordinates[0]) - radians(match_coordinates[0])) +
                        sin(radians(match_coordinates[1])) *
                        sin(radians(p.zone_coordinates[1]))
                        )) <= p.notification_radius
                )
            );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION get_nearby_users IS 'Usuarios que quieren enterarse de un partido nuevo cerca. No filtra por push token: el listado no depende de tener push.';


-- ── 3. Baja de la función de recordatorios que nadie usaba ─────────────────
-- Era de 013 y esperaba que el cliente la llamara; nunca la llamó nadie. Además
-- leía profiles.push_token, la columna legada. La reemplaza el encolado de acá abajo.
DROP FUNCTION IF EXISTS get_upcoming_matches_for_reminders();


-- ── 4. Duración estimada de un partido ────────────────────────────────────
-- matches.end_time existe desde 001 pero es un TIME que nadie escribe, así que no
-- hay dato de cuándo termina un partido y hay que estimarlo por deporte.
-- Espejo de SPORT_DURATION_MINUTES en constants/matches.ts: si cambia uno, cambia
-- el otro. Se usa sólo para saber cuándo pedir el resultado, errarle unos minutos
-- no rompe nada.
CREATE OR REPLACE FUNCTION sport_duration_minutes(p_sport sport_type)
    RETURNS INTEGER AS
$$
SELECT CASE p_sport
           WHEN 'futbol' THEN 90
           WHEN 'basquet' THEN 60
           WHEN 'voley' THEN 75
           WHEN 'tenis' THEN 90
           WHEN 'padel' THEN 90
           -- Un deporte nuevo que nadie agregó acá igual recibe su pedido de
           -- resultado, con la duración más común. Sin ELSE devolvería NULL y el
           -- aviso no saldría nunca, que es más difícil de notar que errarle la hora.
           ELSE 90
           END;
$$ LANGUAGE sql IMMUTABLE;


-- ── 5. Registro de lo ya avisado ──────────────────────────────────────────
-- El encolado corre cada pocos minutos sobre una ventana de tiempo, así que sin
-- registro repetiría el mismo aviso en cada vuelta. No sirve un índice único sobre
-- `notifications`: el aviso de resultado corregido tiene que poder repetirse, y es
-- de este mismo tipo.
CREATE TABLE IF NOT EXISTS match_notification_log
(
    match_id UUID        NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
    user_id  UUID        NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    kind     TEXT        NOT NULL CHECK (kind IN ('reminder', 'result_request')),
    sent_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (match_id, user_id, kind)
);

COMMENT ON TABLE match_notification_log IS 'Qué recordatorio automático ya se encoló para quién. Hace idempotente al encolado.';

-- Tabla de uso interno: la escriben las funciones del encolado, que corren como
-- owner. Sin políticas nadie la lee desde la API.
ALTER TABLE match_notification_log ENABLE ROW LEVEL SECURITY;


-- ── 6. Recordatorio: el partido está por empezar ──────────────────────────
CREATE OR REPLACE FUNCTION enqueue_due_match_reminders()
    RETURNS INTEGER AS
$$
DECLARE
    v_row     RECORD;
    v_minutes INTEGER;
    v_count   INTEGER := 0;
BEGIN
    FOR v_row IN SELECT m.id, m.title, m.venue_name, m.starts_at, mp.user_id
                 FROM matches m
                          JOIN match_participants mp ON mp.match_id = m.id
                          JOIN profiles p ON p.id = mp.user_id
                 WHERE m.status IN ('open', 'full')
                   AND m.starts_at > NOW()
                   AND m.starts_at <= NOW() + INTERVAL '15 minutes'
                   AND mp.user_id IS NOT NULL
                   AND p.notifications_enabled
                   AND p.notify_match_reminder
        LOOP
            -- El registro primero: si otra vuelta del cron ya lo tomó, el conflicto
            -- deja FOUND en false y este no duplica el aviso.
            INSERT INTO match_notification_log (match_id, user_id, kind)
            VALUES (v_row.id, v_row.user_id, 'reminder')
            ON CONFLICT DO NOTHING;

            IF NOT FOUND THEN
                CONTINUE;
            END IF;

            v_minutes := GREATEST(1, ROUND(EXTRACT(EPOCH FROM (v_row.starts_at - NOW())) / 60));

            PERFORM create_notification(
                    v_row.user_id,
                    'match_reminder',
                    '⏰ Tu partido comienza pronto',
                    format('"%s" en %s %s',
                           v_row.title,
                           v_row.venue_name,
                           CASE
                               WHEN v_minutes <= 1 THEN 'está por empezar'
                               ELSE format('comienza en %s minutos', v_minutes)
                               END),
                    jsonb_build_object(
                            'match_id', v_row.id,
                            'match_title', v_row.title,
                            'venue_name', v_row.venue_name,
                            'starts_at', v_row.starts_at
                    )
                    );

            v_count := v_count + 1;
        END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION enqueue_due_match_reminders IS 'Encola el aviso de "tu partido arranca" para los jugadores de los partidos que empiezan en los próximos 15 minutos.';


-- ── 7. Recordatorio: falta cargar el resultado ────────────────────────────
CREATE OR REPLACE FUNCTION enqueue_due_result_requests()
    RETURNS INTEGER AS
$$
DECLARE
    v_row   RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR v_row IN SELECT m.id, m.title, m.creator_id
                 FROM matches m
                          JOIN profiles p ON p.id = m.creator_id
                 WHERE m.status IN ('open', 'full')
                   -- 15 minutos después del final estimado: si el partido se estiró,
                   -- el aviso no le llega al creador mientras todavía está jugando.
                   AND NOW() >= m.starts_at
                     + (sport_duration_minutes(m.sport) * INTERVAL '1 minute')
                     + INTERVAL '15 minutes'
                   -- Sólo lo reciente. Sin este corte, la primera corrida le pediría
                   -- el resultado de cada partido viejo que quedó sin cargar.
                   AND m.starts_at > NOW() - INTERVAL '7 days'
                   AND p.notifications_enabled
                   AND p.notify_match_result
                   AND NOT EXISTS (SELECT 1 FROM match_results r WHERE r.match_id = m.id)
        LOOP
            INSERT INTO match_notification_log (match_id, user_id, kind)
            VALUES (v_row.id, v_row.creator_id, 'result_request')
            ON CONFLICT DO NOTHING;

            IF NOT FOUND THEN
                CONTINUE;
            END IF;

            PERFORM create_notification(
                    v_row.creator_id,
                    'match_result',
                    '📊 ¿Cómo salió?',
                    format('Cargá el resultado de "%s" para que cuente en las estadísticas', v_row.title),
                    jsonb_build_object('match_id', v_row.id, 'match_title', v_row.title)
                    );

            v_count := v_count + 1;
        END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION enqueue_due_result_requests IS 'Encola el pedido de resultado al creador de los partidos que ya terminaron y siguen sin resultado.';


-- ── 8. Las dos cosas juntas, que es lo que corre el cron ───────────────────
CREATE OR REPLACE FUNCTION enqueue_due_match_notifications()
    RETURNS INTEGER AS
$$
SELECT enqueue_due_match_reminders() + enqueue_due_result_requests();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION enqueue_due_match_notifications IS 'Punto de entrada del cron: encola los recordatorios vencidos y devuelve cuántos.';


-- ── 9. Agenda ─────────────────────────────────────────────────────────────
-- Cada 5 minutos. La ventana del recordatorio es de 15, así que un par de corridas
-- perdidas no dejan a nadie sin aviso.
--
-- Best-effort a propósito: si pg_cron no está disponible la migración no falla,
-- avisa. Sin cron las funciones quedan igual y se pueden llamar a mano.
DO
$do$
    BEGIN
        CREATE EXTENSION IF NOT EXISTS pg_cron;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'pg_cron no se pudo habilitar (%). Los recordatorios quedan sin agendar: ver las instrucciones al final de esta migración.', SQLERRM;
    END;
$do$;

DO
$do$
    BEGIN
        IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
            IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'enqueue-match-notifications') THEN
                PERFORM cron.unschedule('enqueue-match-notifications');
            END IF;

            PERFORM cron.schedule(
                    'enqueue-match-notifications',
                    '*/5 * * * *',
                    $cmd$SELECT public.enqueue_due_match_notifications()$cmd$
                    );

            RAISE NOTICE 'Recordatorios agendados cada 5 minutos (job enqueue-match-notifications).';
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            -- Que no se caiga la migración por no poder agendar: las funciones quedan
            -- creadas y agendarlas es un SELECT que se puede correr después.
            RAISE NOTICE 'No se pudo agendar el encolado (%). Ver las instrucciones al final de esta migración.', SQLERRM;
    END;
$do$;

-- =====================================================
-- SI pg_cron NO ESTABA DISPONIBLE
--
-- 1. Dashboard -> Database -> Extensions -> habilitar "pg_cron"
-- 2. SQL Editor, una sola vez:
--
--      SELECT cron.schedule(
--        'enqueue-match-notifications',
--        '*/5 * * * *',
--        $$SELECT public.enqueue_due_match_notifications()$$
--      );
--
-- Para verificar que quedó andando:
--   SELECT * FROM cron.job WHERE jobname = 'enqueue-match-notifications';
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
--
-- RECORDAR: sin el webhook de 014 sobre INSERT en notifications, esto llena el
-- listado de la app pero no manda nada al teléfono.
-- =====================================================
