-- =====================================================
-- Diagnóstico del sistema de notificaciones
-- Ejecutar en Supabase SQL Editor (cada bloque por separado)
-- =====================================================
--
-- Desde 024 hay un solo canal: todo nace como fila en `notifications` y de ahí
-- sale al teléfono. Los bloques 1 a 3 verifican los dos enganches que se activan
-- a mano y que, si faltan, dejan el sistema a medias.
--
-- SI LA NOTIFICACION APARECE EN EL LISTADO PERO NO LLEGA AL TELEFONO: ir directo
-- al bloque 12, que resume en una fila las tres razones por las que la Edge
-- Function corta sin enviar.
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

-- ── 12. Está en el listado y no llegó al teléfono: ¿por qué? ────────────────
-- La Edge Function corta sin enviar por tres razones, y las tres se ven acá:
-- el global apagado, la preferencia del tipo apagada, o cero tokens activos.
-- El CASE es espejo de TYPE_TO_PREF en supabase/functions/send-push-notification:
-- si se agrega un tipo allá, se agrega acá.
--
-- Si las tres columnas están bien y la notificación igual no sonó, el corte está
-- más adelante y ya no se ve desde SQL: Dashboard -> Edge Functions ->
-- send-push-notification -> Logs. Lo que loguea dice exactamente dónde paró.
--   "Profile not found"          -> la función deployada pide una columna que la
--                                   base no tiene (024 sin aplicar en remoto).
--   "No tokens"                  -> ver el bloque 8.
--   "Expo Push API error" / error por token -> credenciales FCM (`eas credentials`).
--   "Push sent to N device(s)"   -> salió de Supabase; el problema es del device.
-- Y si no hay ningún log para esa notificación, no se disparó el webhook: bloque 1.
SELECT n.created_at,
       n.type,
       n.title,
       p.full_name,
       p.notifications_enabled                                                     AS global,
       CASE n.type
           WHEN 'new_match' THEN p.notify_new_matches
           WHEN 'join_request' THEN p.notify_join_requests
           WHEN 'request_accepted' THEN p.notify_request_response
           WHEN 'request_rejected' THEN p.notify_request_response
           WHEN 'player_joined' THEN p.notify_player_joined
           WHEN 'match_reminder' THEN p.notify_match_reminder
           WHEN 'match_result' THEN p.notify_match_result
           -- match_cancelled y cualquier tipo sin preferencia propia: sale
           -- siempre que el global esté prendido.
           ELSE p.notifications_enabled
           END                                                                     AS preferencia_del_tipo,
       (SELECT COUNT(*)
        FROM push_tokens t
        WHERE t.user_id = n.user_id
          AND t.is_active)                                                         AS tokens_activos
FROM notifications n
         JOIN profiles p ON p.id = n.user_id
ORDER BY n.created_at DESC
LIMIT 10;


-- ── 13. Test de punta a punta ───────────────────────────────────────────────
-- ATENCION: crea una notificación real. Si el bloque 1 mostró el trigger, esto
-- tiene que sonar en el teléfono.
--
-- El tipo es 'match_cancelled' a propósito: es el único que la Edge Function no
-- filtra por preferencia individual (su entrada en TYPE_TO_PREF es el switch
-- global), así que el test no puede fallar por un toggle apagado y aísla el
-- problema en la entrega.
--
-- Le pega al dispositivo del último token activo. Para elegir otro, reemplazar
-- el subselect por el user_id, o filtrar por token:
--   WHERE token = 'ExponentPushToken[...]'
--
-- Devuelve el UUID de la notificación: con ese id se busca la corrida en
-- Dashboard -> Edge Functions -> send-push-notification -> Logs. Tiene que decir
-- "Push sent to N device(s)" y no traer ningún "Push error for token".
/*
SELECT create_notification(
    (SELECT user_id FROM push_tokens WHERE is_active ORDER BY last_used_at DESC LIMIT 1),
    'match_cancelled',
    '🔔 Test de push',
    'Si esto te suena en el teléfono, la entrega funciona',
    '{}'::jsonb
);
*/
