-- =====================================================
-- Migration 022: Unirse a un partido requiere aprobación del creador
-- =====================================================
--
-- Hasta ahora el botón "Unirme al partido" insertaba directo en
-- match_participants: cualquiera que viera el partido en Explorar entraba sin
-- que el creador pudiera decir nada. La tabla join_requests, la pantalla de
-- solicitudes y las notificaciones ya existían desde 001/013, pero el camino
-- del detalle del partido las salteaba.
--
-- Acá se cierra el circuito del lado de la base:
--   * Nadie puede anotarse solo: la política de INSERT de match_participants
--     deja de aceptar auth.uid() = user_id. Sin esto, alcanzaba con pegarle a
--     la API para saltear la aprobación, por más que la app pida la solicitud.
--   * accept_join_request pasa a validar quién acepta y si hay lugar.
--   * Las solicitudes guardan el equipo pedido, para no perderlo al aceptar.
-- =====================================================


-- ── 1. Equipo pedido al solicitar ──────────────────────────────────────────
-- En un partido con equipos el jugador elige lado al pedir entrar; sin esta
-- columna, al aceptarlo entraba sin equipo y el creador tenía que asignarlo.
ALTER TABLE join_requests
    ADD COLUMN IF NOT EXISTS team_slot TEXT CHECK (team_slot IN ('A', 'B'));

COMMENT ON COLUMN join_requests.team_slot IS 'Equipo que pidió el jugador (modo two_teams). NULL si el partido no usa equipos.';


-- ── 2. Aceptar una solicitud ───────────────────────────────────────────────
-- La versión de 007 eran dos sentencias sin ninguna validación: no miraba quién
-- llamaba, ni si la solicitud seguía pendiente, ni si el partido tenía lugar, y
-- corría con los permisos del que llamaba. Aceptar dos veces la misma solicitud
-- insertaba dos participantes (o fallaba por el UNIQUE, según el orden).
CREATE OR REPLACE FUNCTION accept_join_request(request_id UUID)
    RETURNS VOID AS
$$
DECLARE
    v_request join_requests;
    v_match   matches;
    v_count   INTEGER;
BEGIN
    SELECT * INTO v_request FROM join_requests WHERE id = request_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La solicitud no existe';
    END IF;

    IF v_request.status <> 'pending' THEN
        RAISE EXCEPTION 'Esa solicitud ya fue respondida';
    END IF;

    -- FOR UPDATE: dos solicitudes aceptadas a la vez contarían las dos sobre el
    -- mismo COUNT viejo y podrían meter un jugador de más en un partido completo.
    SELECT * INTO v_match FROM matches WHERE id = v_request.match_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El partido no existe';
    END IF;

    IF v_match.creator_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Sólo el creador del partido puede aceptar jugadores';
    END IF;

    IF v_match.status = 'cancelled' THEN
        RAISE EXCEPTION 'El partido fue cancelado';
    END IF;

    IF v_match.status = 'completed' THEN
        RAISE EXCEPTION 'El partido ya se jugó';
    END IF;

    SELECT COUNT(*) INTO v_count FROM match_participants WHERE match_id = v_request.match_id;

    IF v_count >= v_match.total_players THEN
        RAISE EXCEPTION 'El partido ya está completo';
    END IF;

    UPDATE join_requests
    SET status     = 'accepted',
        updated_at = NOW()
    WHERE id = request_id;

    -- Si ya era participante (lo agregó el creador a mano mientras la solicitud
    -- estaba pendiente), aceptar sólo cierra la solicitud.
    --
    -- Chequeo explícito y no ON CONFLICT: sobre match_participants hay dos índices
    -- únicos candidatos —el UNIQUE(match_id, user_id) de 001 y el parcial
    -- unique_user_per_match de 004— y de cuál infiere ON CONFLICT depende de qué
    -- migraciones se aplicaron. Así no depende de eso.
    IF NOT EXISTS (SELECT 1
                   FROM match_participants
                   WHERE match_id = v_request.match_id
                     AND user_id = v_request.user_id) THEN
        INSERT INTO match_participants (match_id, user_id, team_slot)
        VALUES (v_request.match_id, v_request.user_id, v_request.team_slot);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION accept_join_request IS 'Acepta una solicitud pendiente y suma al jugador. Sólo el creador, y sólo si hay lugar.';


-- ── 3. Rechazar una solicitud ──────────────────────────────────────────────
-- La app venía haciendo el UPDATE directo (la política de RLS lo permite al
-- creador). Como función explícita valida además el estado, y el mensaje de error
-- es el mismo que en aceptar.
CREATE OR REPLACE FUNCTION reject_join_request(request_id UUID)
    RETURNS VOID AS
$$
DECLARE
    v_request join_requests;
    v_creator UUID;
BEGIN
    SELECT * INTO v_request FROM join_requests WHERE id = request_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La solicitud no existe';
    END IF;

    IF v_request.status <> 'pending' THEN
        RAISE EXCEPTION 'Esa solicitud ya fue respondida';
    END IF;

    SELECT creator_id INTO v_creator FROM matches WHERE id = v_request.match_id;

    IF v_creator IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Sólo el creador del partido puede rechazar jugadores';
    END IF;

    UPDATE join_requests
    SET status     = 'rejected',
        updated_at = NOW()
    WHERE id = request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ── 4. Nadie se anota solo ─────────────────────────────────────────────────
-- Es la parte que de verdad hace obligatoria la aprobación: la política de 001
-- aceptaba `auth.uid() = user_id`, así que un insert directo contra la API
-- salteaba la solicitud por completo.
--
-- Siguen entrando participantes por dos caminos, los dos legítimos:
--   * el creador, que agrega a quien quiera (incluidos invitados sin cuenta);
--   * accept_join_request, que es SECURITY DEFINER y no pasa por RLS.
DROP POLICY IF EXISTS "Match creators can add participants" ON match_participants;
DROP POLICY IF EXISTS "Only match creators can add participants" ON match_participants;
CREATE POLICY "Only match creators can add participants"
    ON match_participants FOR INSERT
    WITH CHECK (
        auth.uid() IN (SELECT creator_id FROM matches WHERE id = match_id)
        );

-- Salir del partido sigue siendo cosa de cada uno (y el creador puede sacar a
-- cualquiera): esta política no cambia, se recrea igual para que aplicar la
-- migración sobre una base que la haya perdido también la deje andando.
DROP POLICY IF EXISTS "Match creators can remove participants" ON match_participants;
CREATE POLICY "Match creators can remove participants"
    ON match_participants FOR DELETE
    USING (
        auth.uid() IN (SELECT creator_id FROM matches WHERE id = match_id)
            OR auth.uid() = user_id
        );


-- ── 5. Una sola notificación por solicitud ─────────────────────────────────
-- Había DOS triggers avisando al creador del mismo INSERT: on_join_request_created
-- (005, con notify_match_creator) y trigger_notify_creator_join_request (013).
-- Cada solicitud generaba dos notificaciones. No se notaba porque hasta ahora
-- ninguna pantalla llevaba a pedir entrar; con el flujo de aprobación obligatorio
-- le pasaría a todo el mundo.
--
-- Se queda el de 013, que dice quién pidió entrar ("Fulano quiere unirse a X") y
-- manda user_id/user_name en el payload. El de 005 decía "Alguien quiere unirse a
-- tu partido" y no servía para armar la tarjeta de la solicitud.
DROP TRIGGER IF EXISTS on_join_request_created ON join_requests;
DROP FUNCTION IF EXISTS notify_match_creator();


-- ── 6. Volver a pedir entrar después de un rechazo ─────────────────────────
-- join_requests tiene UNIQUE(match_id, user_id): una segunda solicitud no es una
-- fila nueva, es la misma volviendo a 'pending'. El trigger de 013 sólo avisaba
-- al creador en el INSERT, así que ese segundo pedido no le llegaba a nadie.
CREATE OR REPLACE FUNCTION notify_creator_on_join_request()
    RETURNS TRIGGER AS
$$
DECLARE
    v_creator_id  UUID;
    v_user_name   TEXT;
    v_match_title TEXT;
BEGIN
    IF NEW.status <> 'pending' THEN
        RETURN NEW;
    END IF;

    -- Al insertar, o al volver a 'pending' desde un rechazo. Un UPDATE que ya venía
    -- pendiente (por ejemplo, cambiar el mensaje) no vuelve a avisar. La rama se
    -- separa por TG_OP porque en un INSERT no existe OLD.
    IF TG_OP = 'UPDATE' AND OLD.status = 'pending' THEN
        RETURN NEW;
    END IF;

    SELECT m.creator_id, m.title, p.full_name
    INTO v_creator_id, v_match_title, v_user_name
    FROM matches m
             JOIN profiles p ON p.id = NEW.user_id
    WHERE m.id = NEW.match_id;

    PERFORM create_notification(
            v_creator_id,
            'join_request',
            'Nueva solicitud de unión 📩',
            format('%s quiere unirse a "%s"', v_user_name, v_match_title),
            jsonb_build_object(
                    'request_id', NEW.id,
                    'match_id', NEW.match_id,
                    'user_id', NEW.user_id,
                    'user_name', v_user_name
            )
            );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_notify_creator_join_request ON join_requests;
CREATE TRIGGER trigger_notify_creator_join_request
    AFTER INSERT OR UPDATE
    ON join_requests
    FOR EACH ROW
EXECUTE FUNCTION notify_creator_on_join_request();


-- ── 7. Índice para "¿tengo una solicitud en este partido?" ─────────────────
-- Lo pregunta el detalle del partido en cada apertura, para saber si mostrar
-- "Solicitar unirme" o "Solicitud enviada".
CREATE INDEX IF NOT EXISTS idx_join_requests_match_user ON join_requests (match_id, user_id);
