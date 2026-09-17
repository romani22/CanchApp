-- =====================================================
-- Migración 028: eliminar mi cuenta
-- =====================================================
--
-- Google Play exige poder pedir el borrado de la cuenta desde la app, y no existe.
--
-- No alcanza con borrar la fila. `profiles.id` referenciaba `auth.users(id) ON
-- DELETE CASCADE`, y de `profiles` cuelgan 18 claves foráneas más. La cara es
-- `matches.creator_id`, que también cascadea: borrar una cuenta borraba todos los
-- partidos que esa persona organizó, y con ellos los participantes, resultados y
-- calificaciones de todos los demás. Eso no es borrar mis datos, es borrar los de
-- otros.
--
-- El criterio es la lápida: `auth.users` se borra de verdad —se van el mail, las
-- identidades, las sesiones y los refresh tokens— y `profiles` sobrevive con los
-- datos personales limpiados y `deleted_at` marcado, para que el partido del año
-- pasado siga diciendo quién jugó.
--
-- El avatar lo borra el CLIENTE con la Storage API antes de llamar a esta función:
-- Supabase aborta cualquier DELETE directo sobre `storage.objects` y acá adentro
-- voltearía la transacción entera. Es lo que revirtió la 019.


-- ============================================================
-- 1. Que borrar el usuario NO borre el perfil
-- ============================================================
-- Sin esto, el DELETE sobre auth.users del bloque 4 cascadea a profiles.
--
-- La FK se saca en vez de cambiarle el ON DELETE porque `profiles.id` es la clave
-- primaria y `SET NULL` no es una opción. Quedan perfiles sin usuario, que es
-- justamente lo que son las lápidas; `deleted_at` las distingue de un perfil vivo.
--
-- El alta sigue cubierta por el trigger handle_new_user() de la 001.
ALTER TABLE profiles
    DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN profiles.deleted_at IS
    'Con valor: es una lápida. El usuario borró su cuenta, auth.users ya no existe y los datos personales de esta fila fueron limpiados. La fila sobrevive sólo para que el historial de partidos de otros siga teniendo nombre.';

-- El buscador y cualquier listado de gente tienen que saltearlas.
CREATE INDEX IF NOT EXISTS idx_profiles_activos ON profiles (id) WHERE deleted_at IS NULL;


-- ============================================================
-- 2. No se invita a una lápida
-- ============================================================
-- El filtro del cliente es cosmético: un POST directo con la anon key lo saltea.
-- Esta policy es lo que de verdad lo impide.
--
-- Se reescribe entera en vez de agregar una nueva porque dos policies permisivas
-- se combinan con OR, así que una que agregara la condición no restringiría nada.
--
-- Calificar a una lápida quedó abierto acá y lo cierra la 029.
DROP POLICY IF EXISTS "Users request and creators invite" ON join_requests;
CREATE POLICY "Users request and creators invite"
    ON join_requests FOR INSERT
    TO authenticated
    WITH CHECK (
        (invited_by IS NULL AND auth.uid() = user_id)
            OR
        (invited_by = auth.uid()
            AND user_id <> auth.uid()
            AND auth.uid() IN (SELECT creator_id FROM matches WHERE id = match_id)
            -- Lo nuevo de la 028: no se invita a una cuenta borrada.
            AND user_id IN (SELECT id FROM profiles WHERE deleted_at IS NULL))
        );


-- ============================================================
-- 3. `deleted_at` no lo escribe el cliente
-- ============================================================
-- Sin esto, un PATCH deja a alguien marcado como borrado sin estarlo: invisible en
-- el buscador, no invitable, y entrando a la app normalmente.
--
-- El trigger sólo actúa sobre `authenticated` y `anon`, así que delete_my_account()
-- —SECURITY DEFINER, corre como el dueño— pasa de largo y sí puede marcarlo.
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
    -- Nuevo en la 028.
    NEW.deleted_at := OLD.deleted_at;

    RETURN NEW;
END;
$$;


-- ============================================================
-- 4. La función
-- ============================================================
-- SECURITY DEFINER porque `authenticated` no tiene permiso sobre auth.users.
-- Sin parámetros a propósito: resuelve con auth.uid(), así que no hay forma de
-- pedirle que borre a otro.
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
    -- de `matches` piden ser el creador. El UPDATE avisa a los participantes, así
    -- que va antes del borrado. Los ya jugados no se tocan.
    UPDATE matches
    SET status = 'cancelled'
    WHERE creator_id = v_user_id
      AND starts_at > NOW()
      AND status <> 'cancelled';

    -- Identificadores de dispositivo. Además corta los push.
    DELETE FROM push_tokens WHERE user_id = v_user_id;

    DELETE FROM notifications WHERE user_id = v_user_id;
    DELETE FROM match_notification_log WHERE user_id = v_user_id;

    -- Trámites en curso, no historia.
    DELETE FROM join_requests WHERE user_id = v_user_id;

    -- Las que RECIBIÓ describen a una persona que ya no está.
    DELETE FROM match_ratings WHERE rated_user_id = v_user_id;

    -- Las que DIO conservan el puntaje: el rating de los demás se calculó con él y
    -- on_new_rating es AFTER INSERT, no recalcula al borrar. Se va el comentario.
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
    -- cuenta sigue existiendo. Cascadea a identities, sessions y refresh tokens.
    DELETE FROM auth.users WHERE id = v_user_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.delete_my_account() IS
    'Borra la cuenta del que llama: elimina auth.users y deja profiles como lápida anonimizada. El avatar lo tiene que borrar el cliente ANTES, con la Storage API (ver 019).';

-- Sólo el que tiene sesión. `anon` no: sin sesión, auth.uid() es NULL y la
-- función aborta igual, pero el permiso no se regala.
REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
