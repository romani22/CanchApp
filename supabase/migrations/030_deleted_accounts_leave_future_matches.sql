-- =====================================================
-- Migración 030: una cuenta borrada sale de los partidos que vienen
-- =====================================================
--
-- La 028 cancela los partidos que la persona ORGANIZABA, pero no la saca de los de
-- OTROS. Seguía ocupando un lugar —el organizador la contaba como que iba, medido:
-- un partido de 4 quedaba en `open` con `players_needed = 2`— y le seguían entrando
-- notificaciones.
--
-- Mismo criterio que la 028, aplicado del otro lado: lo que ya pasó se conserva, lo
-- que todavía no pasó se limpia.


-- ============================================================
-- 1. Ninguna notificación nueva para una cuenta borrada
-- ============================================================
-- El guard va acá porque create_notification() es el único lugar que inserta en
-- notifications: los doce llamadores pasan por adelante. El bloque 2 no alcanza —
-- cargar el resultado de un partido ya jugado también notifica a sus participantes.
--
-- Devuelve NULL en vez de fallar: los llamadores son triggers, y voltear el guardado
-- de un resultado porque un jugador borró su cuenta sería peor que el problema.
CREATE OR REPLACE FUNCTION public.create_notification(
    p_user_id UUID,
    p_type TEXT,
    p_title TEXT,
    p_body TEXT,
    p_data JSONB DEFAULT '{}'::JSONB
)
    RETURNS UUID
    SECURITY DEFINER
    SET search_path = public
AS
$$
DECLARE
    notification_id UUID;
BEGIN
    IF EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND deleted_at IS NOT NULL) THEN
        RETURN NULL;
    END IF;

    INSERT INTO notifications (user_id, type, title, body, data, is_read)
    VALUES (p_user_id, p_type::notification_type, p_title, p_body, p_data, false)
    RETURNING id INTO notification_id;

    RETURN notification_id;
END;
$$ LANGUAGE plpgsql;

-- La 025 la dejó fuera del alcance del cliente y CREATE OR REPLACE conserva los
-- permisos, pero se reafirma para que no dependa de ese detalle.
REVOKE ALL ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;


-- ============================================================
-- 2. Salir de los partidos que todavía no se jugaron
-- ============================================================
-- Igual a la 028 más un DELETE sobre match_participants. Va después del UPDATE que
-- cancela los partidos propios: ese UPDATE avisa a los participantes y el aviso
-- tiene que salir mientras el partido todavía los tiene.
CREATE OR REPLACE FUNCTION public.delete_my_account()
    RETURNS VOID
    SECURITY DEFINER
    SET search_path = public, auth
AS
$$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Hay que estar autenticado para borrar la cuenta';
    END IF;

    -- Un partido sin organizador no lo puede cancelar nadie después: las policies
    -- de `matches` piden ser el creador. El UPDATE avisa a los participantes.
    UPDATE matches
    SET status = 'cancelled'
    WHERE creator_id = v_user_id
      AND starts_at > NOW()
      AND status <> 'cancelled';

    -- Los partidos que vienen y organizaba otro: deja el lugar libre. El DELETE
    -- dispara update_match_player_count, así que el cupo se recalcula solo.
    -- Los ya jugados no se tocan, son el historial que la 028 existe para conservar.
    DELETE FROM match_participants
    WHERE user_id = v_user_id
      AND match_id IN (SELECT id FROM matches WHERE starts_at > NOW());

    -- Identificadores de dispositivo. Además corta los push.
    DELETE FROM push_tokens WHERE user_id = v_user_id;

    DELETE FROM notifications WHERE user_id = v_user_id;
    DELETE FROM match_notification_log WHERE user_id = v_user_id;

    -- Trámites en curso, no historia.
    DELETE FROM join_requests WHERE user_id = v_user_id;

    -- Las que RECIBIÓ describen a una persona que ya no está.
    DELETE FROM match_ratings WHERE rated_user_id = v_user_id;

    -- Las que DIO conservan el puntaje: el rating de los demás se calculó con él y
    -- on_new_rating es AFTER INSERT, no recalcula al borrar. Se va el comentario,
    -- que es texto que escribió la persona.
    UPDATE match_ratings SET comment = NULL WHERE rater_id = v_user_id;

    -- `email` va a cadena vacía porque la columna es NOT NULL. `rating` vuelve al
    -- default porque las calificaciones que lo sostenían se acaban de borrar.
    UPDATE profiles
    SET email                 = '',
        full_name             = 'Usuario eliminado',
        avatar_url            = NULL,
        phone                 = NULL,
        bio                   = NULL,
        zone                  = NULL,
        zone_coordinates      = NULL,
        push_token            = NULL,
        notifications_enabled = false,
        rating                = 5.00,
        rating_count          = 0,
        deleted_at            = NOW()
    WHERE id = v_user_id;

    -- Último a propósito: si algo de arriba falla, la transacción vuelve atrás y la
    -- cuenta sigue existiendo. Es preferible un borrado incompleto a una cuenta
    -- borrada a medias, con el usuario afuera y sus datos adentro.
    DELETE FROM auth.users WHERE id = v_user_id;
END;
$$ LANGUAGE plpgsql;
