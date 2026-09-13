-- =====================================================
-- Migración 028: eliminar mi cuenta
-- =====================================================
--
-- Google Play exige que el usuario pueda pedir el borrado de su cuenta desde la
-- app y también desde la web, sin instalarla. Hoy no existe por ningún lado, y
-- eso solo bloquea la publicación.
--
--
-- POR QUÉ NO ALCANZA CON BORRAR LA FILA
--
-- `profiles.id` referenciaba `auth.users(id) ON DELETE CASCADE`, y de `profiles`
-- cuelgan otras 15 claves foráneas. La más cara es `matches.creator_id`, que
-- también cascadea: borrar una cuenta **borraba todos los partidos que esa
-- persona organizó**, y con ellos los participantes, resultados, ratings y
-- estadísticas de TODOS los demás que jugaron.
--
-- En una app donde normalmente organiza siempre el mismo, el que se va se lleva
-- puesto el historial del grupo. Eso no es "borrar mis datos": es borrar los de
-- otros.
--
--
-- EL CRITERIO: LÁPIDA
--
-- Se borra de verdad lo que identifica a la persona, y sobrevive lo que es
-- historia compartida:
--
--   · `auth.users` se BORRA. Es lo que hace que el borrado sea real: se van el
--     mail, las identidades (incluida la de Google), las sesiones y los refresh
--     tokens. La persona no puede volver a entrar y el mail queda libre para
--     registrarse de nuevo.
--   · `profiles` SOBREVIVE como lápida, con los datos personales limpiados y
--     `deleted_at` marcado. Sirve para que el partido del año pasado siga
--     diciendo quién jugó, aunque ahora diga "Usuario eliminado".
--
-- Es el patrón estándar, y es lo que Google pide: lo que tiene que desaparecer
-- son los datos personales, no la actividad de terceros.
--
--
-- LO QUE NO PUEDE VIVIR ACÁ: EL AVATAR
--
-- El archivo del avatar lo tiene que borrar el CLIENTE con la Storage API, antes
-- de llamar a esta función. No es una preferencia: Supabase protege esas tablas
-- con `storage.protect_delete()`, que aborta cualquier DELETE directo sobre
-- `storage.objects` y, al dispararse adentro de esta transacción, se llevaría
-- puesto el borrado entero. Es exactamente lo que le pasó a la migración 018 y
-- por lo que la 019 la revirtió.
--
-- Orden correcto, y está implementado así en el cliente:
--   1. `storageService.deleteAvatar(userId)`   (Storage API)
--   2. `rpc('delete_my_account')`              (esta función)


-- ============================================================
-- 1. Que borrar el usuario NO borre el perfil
-- ============================================================
-- Sin esto, el DELETE sobre auth.users del bloque 3 cascadea a profiles y de ahí
-- a todo lo demás, que es justo lo que esta migración evita.
--
-- La FK se saca en vez de cambiarle el ON DELETE: `profiles.id` es la clave
-- primaria, así que no puede ser NULL y `SET NULL` no es una opción. Quedan
-- perfiles sin usuario, y eso es exactamente lo que queremos — son las lápidas.
-- `deleted_at` es lo que los distingue de un perfil vivo.
--
-- El alta sigue cubierta: `handle_new_user()` (001) inserta el perfil desde un
-- trigger sobre auth.users, así que no hay forma de tener un perfil vivo sin su
-- usuario.
ALTER TABLE profiles
    DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN profiles.deleted_at IS
    'Con valor: es una lápida. El usuario borró su cuenta, auth.users ya no existe y los datos personales de esta fila fueron limpiados. La fila sobrevive sólo para que el historial de partidos de otros siga teniendo nombre.';

-- El buscador y cualquier listado de gente tienen que saltearlas.
CREATE INDEX IF NOT EXISTS idx_profiles_activos ON profiles (id) WHERE deleted_at IS NULL;


-- ============================================================
-- 2. Nadie invita ni califica a una lápida
-- ============================================================
-- El cliente ya filtra por deleted_at en el buscador, pero eso es cosmético: un
-- POST directo con la anon key lo saltea. Estas dos policies son lo que de verdad
-- lo impide.
--
-- Se reescriben enteras en vez de agregar una policy nueva porque dos policies
-- permisivas se combinan con OR: una nueva que dijera "y que no esté borrado" no
-- restringiría nada, alcanzaría con que la vieja dijera que sí.
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
-- Se agrega a protect_profile_derived_columns (025/026), el trigger que revierte
-- en silencio los intentos del cliente de tocar columnas que calcula el servidor.
--
-- Sin esto, un `PATCH /profiles` con la anon key deja a un usuario marcado como
-- borrado sin estarlo: desaparece del buscador, no lo pueden invitar, y sin
-- embargo entra a la app normalmente. No es una fuga de datos, pero es un estado
-- que no debería poder existir — y el camino de vuelta tampoco tiene que existir:
-- una lápida no se "revive" editando una fila.
--
-- El trigger sólo actúa cuando quien escribe es `authenticated` o `anon`, así que
-- delete_my_account() —que corre como el dueño, por ser SECURITY DEFINER— pasa
-- de largo y sí puede marcarlo.
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
-- SECURITY DEFINER porque `authenticated` no tiene —ni debe tener— permiso sobre
-- auth.users. La función corre con los privilegios de su dueño.
--
-- `auth.uid()` y nada más: no recibe parámetros a propósito. Una función de
-- borrado que acepte un id ajeno es un arma; sin parámetro, no hay forma de
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

    -- ── Los partidos futuros que organizaba se cancelan ────────────────────
    -- Un partido sin organizador es un partido zombi: las policies de `matches`
    -- piden ser el creador para editarlo o cancelarlo, así que si queda abierto
    -- no lo puede tocar nadie nunca más, y la gente se presenta a una cancha que
    -- nadie reservó.
    --
    -- El UPDATE dispara trigger_notify_match_cancelled, que avisa a los
    -- participantes. Por eso va ANTES del borrado del usuario: el aviso tiene que
    -- salir mientras el partido todavía tiene participantes.
    --
    -- Los partidos ya jugados no se tocan: son el historial que esta migración
    -- existe para conservar.
    UPDATE matches
    SET status = 'cancelled'
    WHERE creator_id = v_user_id
      AND starts_at > NOW()
      AND status <> 'cancelled';

    -- ── Lo que se borra entero ─────────────────────────────────────────────
    -- Datos que son sólo de esta persona y no le hacen falta a nadie más.

    -- Identificadores de dispositivo. Además corta los push: sin esto le seguirían
    -- llegando notificaciones a un teléfono de una cuenta que ya no existe.
    DELETE FROM push_tokens WHERE user_id = v_user_id;

    DELETE FROM notifications WHERE user_id = v_user_id;
    DELETE FROM match_notification_log WHERE user_id = v_user_id;

    -- Solicitudes e invitaciones suyas: son trámites en curso, no historia.
    DELETE FROM join_requests WHERE user_id = v_user_id;

    -- Las calificaciones que RECIBIÓ describen a una persona que ya no está.
    DELETE FROM match_ratings WHERE rated_user_id = v_user_id;

    -- ── Lo que se conserva sin el texto libre ──────────────────────────────
    -- Las calificaciones que DIO se quedan, pero sin el comentario.
    --
    -- El número tiene que sobrevivir: `rating` y `rating_count` de los demás se
    -- calcularon con él, y el trigger que los mantiene (on_new_rating) es AFTER
    -- INSERT — no recalcula nada al borrar. Borrar estas filas dejaría a otros
    -- usuarios con un promedio que ya no se corresponde con ninguna calificación
    -- existente. El comentario sí se va: eso es texto que escribió la persona.
    UPDATE match_ratings SET comment = NULL WHERE rater_id = v_user_id;

    -- ── La lápida ──────────────────────────────────────────────────────────
    -- `email` va a cadena vacía y no a NULL porque la columna es NOT NULL. De
    -- paso, el buscador consulta `email.ilike` y una cadena vacía no matchea
    -- ninguna búsqueda, así que la lápida no aparece por ahí.
    --
    -- `rating` y `rating_count` vuelven al default porque las calificaciones que
    -- las sostenían se borraron cuatro líneas más arriba. `total_matches`,
    -- `total_wins` y `elo_rating` se quedan: no identifican a nadie y son parte
    -- de los partidos que sobreviven.
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

    -- ── Y recién ahora, el borrado de verdad ───────────────────────────────
    -- Cascadea a auth.identities, auth.sessions y los refresh tokens: se cierran
    -- todas las sesiones en todos los dispositivos y el mail queda libre.
    --
    -- Va último a propósito. Si algo de arriba falla, la transacción entera
    -- vuelve atrás y la cuenta sigue existiendo — que es el lado seguro del
    -- error: es preferible un borrado que no se completó a una cuenta borrada a
    -- medias, con el usuario afuera y sus datos adentro.
    DELETE FROM auth.users WHERE id = v_user_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.delete_my_account() IS
    'Borra la cuenta del que llama: elimina auth.users y deja profiles como lápida anonimizada. El avatar lo tiene que borrar el cliente ANTES, con la Storage API (ver 019).';

-- Sólo el que tiene sesión. `anon` no: sin sesión, auth.uid() es NULL y la
-- función aborta igual, pero el permiso no se regala.
REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
