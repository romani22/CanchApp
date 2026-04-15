-- =====================================================
-- Migration 013: Sistema Completo de Notificaciones y Jugadores
-- =====================================================

-- 1. Agregar configuración de notificaciones al perfil
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_radius INTEGER DEFAULT 20000; -- Radio en metros (20km default)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_new_matches BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_join_requests BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_request_response BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_player_joined BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_match_reminder BOOLEAN DEFAULT true;

-- 2. Tabla para jugadores adicionales (invitados)
CREATE TABLE IF NOT EXISTS match_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  added_by_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- NULL si es invitado
  player_name TEXT NOT NULL, -- Nombre del jugador
  team_slot TEXT CHECK (team_slot IN ('A', 'B', NULL)),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraint: no duplicados (mismo user_id o nombre)
  CONSTRAINT unique_player_per_match UNIQUE(match_id, user_id, player_name)
);

-- Índices para match_players
CREATE INDEX IF NOT EXISTS idx_match_players_match_id ON match_players(match_id);
CREATE INDEX IF NOT EXISTS idx_match_players_user_id ON match_players(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_match_players_added_by ON match_players(added_by_user_id);

-- 3. Políticas RLS para match_players
ALTER TABLE match_players ENABLE ROW LEVEL SECURITY;

-- Todos pueden ver los jugadores de un partido
CREATE POLICY "Anyone can view match players"
  ON match_players FOR SELECT
  USING (true);

-- Solo usuarios autenticados pueden agregar jugadores
CREATE POLICY "Authenticated users can add players"
  ON match_players FOR INSERT
  WITH CHECK (auth.uid() = added_by_user_id);

-- Solo quien agregó puede eliminar (o el creador del partido)
CREATE POLICY "Can delete own added players or creator can delete"
  ON match_players FOR DELETE
  USING (
    auth.uid() = added_by_user_id 
    OR auth.uid() IN (
      SELECT creator_id FROM matches WHERE id = match_id
    )
  );

-- 4. Tabla para push tokens de dispositivos (múltiples dispositivos por usuario)
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_token_per_user UNIQUE(user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON push_tokens(is_active) WHERE is_active = true;

-- RLS para push_tokens
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own push tokens"
  ON push_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Función para obtener usuarios cercanos a un partido
CREATE OR REPLACE FUNCTION get_nearby_users(
  match_coordinates POINT,
  match_zone TEXT,
  creator_user_id UUID
)
RETURNS TABLE (
  user_id UUID,
  push_token TEXT,
  notification_radius INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.push_token,
    p.notification_radius
  FROM profiles p
  WHERE 
    p.id != creator_user_id
    AND p.notifications_enabled = true
    AND p.notify_new_matches = true
    AND p.push_token IS NOT NULL
    AND (
      -- Si el usuario tiene zona configurada y coincide
      (p.zone IS NOT NULL AND p.zone = match_zone)
      OR
      -- O si está dentro del radio configurado usando coordenadas
      (
        match_coordinates IS NOT NULL 
        AND p.zone_coordinates IS NOT NULL
        AND (
          (6371000 * acos(
            cos(radians(match_coordinates[1])) * 
            cos(radians(p.zone_coordinates[1])) * 
            cos(radians(p.zone_coordinates[0]) - radians(match_coordinates[0])) + 
            sin(radians(match_coordinates[1])) * 
            sin(radians(p.zone_coordinates[1]))
          )) <= p.notification_radius
        )
      )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Función para agregar múltiples jugadores de una vez
CREATE OR REPLACE FUNCTION add_multiple_players(
  p_match_id UUID,
  p_added_by_user_id UUID,
  p_players JSONB
)
RETURNS TABLE (
  success BOOLEAN,
  player_id UUID,
  player_name TEXT,
  error_message TEXT
) AS $$
DECLARE
  player JSONB;
  inserted_id UUID;
  match_full BOOLEAN;
  current_count INTEGER;
  total_players INTEGER;
BEGIN
  -- Verificar que el partido existe y no está lleno
  SELECT 
    (current_players >= total_players),
    current_players,
    total_players
  INTO match_full, current_count, total_players
  FROM matches 
  WHERE id = p_match_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, ''::TEXT, 'Partido no encontrado';
    RETURN;
  END IF;

  -- Procesar cada jugador
  FOR player IN SELECT * FROM jsonb_array_elements(p_players)
  LOOP
    BEGIN
      -- Verificar si hay espacio
      IF current_count >= total_players THEN
        RETURN QUERY SELECT 
          false, 
          NULL::UUID, 
          player->>'player_name', 
          'Partido lleno';
        CONTINUE;
      END IF;

      -- Insertar jugador
      INSERT INTO match_players (
        match_id,
        added_by_user_id,
        user_id,
        player_name,
        team_slot
      ) VALUES (
        p_match_id,
        p_added_by_user_id,
        (player->>'user_id')::UUID,
        player->>'player_name',
        player->>'team_slot'
      )
      RETURNING id INTO inserted_id;

      -- Incrementar contador
      current_count := current_count + 1;

      -- Actualizar current_players en el partido
      UPDATE matches 
      SET current_players = current_count
      WHERE id = p_match_id;

      RETURN QUERY SELECT 
        true, 
        inserted_id, 
        player->>'player_name', 
        NULL::TEXT;

    EXCEPTION WHEN unique_violation THEN
      RETURN QUERY SELECT 
        false, 
        NULL::UUID, 
        player->>'player_name', 
        'Jugador ya agregado';
    WHEN OTHERS THEN
      RETURN QUERY SELECT 
        false, 
        NULL::UUID, 
        player->>'player_name', 
        SQLERRM;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Función para eliminar un jugador y actualizar contador
CREATE OR REPLACE FUNCTION remove_match_player(
  p_player_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_match_id UUID;
BEGIN
  -- Obtener match_id antes de eliminar
  SELECT match_id INTO v_match_id
  FROM match_players
  WHERE id = p_player_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Eliminar jugador
  DELETE FROM match_players WHERE id = p_player_id;

  -- Actualizar contador del partido
  UPDATE matches
  SET current_players = (
    SELECT COUNT(*) FROM match_players WHERE match_id = v_match_id
  ) + (
    SELECT COUNT(*) FROM match_participants WHERE match_id = v_match_id
  )
  WHERE id = v_match_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Trigger: Actualizar current_players cuando se agrega un jugador registrado
CREATE OR REPLACE FUNCTION update_match_players_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE matches 
    SET current_players = current_players + 1
    WHERE id = NEW.match_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE matches 
    SET current_players = GREATEST(current_players - 1, 0)
    WHERE id = OLD.match_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a match_players (si no existe)
DROP TRIGGER IF EXISTS trigger_update_players_count ON match_players;
CREATE TRIGGER trigger_update_players_count
  AFTER INSERT OR DELETE ON match_players
  FOR EACH ROW
  EXECUTE FUNCTION update_match_players_count();

-- 9. Función para enviar notificación (crea registro en DB)
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO notifications (
    user_id,
    type,
    title,
    body,
    data,
    is_read
  ) VALUES (
    p_user_id,
    p_type::notification_type,
    p_title,
    p_body,
    p_data,
    false
  )
  RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Trigger: Notificar cuando se crea un partido (usuarios cercanos)
CREATE OR REPLACE FUNCTION notify_nearby_users_on_match_create()
RETURNS TRIGGER AS $$
DECLARE
  nearby_user RECORD;
BEGIN
  -- Solo si el partido está abierto
  IF NEW.status = 'open' THEN
    FOR nearby_user IN 
      SELECT * FROM get_nearby_users(
        NEW.venue_coordinates,
        NEW.venue_zone,
        NEW.creator_id
      )
    LOOP
      PERFORM create_notification(
        nearby_user.user_id,
        'new_match',
        'Nuevo partido cerca de ti 🎾',
        format('Hay un partido de %s en %s', NEW.sport, NEW.venue_name),
        jsonb_build_object(
          'match_id', NEW.id,
          'match_title', NEW.title,
          'sport', NEW.sport,
          'venue_name', NEW.venue_name
        )
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_nearby_users ON matches;
CREATE TRIGGER trigger_notify_nearby_users
  AFTER INSERT ON matches
  FOR EACH ROW
  EXECUTE FUNCTION notify_nearby_users_on_match_create();

-- 11. Trigger: Notificar al creador cuando alguien solicita unirse
CREATE OR REPLACE FUNCTION notify_creator_on_join_request()
RETURNS TRIGGER AS $$
DECLARE
  creator_id UUID;
  user_name TEXT;
  match_title TEXT;
BEGIN
  IF NEW.status = 'pending' THEN
    -- Obtener datos del partido y usuario
    SELECT m.creator_id, m.title, p.full_name
    INTO creator_id, match_title, user_name
    FROM matches m
    JOIN profiles p ON p.id = NEW.user_id
    WHERE m.id = NEW.match_id;

    -- Crear notificación para el creador
    PERFORM create_notification(
      creator_id,
      'join_request',
      'Nueva solicitud de unión 📩',
      format('%s quiere unirse a "%s"', user_name, match_title),
      jsonb_build_object(
        'request_id', NEW.id,
        'match_id', NEW.match_id,
        'user_id', NEW.user_id,
        'user_name', user_name
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_creator_join_request ON join_requests;
CREATE TRIGGER trigger_notify_creator_join_request
  AFTER INSERT ON join_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_creator_on_join_request();

-- 12. Trigger: Notificar al usuario cuando su solicitud es aceptada/rechazada
CREATE OR REPLACE FUNCTION notify_user_on_request_response()
RETURNS TRIGGER AS $$
DECLARE
  match_title TEXT;
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('accepted', 'rejected') THEN
    SELECT title INTO match_title
    FROM matches
    WHERE id = NEW.match_id;

    PERFORM create_notification(
      NEW.user_id,
      CASE 
        WHEN NEW.status = 'accepted' THEN 'request_accepted'
        ELSE 'request_rejected'
      END,
      CASE 
        WHEN NEW.status = 'accepted' THEN '¡Solicitud aceptada! ✅'
        ELSE 'Solicitud rechazada ❌'
      END,
      CASE 
        WHEN NEW.status = 'accepted' THEN format('Te uniste a "%s"', match_title)
        ELSE format('Tu solicitud para "%s" fue rechazada', match_title)
      END,
      jsonb_build_object(
        'match_id', NEW.match_id,
        'request_id', NEW.id,
        'status', NEW.status
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_request_response ON join_requests;
CREATE TRIGGER trigger_notify_request_response
  AFTER UPDATE ON join_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_user_on_request_response();

-- 13. Trigger: Notificar cuando alguien es agregado directamente a un partido
CREATE OR REPLACE FUNCTION notify_user_on_player_added()
RETURNS TRIGGER AS $$
DECLARE
  match_title TEXT;
  added_by_name TEXT;
BEGIN
  -- Solo notificar si el jugador agregado es un usuario registrado y no se agregó a sí mismo
  IF NEW.user_id IS NOT NULL AND NEW.user_id != NEW.added_by_user_id THEN
    SELECT m.title, p.full_name
    INTO match_title, added_by_name
    FROM matches m
    JOIN profiles p ON p.id = NEW.added_by_user_id
    WHERE m.id = NEW.match_id;

    PERFORM create_notification(
      NEW.user_id,
      'player_joined',
      'Te agregaron a un partido 👥',
      format('%s te agregó a "%s"', added_by_name, match_title),
      jsonb_build_object(
        'match_id', NEW.match_id,
        'added_by_user_id', NEW.added_by_user_id,
        'added_by_name', added_by_name
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_player_added ON match_players;
CREATE TRIGGER trigger_notify_player_added
  AFTER INSERT ON match_players
  FOR EACH ROW
  EXECUTE FUNCTION notify_user_on_player_added();

-- 14. Función para programar recordatorios de partido (se ejecuta desde el cliente)
CREATE OR REPLACE FUNCTION get_upcoming_matches_for_reminders()
RETURNS TABLE (
  match_id UUID,
  user_id UUID,
  match_title TEXT,
  venue_name TEXT,
  starts_at TIMESTAMPTZ,
  push_token TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    m.id,
    COALESCE(mp.user_id, mpart.user_id) as user_id,
    m.title,
    m.venue_name,
    m.starts_at,
    p.push_token
  FROM matches m
  LEFT JOIN match_players mp ON mp.match_id = m.id
  LEFT JOIN match_participants mpart ON mpart.match_id = m.id
  JOIN profiles p ON p.id = COALESCE(mp.user_id, mpart.user_id)
  WHERE 
    m.status = 'open'
    AND m.starts_at > NOW()
    AND m.starts_at <= NOW() + INTERVAL '15 minutes'
    AND p.notifications_enabled = true
    AND p.notify_match_reminder = true
    AND p.push_token IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 15. Vista para estadísticas de notificaciones
CREATE OR REPLACE VIEW notification_stats AS
SELECT 
  user_id,
  COUNT(*) as total_notifications,
  COUNT(*) FILTER (WHERE is_read = false) as unread_count,
  COUNT(*) FILTER (WHERE type = 'new_match') as new_matches,
  COUNT(*) FILTER (WHERE type = 'join_request') as join_requests,
  COUNT(*) FILTER (WHERE type = 'request_accepted') as accepted_requests,
  COUNT(*) FILTER (WHERE type = 'request_rejected') as rejected_requests,
  MAX(created_at) as last_notification_at
FROM notifications
GROUP BY user_id;

-- 16. Índices adicionales para optimización
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_matches_starts_at ON matches(starts_at) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_join_requests_status ON join_requests(status) WHERE status = 'pending';

-- 17. Comentarios para documentación
COMMENT ON TABLE match_players IS 'Jugadores adicionales agregados a un partido, pueden ser usuarios registrados o invitados';
COMMENT ON TABLE push_tokens IS 'Tokens de notificaciones push para múltiples dispositivos por usuario';
COMMENT ON COLUMN profiles.notification_radius IS 'Radio en metros para recibir notificaciones de partidos cercanos';
COMMENT ON FUNCTION get_nearby_users IS 'Obtiene usuarios dentro del radio de notificación de un partido';
COMMENT ON FUNCTION add_multiple_players IS 'Agrega múltiples jugadores a un partido de una vez';
