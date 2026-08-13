-- =====================================================
-- Migración 027: invitar a un partido requiere que el invitado acepte
-- =====================================================
--
-- Hasta acá el creador sumaba usuarios registrados directo a match_participants
-- (Create.tsx, al publicar el partido). Dos problemas, uno de producto y uno de
-- seguridad, que resultan ser el mismo:
--
--   * De producto: te metían en un partido sin preguntarte. Aparecías como
--     "unido" sin haber dicho nada.
--   * De seguridad: es el hallazgo A4 de la auditoría. La policy de INSERT de
--     match_participants pide ser el creador del partido pero no dice nada sobre
--     QUÉ user_id se inserta. Con eso, cualquiera creaba un partido, te metía, y
--     desde ahí te calificaba con 1 estrella (match_ratings acepta la
--     calificación porque los dos son participantes del mismo partido) y te
--     cargaba derrotas que te bajan el ELO de verdad. Repetible en N partidos
--     fabricados: el rating público de cualquier usuario, destruible con una
--     cuenta gratis.
--
-- El criterio: **nadie con cuenta entra a un partido sin consentir**.
--
--   · Invitado SIN cuenta  → lo agrega el creador y listo. No hay reputación de
--     nadie en juego: un invitado no tiene perfil, ni rating, ni ELO. Sigue como
--     estaba, por match_participants.guest_name.
--   · Usuario REGISTRADO  → el creador lo invita, y entra cuando acepta.
--
-- Y la parte que es fácil equivocar: la aprobación del creador NO alcanza como
-- consentimiento. Protege el partido, no a la persona. Si el creador pudiera
-- aceptar invitaciones, el atacante crea su propio partido, se invita a la
-- víctima y aprueba su propia invitación — el agujero queda igual, con más pasos.
-- Por eso el bloque 4 de abajo es el centro de esta migración: accept_join_request
-- RECHAZA las invitaciones. Una invitación sólo la acepta el invitado.
--
--
-- POR QUÉ SE REUSA join_requests Y NO UNA TABLA NUEVA
--
-- Una invitación y una solicitud son la misma fila mirada desde los dos lados:
-- una persona y un partido que todavía no se juntaron. Reusando la tabla:
--   * el UNIQUE (match_id, user_id) hace trabajo real — no puede haber a la vez
--     una solicitud y una invitación entre las mismas dos partes, que es
--     exactamente el caso raro que habría que resolver a mano con dos tablas;
--   * la pantalla de solicitudes del creador y el estado que ya lee el detalle
--     del partido (getMine) siguen funcionando sobre una sola consulta;
--   * el realtime de join_requests ya está publicado (001).
--
-- La dirección la da `invited_by`: NULL es "la pidió el usuario", con valor es
-- "lo invitó el creador".
-- =====================================================


-- ============================================================
-- 0. El tipo de notificación
-- ============================================================
-- Se puede agregar un valor al enum Y usarlo en esta misma migración, aunque cada
-- archivo corra en una transacción y Postgres prohíba "unsafe use of new value of
-- enum type": la prohibición aplica a las sentencias DML de esta transacción, no a
-- los literales dentro del cuerpo de una función plpgsql, que se resuelven cuando la
-- función se ejecuta. La 021 ya hizo exactamente esto con 'match_result'.
--
-- Lo que NO se puede es un INSERT con el valor nuevo acá abajo. No hace falta: las
-- notificaciones las crean las funciones, que corren después.
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'match_invitation';

-- Y de paso se tapa un agujero viejo: 'player_joined' nunca se agregó al enum,
-- aunque la 013 creó el trigger notify_user_on_player_added que lo usa, la columna
-- profiles.notify_player_joined que lo configura, y la Edge Function lo mapea a esa
-- preferencia. O sea que ese trigger habría muerto con "invalid input value for enum
-- notification_type" la primera vez que corriera. No se notó porque nunca corrió:
-- vive sobre match_players, que la 026 dejó de sólo lectura por estar muerta. Se
-- agrega igual para que el día que esa feature vuelva, vuelva entera.
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'player_joined';


-- ============================================================
-- 1. La columna que da la dirección
-- ============================================================
ALTER TABLE join_requests
    ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES profiles (id) ON DELETE SET NULL;

COMMENT ON COLUMN join_requests.invited_by IS
    'NULL: la solicitud la hizo el usuario y la acepta el creador. Con valor: es una invitación del creador y la acepta el invitado. Nunca al revés — ver accept_join_request.';

-- Para la consulta "¿tengo invitaciones pendientes?" del detalle del partido.
CREATE INDEX IF NOT EXISTS idx_join_requests_invited ON join_requests (invited_by) WHERE invited_by IS NOT NULL;


-- ============================================================
-- 2. Quién puede crear qué
-- ============================================================
-- Dos formas válidas de fila, y ninguna otra:
--
--   a) Solicitud: la crea el propio usuario para sí mismo, sin invited_by.
--   b) Invitación: la crea el creador del partido para otra persona, firmada con
--      su propio uid.
--
-- El `user_id <> auth.uid()` de la rama (b) no es paranoia: sin él, el creador
-- podría crear una "invitación a sí mismo" y aceptarla con la RPC del invitado,
-- que es un camino de vuelta a meterse en su propio partido salteando el conteo
-- de cupo. Que se una como participante normal, que para eso es el creador.
DROP POLICY IF EXISTS "Authenticated users can create requests" ON join_requests;
CREATE POLICY "Users request and creators invite"
    ON join_requests FOR INSERT
    TO authenticated
    WITH CHECK (
        (invited_by IS NULL AND auth.uid() = user_id)
            OR
        (invited_by = auth.uid()
            AND user_id <> auth.uid()
            AND auth.uid() IN (SELECT creator_id FROM matches WHERE id = match_id))
        );

-- El creador puede borrar una invitación que hizo él: sirve para cancelarla
-- mientras está pendiente, y para volver a invitar a alguien que había rechazado
-- (la fila rechazada bloquea el UNIQUE, así que sin esto la invitación sería un
-- camino de una sola vez). No puede borrar SOLICITUDES: esas se rechazan con la
-- RPC, que deja registro y avisa. La condición invited_by = auth.uid() separa
-- las dos cosas sola.
DROP POLICY IF EXISTS "Users can delete their own requests" ON join_requests;
CREATE POLICY "Users can delete their own requests"
    ON join_requests FOR DELETE
    TO authenticated
    USING (
        auth.uid() = user_id
            OR (invited_by IS NOT NULL AND auth.uid() = invited_by)
        );


-- ============================================================
-- 3. Las columnas de identidad no se editan
-- ============================================================
-- La policy de UPDATE de la 026 deja al dueño de la fila volver a pedir entrar
-- (status a 'pending'), y su WITH CHECK ya impide moverla a otro user_id. Pero
-- `invited_by` no estaba contemplado: sin esto, el dueño podría ponerlo en NULL y
-- convertir su invitación en una solicitud, o al revés, y de paso cambiar cuál de
-- las dos RPC la puede aceptar.
--
-- Mismo patrón que protect_profile_derived_columns (025): SECURITY INVOKER y
-- discriminando por current_user, así las RPC —que son SECURITY DEFINER y corren
-- como owner— no se ven afectadas.
CREATE OR REPLACE FUNCTION public.protect_join_request_identity()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SET search_path = public
AS
$$
BEGIN
    IF current_user NOT IN ('authenticated', 'anon') THEN
        RETURN NEW;
    END IF;

    NEW.user_id := OLD.user_id;
    NEW.match_id := OLD.match_id;
    NEW.invited_by := OLD.invited_by;
    NEW.created_at := OLD.created_at;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_join_request_identity ON join_requests;
CREATE TRIGGER protect_join_request_identity
    BEFORE UPDATE
    ON join_requests
    FOR EACH ROW
EXECUTE FUNCTION public.protect_join_request_identity();


-- ============================================================
-- 4. El creador NO acepta invitaciones
-- ============================================================
-- Éste es el bloque que hace que todo lo demás signifique algo. Sin él, el
-- creador acepta la invitación que él mismo mandó y el consentimiento del
-- invitado es decorativo.
--
-- Se reescribe accept_join_request completa (viene de la 022) agregando un solo
-- chequeo. El resto queda igual: estado pendiente, que quien acepta sea el
-- creador, que el partido exista y no esté cancelado ni jugado, cupo, y los
-- FOR UPDATE que evitan que dos aceptaciones simultáneas metan un jugador de más.
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

    -- Nuevo en la 027. El mensaje es para el desarrollador que se confunda de RPC:
    -- el usuario nunca debería ver este error, porque la app no le ofrece el botón.
    IF v_request.invited_by IS NOT NULL THEN
        RAISE EXCEPTION 'Esto es una invitación: la acepta el invitado, no el creador';
    END IF;

    IF v_request.status <> 'pending' THEN
        RAISE EXCEPTION 'Esa solicitud ya fue respondida';
    END IF;

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

    IF NOT EXISTS (SELECT 1
                   FROM match_participants
                   WHERE match_id = v_request.match_id
                     AND user_id = v_request.user_id) THEN
        INSERT INTO match_participants (match_id, user_id, team_slot)
        VALUES (v_request.match_id, v_request.user_id, v_request.team_slot);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION accept_join_request IS 'Acepta una SOLICITUD pendiente y suma al jugador. Sólo el creador, sólo si hay lugar, y nunca una invitación (esas van por accept_match_invitation).';

-- Y el rechazo, por simetría: rechazar una invitación no es cosa del creador.
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

    IF v_request.invited_by IS NOT NULL THEN
        RAISE EXCEPTION 'Esto es una invitación: la responde el invitado. Para darla de baja, borrala';
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


-- ============================================================
-- 5. El invitado acepta
-- ============================================================
-- Espejo de accept_join_request, con los roles al revés: acá quien tiene que ser
-- auth.uid() es el invitado, no el creador. Los chequeos de partido y cupo son
-- los mismos, y por el mismo motivo: entre que la invitación se manda y se acepta
-- puede pasar cualquier cosa — que el partido se llene, se cancele o se juegue.
CREATE OR REPLACE FUNCTION accept_match_invitation(request_id UUID)
    RETURNS VOID AS
$$
DECLARE
    v_request     join_requests;
    v_match       matches;
    v_count       INTEGER;
    v_user_name   TEXT;
BEGIN
    SELECT * INTO v_request FROM join_requests WHERE id = request_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La invitación no existe';
    END IF;

    IF v_request.invited_by IS NULL THEN
        RAISE EXCEPTION 'Esto es una solicitud tuya, no una invitación';
    END IF;

    IF v_request.user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Sólo quien fue invitado puede aceptar la invitación';
    END IF;

    IF v_request.status <> 'pending' THEN
        RAISE EXCEPTION 'Esa invitación ya fue respondida';
    END IF;

    SELECT * INTO v_match FROM matches WHERE id = v_request.match_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El partido no existe';
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

    IF NOT EXISTS (SELECT 1
                   FROM match_participants
                   WHERE match_id = v_request.match_id
                     AND user_id = v_request.user_id) THEN
        INSERT INTO match_participants (match_id, user_id, team_slot)
        VALUES (v_request.match_id, v_request.user_id, v_request.team_slot);
    END IF;

    -- Al creador le interesa saberlo: invitó y le contestaron.
    SELECT full_name INTO v_user_name FROM profiles WHERE id = v_request.user_id;

    PERFORM create_notification(
            v_match.creator_id,
            'match_invitation',
            'Aceptaron tu invitación ✅',
            format('%s se suma a "%s"', COALESCE(v_user_name, 'Un jugador'), v_match.title),
            jsonb_build_object('match_id', v_request.match_id, 'user_id', v_request.user_id)
            );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION accept_match_invitation IS 'El invitado acepta y recién ahí entra al partido. Sólo auth.uid() = user_id: que el creador pudiera aceptar acá haría del consentimiento un adorno.';


-- ============================================================
-- 6. El invitado rechaza
-- ============================================================
-- Podría ser un DELETE (la policy se lo permite), pero como RPC deja la fila en
-- 'rechazada' y avisa al creador, que si no se queda esperando una respuesta que
-- no va a llegar.
CREATE OR REPLACE FUNCTION reject_match_invitation(request_id UUID)
    RETURNS VOID AS
$$
DECLARE
    v_request     join_requests;
    v_match_title TEXT;
    v_creator_id  UUID;
    v_user_name   TEXT;
BEGIN
    SELECT * INTO v_request FROM join_requests WHERE id = request_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La invitación no existe';
    END IF;

    IF v_request.invited_by IS NULL THEN
        RAISE EXCEPTION 'Esto es una solicitud tuya, no una invitación';
    END IF;

    IF v_request.user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Sólo quien fue invitado puede rechazar la invitación';
    END IF;

    IF v_request.status <> 'pending' THEN
        RAISE EXCEPTION 'Esa invitación ya fue respondida';
    END IF;

    UPDATE join_requests
    SET status     = 'rejected',
        updated_at = NOW()
    WHERE id = request_id;

    SELECT m.creator_id, m.title, p.full_name
    INTO v_creator_id, v_match_title, v_user_name
    FROM matches m
             LEFT JOIN profiles p ON p.id = v_request.user_id
    WHERE m.id = v_request.match_id;

    PERFORM create_notification(
            v_creator_id,
            'match_invitation',
            'Rechazaron tu invitación',
            format('%s no se suma a "%s"', COALESCE(v_user_name, 'Un jugador'), v_match_title),
            jsonb_build_object('match_id', v_request.match_id, 'user_id', v_request.user_id)
            );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ============================================================
-- 7. Los avisos, sin cruzarse
-- ============================================================
-- Los dos triggers de la 013/022 sobre join_requests hablan del flujo de
-- solicitud y hay que sacarlos del camino de las invitaciones, o cada invitación
-- genera avisos al revés:
--
--   * notify_creator_on_join_request le avisaría al creador de su propia
--     invitación ("Fulano quiere unirse"), cuando fue él el que invitó.
--   * notify_user_on_request_response le avisaría al invitado de su propia
--     respuesta. Al creador ya le avisan las RPC de los bloques 5 y 6, que saben
--     de qué lado está cada uno.
--
-- Se les agrega la misma condición y nada más.
CREATE OR REPLACE FUNCTION notify_creator_on_join_request()
    RETURNS TRIGGER AS
$$
DECLARE
    v_creator_id  UUID;
    v_user_name   TEXT;
    v_match_title TEXT;
BEGIN
    -- Nuevo en la 027: las invitaciones no pasan por acá.
    IF NEW.invited_by IS NOT NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.status <> 'pending' THEN
        RETURN NEW;
    END IF;

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

CREATE OR REPLACE FUNCTION notify_user_on_request_response()
    RETURNS TRIGGER AS
$$
DECLARE
    v_match_title TEXT;
    v_venue_name  TEXT;
    v_starts_at   TIMESTAMPTZ;
BEGIN
    -- Nuevo en la 027: en una invitación, el que cambia el estado es el propio
    -- usuario. Avisarle de lo que acaba de hacer no tiene sentido.
    IF NEW.invited_by IS NOT NULL THEN
        RETURN NEW;
    END IF;

    IF OLD.status = 'pending' AND NEW.status IN ('accepted', 'rejected') THEN
        SELECT title, venue_name, starts_at
        INTO v_match_title, v_venue_name, v_starts_at
        FROM matches
        WHERE id = NEW.match_id;

        PERFORM create_notification(
                NEW.user_id,
                CASE WHEN NEW.status = 'accepted' THEN 'request_accepted' ELSE 'request_rejected' END,
                CASE WHEN NEW.status = 'accepted' THEN '¡Solicitud aceptada! ✅' ELSE 'Solicitud rechazada ❌' END,
                CASE
                    WHEN NEW.status = 'accepted' THEN format('Te uniste a "%s"', v_match_title)
                    ELSE format('Tu solicitud para "%s" fue rechazada', v_match_title)
                    END,
                jsonb_build_object(
                        'match_id', NEW.match_id,
                        'request_id', NEW.id,
                        'status', NEW.status,
                        'match_title', v_match_title,
                        'venue_name', v_venue_name,
                        'starts_at', v_starts_at
                )
                );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ── Y el aviso que faltaba: al invitado ────────────────────────────────────
-- Los tres avisos del flujo de invitación —te invitaron, aceptaron, rechazaron—
-- comparten el tipo 'match_invitation'. Un solo tipo, un solo significado ("algo
-- pasó con una invitación"), una sola preferencia y un solo caso en el ruteo del
-- cliente, que lleva al detalle del partido: justo donde están los botones.
CREATE OR REPLACE FUNCTION notify_user_on_match_invitation()
    RETURNS TRIGGER AS
$$
DECLARE
    v_match_title  TEXT;
    v_inviter_name TEXT;
BEGIN
    IF NEW.invited_by IS NULL OR NEW.status <> 'pending' THEN
        RETURN NEW;
    END IF;

    SELECT m.title, p.full_name
    INTO v_match_title, v_inviter_name
    FROM matches m
             LEFT JOIN profiles p ON p.id = NEW.invited_by
    WHERE m.id = NEW.match_id;

    PERFORM create_notification(
            NEW.user_id,
            'match_invitation',
            'Te invitaron a un partido 🎾',
            format('%s te invitó a "%s". Entrá para aceptar o rechazar.',
                   COALESCE(v_inviter_name, 'Alguien'), v_match_title),
            jsonb_build_object(
                    'request_id', NEW.id,
                    'match_id', NEW.match_id,
                    'invited_by', NEW.invited_by,
                    'inviter_name', v_inviter_name
            )
            );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Sólo en INSERT: una invitación no se "reactiva" por UPDATE, porque el creador no
-- puede editar la fila (bloque 3) y el dueño sólo puede volverla a 'pending', que
-- es su propia decisión y no necesita aviso.
DROP TRIGGER IF EXISTS trigger_notify_match_invitation ON join_requests;
CREATE TRIGGER trigger_notify_match_invitation
    AFTER INSERT
    ON join_requests
    FOR EACH ROW
EXECUTE FUNCTION notify_user_on_match_invitation();


-- ============================================================
-- 7b. Y la cerradura de verdad: match_participants
-- ============================================================
-- Todo lo de arriba cambia el CAMINO de la app. Esto cambia lo que la base permite,
-- que es lo único que cuenta: la anon key viaja en el APK, así que sin este bloque
-- alcanzaría un POST a /rest/v1/match_participants para saltear el flujo de
-- invitación completo y seguir metiendo a cualquiera en un partido propio.
--
-- La policy de la 022 pedía ser el creador del partido pero no decía nada sobre QUÉ
-- user_id se inserta. Ahora el creador sólo puede insertar:
--
--   · invitados sin cuenta (user_id NULL), que es para lo que existe la excepción;
--   · a sí mismo, que es cómo se suma al crear el partido (Create.tsx lo hace
--     inmediatamente después del INSERT en matches).
--
-- Cualquier otro usuario registrado entra únicamente por accept_join_request o
-- accept_match_invitation, que son SECURITY DEFINER, no pasan por RLS, y cada una
-- exige el consentimiento de quien corresponde.
DROP POLICY IF EXISTS "Only match creators can add participants" ON match_participants;
DROP POLICY IF EXISTS "Creators add guests and themselves" ON match_participants;
CREATE POLICY "Creators add guests and themselves"
    ON match_participants FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() IN (SELECT creator_id FROM matches WHERE id = match_id)
            AND (user_id IS NULL OR user_id = auth.uid())
        );

-- Salir del partido no cambia, y el creador sigue pudiendo sacar a cualquiera. Se
-- recrea igual, acotada al rol, para que aplicar este archivo sobre una base que la
-- haya perdido también la deje andando.
DROP POLICY IF EXISTS "Match creators can remove participants" ON match_participants;
CREATE POLICY "Match creators can remove participants"
    ON match_participants FOR DELETE
    TO authenticated
    USING (
        auth.uid() IN (SELECT creator_id FROM matches WHERE id = match_id)
            OR auth.uid() = user_id
        );


-- ============================================================
-- 8. Permisos: volver a fijar la línea de base, no confiar en el default
-- ============================================================
-- La 025 dejó el esquema con EXECUTE revocado de PUBLIC/anon/authenticated y sólo
-- las RPC del cliente abiertas, y cerró con ALTER DEFAULT PRIVILEGES para que lo
-- que se creara después naciera igual de cerrado.
--
-- Ese default NO alcanzó. Comprobado sobre esta misma base después de aplicar esta
-- migración: las funciones nuevas quedaron con
--
--   protect_join_request_identity     proacl = NULL      → anon puede ejecutarla
--   accept_match_invitation           proacl = {=X/postgres, ...}
--                                              ↑ "=X" es PUBLIC con EXECUTE
--
-- O sea que el default de Postgres —EXECUTE a PUBLIC en toda función nueva— se
-- aplicó igual, y un GRANT posterior materializa el ACL con PUBLIC ya adentro. Lo
-- detectó el bloque 6e del smoke test, que es exactamente para lo que está.
--
-- Así que en vez de agregar dos GRANT y confiar, se rehace la línea de base
-- completa: revocar todo y volver a abrir sólo lo que la app usa. Es idempotente y
-- se autocorrige — cualquier función que una migración futura agregue queda cerrada
-- al volver a correr este bloque.
REVOKE EXECUTE ON ALL ROUTINES IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL ROUTINES IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL ROUTINES IN SCHEMA public FROM authenticated;

-- Las nueve que llama el cliente: las siete que quedaron después de la 026 más las
-- dos de invitaciones.
GRANT EXECUTE ON FUNCTION public.accept_join_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_join_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_match_invitation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_match_invitation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_match_result(UUID, INTEGER, INTEGER, JSONB, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_match_result(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vote_match_result(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_match_result_vote(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.matches_near_location(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

-- Y la que no es una RPC pero muere sin GRANT: sport_levels_are_valid() es el CHECK
-- de profiles.sport_levels, y un CHECK se evalúa con los privilegios de quien
-- escribe. Sin esta línea, el REVOKE de arriba deja a todos los usuarios sin poder
-- guardar el perfil, con un "permission denied for function" que no menciona el
-- CHECK por ningún lado. Ya estaba documentado en la 025; se repite porque el
-- REVOKE de arriba también se la lleva.
GRANT EXECUTE ON FUNCTION public.sport_levels_are_valid(JSONB) TO authenticated;
