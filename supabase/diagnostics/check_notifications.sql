-- =====================================================
-- Diagnóstico del sistema de notificaciones
-- Ejecutar en Supabase SQL Editor (cada bloque por separado)
-- =====================================================
--
-- Desde 024 hay un solo canal: todo nace como fila en `notifications` y de ahí
-- sale al teléfono. Los bloques 1 a 3 verifican los dos enganches que se activan
-- a mano y que, si faltan, dejan el sistema a medias.
-- =====================================================

-- ── 1. ¿El envío al teléfono está enganchado? ───────────────────────────────
-- LO PRIMERO QUE HAY QUE MIRAR. Sin un trigger acá, las notificaciones se crean
-- pero nunca suenan. Puede ser el webhook del Dashboard (función
-- supabase_functions.http_request) o el trigger manual de 014 (pg_net).
SELECT t.tgname                       AS trigger_name,
       p.proname                      AS funcion,
       n.nspname                      AS esquema_funcion,
       t.tgenabled                    AS habilitado
FROM pg_trigger t
         JOIN pg_class c ON c.oid = t.tgrelid
         JOIN pg_proc p ON p.oid = t.tgfoid
         JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE c.relname = 'notifications'
  AND NOT t.tgisinternal;

-- ── 2. ¿El encolado de recordatorios está agendado? ─────────────────────────
-- Sin este job no salen ni el "tu partido arranca" ni el "cargá el resultado".
-- Si devuelve 0 filas: habilitar pg_cron y correr el SELECT del final de 024.
SELECT jobid, jobname, schedule, command, active
FROM cron.job
WHERE jobname = 'enqueue-match-notifications';

-- ── 3. ¿Cómo vienen corriendo las últimas vueltas del cron? ─────────────────
SELECT j.jobname, d.status, d.return_message, d.start_time, d.end_time
FROM cron.job_run_details d
         JOIN cron.job j ON j.jobid = d.jobid
WHERE j.jobname = 'enqueue-match-notifications'
ORDER BY d.start_time DESC
LIMIT 10;

-- ── 4. Probar el encolado a mano (sin esperar al cron) ──────────────────────
-- Devuelve cuántas notificaciones encoló. Es idempotente: correrlo dos veces
-- seguidas devuelve 0 la segunda, porque ya quedaron registradas.
SELECT enqueue_due_match_reminders()  AS recordatorios,
       enqueue_due_result_requests()  AS pedidos_de_resultado;

-- ── 5. Qué recordatorios automáticos ya se mandaron ─────────────────────────
SELECT l.kind, l.sent_at, m.title, p.full_name
FROM match_notification_log l
         JOIN matches m ON m.id = l.match_id
         JOIN profiles p ON p.id = l.user_id
ORDER BY l.sent_at DESC
LIMIT 20;

-- ── 6. Últimas notificaciones creadas ───────────────────────────────────────
SELECT id, user_id, type, title, is_read, created_at
FROM notifications
ORDER BY created_at DESC
LIMIT 20;

-- ── 7. Notificaciones de las últimas 24 horas, por tipo ─────────────────────
SELECT type,
       COUNT(*)                                AS total,
       COUNT(*) FILTER (WHERE is_read = false) AS sin_leer
FROM notifications
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY type
ORDER BY total DESC;

-- ── 8. ¿Los usuarios tienen push tokens activos? ────────────────────────────
-- Si está vacío no se guardan tokens (permisos denegados, Expo Go, o el registro
-- de AuthContext fallando). La notificación igual queda en el listado.
SELECT user_id, platform, device_name, is_active, last_used_at
FROM push_tokens
WHERE is_active = true
ORDER BY last_used_at DESC;

-- ── 9. Preferencias del usuario ─────────────────────────────────────────────
-- Un false acá explica una notificación que no llegó sin que nada esté roto.
SELECT id,
       full_name,
       notifications_enabled,
       notify_new_matches,
       notify_join_requests,
       notify_request_response,
       notify_player_joined,
       notify_match_reminder,
       notify_match_result,
       zone,
       notification_radius
FROM profiles
ORDER BY full_name;

-- ── 10. ¿get_nearby_users encuentra a alguien? ──────────────────────────────
-- Desde 024 ya no exige push token, sí zona o coordenadas configuradas.
-- Reemplazar con datos de un partido real.
SELECT *
FROM get_nearby_users(
        NULL::point, -- reemplazar con: '(lng,lat)'::point
        'Buenos Aires', -- reemplazar con la zona del partido
        '00000000-0000-0000-0000-000000000000'::uuid -- reemplazar con creator_id
     );

-- ── 11. Los triggers de notificaciones de la app ────────────────────────────
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE event_object_table IN ('matches', 'join_requests', 'match_players', 'match_participants')
ORDER BY event_object_table;

-- ── 12. Test de punta a punta ───────────────────────────────────────────────
-- ATENCION: crea una notificación real. Si el bloque 1 mostró el trigger, esto
-- tiene que sonar en el teléfono.
/*
SELECT create_notification(
    'TU_USER_ID_AQUI'::uuid,
    'new_match',
    'Test de push notification',
    'Si ves esto en tu dispositivo, el sistema funciona',
    '{"match_id": null}'::jsonb
);
*/
