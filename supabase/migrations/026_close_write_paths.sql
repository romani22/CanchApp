-- =====================================================
-- Migración 026: cerrar los caminos de escritura que quedaron abiertos
-- =====================================================
--
-- Continuación de la 025, con el mismo modelo de amenaza: la anon key viaja
-- adentro del APK, así que el atacante le habla directo a PostgREST y las policies
-- y los GRANT son la única defensa. Lo que agrega este archivo son cuatro cosas que
-- la 025 no cubrió:
--
--   1. profiles.elo_rating quedó fuera del trigger de columnas derivadas: hoy uno se
--      lo puede poner en 99999 con un PATCH y encabezar el ranking sin jugar.
--   2. match_players es una feature muerta con la puerta abierta: dos funciones
--      SECURITY DEFINER sin ningún chequeo de autorización, y una policy de INSERT
--      que no pide ser el creador del partido.
--   3. match_results y match_player_stats se pueden escribir directo, salteando
--      todas las validaciones de save_match_result.
--   4. join_requests: la policy de UPDATE es del creador, que no la necesita porque
--      usa las RPC — y le falta al usuario, que sí la necesita para volver a pedir
--      entrar. O sea que está exactamente al revés.
--
-- Criterio general, heredado de la 025: donde el cliente sólo usa una RPC, la tabla
-- se deja sin DML directo. Dos cerraduras — sin GRANT y sin policy — para que
-- reponer una por error no alcance para abrir.
--
-- Nada de acá rompe la app. Cada REVOKE de abajo se verificó contra el cliente antes
-- de escribirlo, y los caminos que se cierran o no se usan o están roto ya.
-- =====================================================


-- ============================================================
-- 1. profiles.elo_rating: derivada, no editable
-- ============================================================
--
-- El trigger de la 025 congela rating, rating_count, total_matches y total_wins,
-- pero se olvidó elo_rating, que llegó en la 003 y es igual de derivada: la calcula
-- apply_match_elo (021) a partir de los resultados. Con GRANT de UPDATE sobre
-- profiles y la policy de fila propia, alcanzaba un
-- PATCH /rest/v1/profiles?id=eq.<uno mismo> con {"elo_rating": 99999}.
--
-- Se repite la función completa en vez de parchear: es CREATE OR REPLACE y así el
-- archivo se puede leer solo, sin tener que cruzarlo con la 025 para saber qué
-- columnas quedan protegidas.
--
-- Sobre el discriminador current_user: va SECURITY INVOKER a propósito. Adentro de
-- una SECURITY DEFINER nuestra current_user es el owner (postgres), mientras que un
-- UPDATE que entra derecho por PostgREST es 'authenticated' o 'anon'. Sólo a esos
-- dos se les recortan las columnas, así que el recálculo interno del rating y del
-- elo sigue funcionando. La explicación larga está en la 025.
CREATE OR REPLACE FUNCTION public.protect_profile_derived_columns()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SET search_path = public
AS
$$
BEGIN
    IF current_user NOT IN ('authenticated', 'anon') THEN
        RETURN NEW;
    END IF;

    NEW.id := OLD.id;
    NEW.email := OLD.email;
    NEW.created_at := OLD.created_at;
    NEW.rating := OLD.rating;
    NEW.rating_count := OLD.rating_count;
    NEW.total_matches := OLD.total_matches;
    NEW.total_wins := OLD.total_wins;
    -- Nuevo en la 026. Si mañana aparece otra columna calculada por el servidor,
    -- va acá: el bloque 8 del smoke test es el que avisa si se olvida.
    NEW.elo_rating := OLD.elo_rating;

    RETURN NEW;
END;
$$;

-- El trigger de la 025 ya apunta a esta función; se recrea igual para que aplicar
-- este archivo sobre una base a la que le falte también lo deje andando.
DROP TRIGGER IF EXISTS protect_profile_derived_columns ON profiles;
CREATE TRIGGER protect_profile_derived_columns
    BEFORE UPDATE
    ON profiles
    FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_derived_columns();


-- ============================================================
-- 2. match_players: cerrar hasta que la feature exista de verdad
-- ============================================================
--
-- Estado real de esta feature, que es lo que justifica cerrarla en vez de
-- arreglarla acá:
--
--   * No se puede llegar desde la app. AddPlayersForm sólo se renderiza en la ruta
--     match/add-payers, y ninguna pantalla navega ahí. useMatchPlayers y PlayersList
--     no se usan en ningún lado.
--   * add_multiple_players no puede ejecutarse ni siquiera con permisos: declara una
--     variable total_players que también es columna de matches y la referencia sin
--     calificar, así que Postgres corta con "column reference total_players is
--     ambiguous".
--   * Su contabilidad contradice a la 020, donde matches.current_players es el
--     COUNT(*) de match_participants y se RECALCULA en cada cambio. El trigger de
--     013 sobre match_players hace current_players + 1 y la RPC además lo escribe a
--     mano: tres modelos peleando por la misma columna.
--   * Y los invitados sin cuenta ya se resuelven en otra tabla:
--     match_participants.guest_name, que agregó la 004 y usa Edit_match.tsx.
--
-- Mientras tanto, con la anon key era explotable así:
--   * add_multiple_players(p_match_id, p_added_by_user_id, p_players) no mira
--     auth.uid() por ningún lado. Cualquier usuario podía llenar el partido de otro
--     hasta total_players (nadie más entra), falsificar added_by_user_id, y disparar
--     el trigger notify_user_on_player_added contra la víctima que quisiera: le
--     llega "«NOMBRE» te agregó a «TÍTULO»", con NOMBRE su propio full_name
--     (editable) y TÍTULO el de un partido suyo. Texto de push a gusto.
--   * remove_match_player(p_player_id) borraba cualquier fila de cualquier partido.
--   * Y la policy de INSERT sólo pedía auth.uid() = added_by_user_id, sin decir nada
--     del match_id: el mismo abuso por PostgREST, sin pasar por la RPC.
--
-- Se DROPean las dos funciones en vez de repararlas. Una función que no existe no
-- necesita que nadie acierte su GRANT, y la 027 va a escribir las nuevas para el
-- flujo que sí queremos: que un tercero pueda proponer jugadores (registrados o
-- invitados) y que el creador los tenga que aprobar. La tabla y sus filas no se
-- tocan.
DROP FUNCTION IF EXISTS public.add_multiple_players(UUID, UUID, JSONB);
DROP FUNCTION IF EXISTS public.remove_match_player(UUID);

-- Sin DML: la tabla queda de sólo lectura hasta que la 027 la abra a propósito con
-- las reglas del flujo de aprobación.
REVOKE INSERT, UPDATE, DELETE ON public.match_players FROM authenticated;

-- Segunda cerradura: aunque alguien reponga el GRANT sin pensarlo, la policy ya no
-- deja escribir en un partido ajeno. Es el criterio de la 025 — que el GRANT y la
-- policy digan lo mismo, para que ninguna de las dos sea la única defensa.
DROP POLICY IF EXISTS "Authenticated users can add players" ON match_players;
DROP POLICY IF EXISTS "Match creators can add players" ON match_players;
CREATE POLICY "Match creators can add players"
    ON match_players FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = added_by_user_id
            AND auth.uid() IN (SELECT creator_id FROM matches WHERE id = match_id)
        );

-- Las otras dos venían sin cláusula TO, o sea evaluándose también para anon. Hoy no
-- es explotable porque la 025 le revocó todo a anon, pero el permiso tiene que ser
-- explícito y no depender de un GRANT que está en otro archivo.
DROP POLICY IF EXISTS "Anyone can view match players" ON match_players;
CREATE POLICY "Match players are viewable by authenticated users"
    ON match_players FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Can delete own added players or creator can delete" ON match_players;
CREATE POLICY "Can delete own added players or creator can delete"
    ON match_players FOR DELETE
    TO authenticated
    USING (
        auth.uid() = added_by_user_id
            OR auth.uid() IN (SELECT creator_id FROM matches WHERE id = match_id)
        );

-- Nota para la 027: SupabaseMatchPlayerRepository.updateTeam() hace un UPDATE
-- directo sobre match_players, y esta tabla nunca tuvo policy de UPDATE ni GRANT.
-- O sea que esa función ya fallaba en silencio (0 filas, sin error) desde siempre.


-- ============================================================
-- 3. match_results y match_player_stats: sólo por la RPC
-- ============================================================
--
-- save_match_result valida un montón: que el partido no esté cancelado, que ya haya
-- empezado, que haya un solo autor por resultado, que cada jugador de las stats haya
-- jugado el partido, borra los votos al corregir (confirmar "3-2" no es confirmar
-- "2-2") y aplica el ELO una sola vez.
--
-- Un INSERT o UPDATE directo por PostgREST no valida NADA de eso, y la policy de la
-- 021 lo permitía: era FOR ALL con USING/WITH CHECK de "sos el creador del partido".
-- Con eso, el creador podía escribir stats de usuarios que no jugaron, cambiar el
-- marcador sin borrar las confirmaciones (dejando votos que confirman un resultado
-- que ya no existe) y esquivar has_dispute.
--
-- El cliente sólo lee estas dos tablas: SupabaseMatchResultRepository hace SELECT en
-- match_results y match_player_stats, y todo lo que escribe va por save_match_result
-- / delete_match_result / vote_match_result / clear_match_result_vote. Así que
-- quitarles el DML no le cambia nada a la app.
--
-- Las RPC no se ven afectadas: son SECURITY DEFINER, corren como owner y por lo
-- tanto no pasan por RLS ni necesitan el GRANT de authenticated.
REVOKE INSERT, UPDATE, DELETE ON public.match_results FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.match_player_stats FROM authenticated;

-- Y las policies se reducen a lectura, para que la próxima auditoría no tenga que
-- cruzar dos archivos para darse cuenta de que el FOR ALL era letra muerta.
DROP POLICY IF EXISTS "Match creators can write results" ON match_results;
DROP POLICY IF EXISTS "Results are viewable by everyone" ON match_results;
DROP POLICY IF EXISTS "Results are viewable by authenticated users" ON match_results;
CREATE POLICY "Results are viewable by authenticated users"
    ON match_results FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Match creators can write player stats" ON match_player_stats;
DROP POLICY IF EXISTS "Player stats are viewable by everyone" ON match_player_stats;
DROP POLICY IF EXISTS "Player stats are viewable by authenticated users" ON match_player_stats;
CREATE POLICY "Player stats are viewable by authenticated users"
    ON match_player_stats FOR SELECT
    TO authenticated
    USING (true);


-- ============================================================
-- 4. join_requests: la policy de UPDATE estaba al revés
-- ============================================================
--
-- La única policy de UPDATE, desde la 001, era "el creador puede cambiar el estado".
-- Las dos mitades están mal:
--
-- Le sobra al creador. Acepta y rechaza por accept_join_request /
-- reject_join_request (022), que son SECURITY DEFINER y no pasan por RLS. El UPDATE
-- directo no lo usa nadie — y sin WITH CHECK propio se hereda el USING, que sólo
-- pide seguir siendo el creador del partido: nada fija user_id. Con eso, el creador
-- podía reapuntar una solicitud suya al user_id de un tercero y ponerla en
-- 'accepted', lo que dispara notify_user_on_request_response y le manda a la víctima
-- "Te uniste a «TÍTULO»" con título elegido por él. Y después llamar
-- accept_join_request para meterla de verdad en el partido, que es la entrada al
-- problema de las calificaciones falsas.
--
-- Y le falta al usuario. join_requests tiene UNIQUE(match_id, user_id), así que
-- volver a pedir entrar después de un rechazo no es una fila nueva: es la misma
-- volviendo a 'pending', y eso es un UPDATE. SupabaseJoinRequestRepository.create()
-- lo hace exactamente así, pero ninguna policy lo permitía: el UPDATE afectaba 0
-- filas, .maybeSingle() devolvía null y no había error. O sea que re-solicitar está
-- roto EN SILENCIO desde siempre, aunque la 022 le haya agregado un trigger para
-- notificarle al creador ese segundo pedido.
--
-- Así que se invierte: se va la del creador, entra la del dueño de la solicitud.
DROP POLICY IF EXISTS "Match creators can update request status" ON join_requests;

DROP POLICY IF EXISTS "Users can re-request their own join request" ON join_requests;
CREATE POLICY "Users can re-request their own join request"
    ON join_requests FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (
        auth.uid() = user_id
            -- El WITH CHECK mira la fila NUEVA, así que estas dos condiciones son las
            -- que importan: la de arriba impide mover la solicitud al user_id de otro,
            -- y la de abajo impide auto-aceptarse. Sin la segunda, un usuario se
            -- pondría 'accepted' solo; no lo mete en el partido (eso lo hace la RPC),
            -- pero deja la solicitud fuera de 'pending' y accept_join_request la
            -- rechaza después con "esa solicitud ya fue respondida".
            AND status = 'pending'
        );

-- Las otras tres venían sin cláusula TO. Se recrean idénticas en semántica, acotadas
-- al rol autenticado.
DROP POLICY IF EXISTS "Users can view their own requests" ON join_requests;
CREATE POLICY "Users can view their own requests"
    ON join_requests FOR SELECT
    TO authenticated
    USING (
        auth.uid() = user_id
            OR auth.uid() IN (SELECT creator_id FROM matches WHERE id = match_id)
        );

DROP POLICY IF EXISTS "Authenticated users can create requests" ON join_requests;
CREATE POLICY "Authenticated users can create requests"
    ON join_requests FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own requests" ON join_requests;
CREATE POLICY "Users can delete their own requests"
    ON join_requests FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
