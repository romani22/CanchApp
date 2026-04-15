-- =====================================================
-- Diagnóstico del sistema de notificaciones
-- Ejecutar en Supabase SQL Editor (cada bloque por separado)
-- =====================================================

-- ── 1. ¿Hay registros en la tabla notifications? ────────────────────────────
-- Debería mostrar filas si los triggers de DB están funcionando.
SELECT id, user_id, type, title, is_read, created_at
FROM notifications
ORDER BY created_at DESC
LIMIT 20;

-- ── 2. ¿Los usuarios tienen push tokens guardados? ──────────────────────────
-- Si está vacío, la app no está guardando tokens (problema de permisos o registro).
SELECT user_id, token, platform, device_name, is_active, last_used_at
FROM push_tokens
WHERE is_active = true
ORDER BY last_used_at DESC;

-- ── 3. ¿Los perfiles tienen push_token (campo legacy)? ──────────────────────
-- get_nearby_users usa este campo para filtrar. Debe coincidir con push_tokens.
SELECT id, full_name, push_token IS NOT NULL AS has_token,
       notifications_enabled, notify_new_matches, zone
FROM profiles
WHERE push_token IS NOT NULL;

-- ── 4. ¿El trigger de push delivery está creado? ────────────────────────────
-- Si devuelve 0 filas, el webhook no está configurado todavía.
SELECT trigger_name, event_manipulation, event_object_table, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'notifications'
  AND trigger_name = 'trigger_push_notification_delivery';

-- ── 5. ¿Los triggers de notificaciones DB existen? ──────────────────────────
-- Todos estos deben existir desde la migración 013.
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE event_object_table IN ('matches', 'join_requests', 'match_players')
ORDER BY event_object_table;

-- ── 6. ¿La función get_nearby_users devuelve resultados? ─────────────────────
-- Reemplazar con coordenadas y zona de un partido real.
-- Si devuelve 0 filas, los usuarios no tienen zona/coordenadas configuradas.
SELECT * FROM get_nearby_users(
    NULL::point,          -- reemplazar con: '(lng,lat)'::point
    'Buenos Aires',       -- reemplazar con la zona del partido
    '00000000-0000-0000-0000-000000000000'::uuid  -- reemplazar con creator_id
);

-- ── 7. Notificaciones de los últimos 24 horas por tipo ───────────────────────
SELECT type, COUNT(*) as total,
       COUNT(*) FILTER (WHERE is_read = false) as unread
FROM notifications
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY type
ORDER BY total DESC;

-- ── 8. Test: crear una notificación manualmente (verifica el trigger de push) ─
-- ATENCION: esto crea una notificación real. Reemplazar user_id con el tuyo.
-- Después de ejecutar, verificar si llega la push notification al dispositivo.
/*
SELECT create_notification(
    'TU_USER_ID_AQUI'::uuid,
    'new_match',
    'Test de push notification',
    'Si ves esto en tu dispositivo, el sistema funciona',
    '{"match_id": null}'::jsonb
);
*/
