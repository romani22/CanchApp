-- =====================================================
-- Migration 015: Notificación de partido cancelado
-- =====================================================
-- Cuando el creador cambia el status del partido a 'cancelled',
-- todos los participantes registrados (match_participants + match_players)
-- reciben una notificación push.
-- =====================================================

CREATE OR REPLACE FUNCTION notify_participants_on_match_cancel()
RETURNS TRIGGER AS $$
DECLARE
    v_user RECORD;
BEGIN
    IF OLD.status != 'cancelled' AND NEW.status = 'cancelled' THEN
        -- Notificar a todos los participantes registrados (excluyendo al creador)
        -- Incluye tanto match_participants como match_players (usuarios registrados, no invitados)
        FOR v_user IN
            SELECT DISTINCT user_id FROM (
                SELECT user_id FROM match_participants
                 WHERE match_id = NEW.id
                UNION
                SELECT user_id FROM match_players
                 WHERE match_id = NEW.id
                   AND user_id IS NOT NULL
            ) AS all_users
            WHERE user_id != NEW.creator_id
        LOOP
            PERFORM create_notification(
                v_user.user_id,
                'match_cancelled',
                'Partido cancelado ❌',
                format('"%s" en %s fue cancelado', NEW.title, NEW.venue_name),
                jsonb_build_object(
                    'match_id',    NEW.id,
                    'match_title', NEW.title,
                    'venue_name',  NEW.venue_name,
                    'starts_at',   NEW.starts_at
                )
            );
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_match_cancelled ON matches;
CREATE TRIGGER trigger_notify_match_cancelled
    AFTER UPDATE ON matches
    FOR EACH ROW
    EXECUTE FUNCTION notify_participants_on_match_cancel();
