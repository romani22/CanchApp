-- =====================================================
-- Migration 014: Push Notification Delivery
-- =====================================================
--
-- Esta migracion hace dos cosas:
--
-- 1. Crea la funcion trigger call_push_notification_edge_function
--    para llamar a la Edge Function via pg_net (activacion manual).
--
-- 2. Actualiza notify_user_on_request_response para incluir
--    match_title, venue_name y starts_at en el campo data de la
--    notificacion, permitiendo al cliente programar un recordatorio
--    local sin un fetch extra.
--
-- PARA ACTIVAR EL PUSH: ver instrucciones al final del archivo.
-- =====================================================

-- 1. Funcion que llama a la Edge Function via pg_net
CREATE OR REPLACE FUNCTION call_push_notification_edge_function()
RETURNS TRIGGER AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_key  TEXT;
BEGIN
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_key  := current_setting('app.settings.service_role_key', true);

  IF v_supabase_url IS NULL OR v_supabase_url = ''
     OR v_service_key IS NULL OR v_service_key = '' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_supabase_url || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body    := jsonb_build_object('record', row_to_json(NEW))
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Push delivery skipped for notification %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Actualizar notify_user_on_request_response con datos del partido
CREATE OR REPLACE FUNCTION notify_user_on_request_response()
RETURNS TRIGGER AS $$
DECLARE
  v_match_title TEXT;
  v_venue_name  TEXT;
  v_starts_at   TIMESTAMPTZ;
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('accepted', 'rejected') THEN
    SELECT title, venue_name, starts_at
    INTO v_match_title, v_venue_name, v_starts_at
    FROM matches
    WHERE id = NEW.match_id;

    PERFORM create_notification(
      NEW.user_id,
      CASE WHEN NEW.status = 'accepted' THEN 'request_accepted' ELSE 'request_rejected' END,
      CASE WHEN NEW.status = 'accepted' THEN 'Solicitud aceptada!' ELSE 'Solicitud rechazada' END,
      CASE
        WHEN NEW.status = 'accepted' THEN format('Te uniste a "%s"', v_match_title)
        ELSE format('Tu solicitud para "%s" fue rechazada', v_match_title)
      END,
      jsonb_build_object(
        'match_id',    NEW.match_id,
        'request_id',  NEW.id,
        'status',      NEW.status,
        'match_title', v_match_title,
        'venue_name',  v_venue_name,
        'starts_at',   v_starts_at
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PARA ACTIVAR EL PUSH DELIVERY (elegir una opcion):
--
-- OPCION A - Dashboard (recomendado, sin ALTER)
-- 1. Supabase Dashboard -> Database -> Webhooks
-- 2. "Create a new hook"
-- 3. Tabla: notifications | Evento: INSERT
-- 4. Tipo: Edge Functions -> send-push-notification
-- Listo. Supabase maneja las credenciales automaticamente.
--
-- OPCION B - pg_net manual (SQL Editor, una sola vez)
-- Reemplazar con tus valores y ejecutar:
--
--   ALTER ROLE postgres SET app.settings.supabase_url
--     TO 'https://TU_PROJECT_REF.supabase.co';
--   ALTER ROLE postgres SET app.settings.service_role_key
--     TO 'TU_SERVICE_ROLE_KEY';
--
--   CREATE TRIGGER trigger_push_notification_delivery
--     AFTER INSERT ON notifications
--     FOR EACH ROW
--     EXECUTE FUNCTION call_push_notification_edge_function();
-- =====================================================
