ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'new_message';

CREATE OR REPLACE FUNCTION notify_match_creator()
RETURNS TRIGGER AS $$
DECLARE
    match_creator UUID;
BEGIN
    SELECT creator_id INTO match_creator
    FROM matches
    WHERE id = NEW.match_id;

    INSERT INTO notifications (
        user_id,
        type,
        title,
        body,
        data
    )
    VALUES (
        match_creator,
        'join_request',
        'Nueva solicitud',
        'Alguien quiere unirse a tu partido',
        jsonb_build_object('match_id', NEW.match_id, 'request_id', NEW.id)
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE TRIGGER on_join_request_created
AFTER INSERT ON join_requests
FOR EACH ROW
EXECUTE FUNCTION notify_match_creator();