-- Migración 025: cierre de agujeros de seguridad en RLS.
--
-- Contexto general: la anon key viaja adentro del APK. Es pública por diseño y no
-- hay forma de esconderla — cualquiera puede extraerla y hablarle directo a la API
-- REST de Supabase con curl, sin pasar por la app. O sea: TODA validación que sólo
-- viva en el cliente es decorativa. Lo único que separa la base de un atacante son
-- las policies de RLS de este archivo.
--
-- Cada bloque de abajo tapa un caso que hoy es explotable con la anon key y un
-- curl.


-- ============================================================
-- 1. notifications: cualquiera podía escribirle a cualquiera
-- ============================================================
--
-- La policy vieja era WITH CHECK (true) sin cláusula TO, o sea válida hasta para el
-- rol anon. Con la anon key alcanzaba un POST a /rest/v1/notifications con el
-- user_id de la víctima y title/body a gusto: el webhook de la base dispara la Edge
-- Function y eso llega como push real al teléfono. Phishing con el nombre de la app
-- ("Tu cuenta fue suspendida, entrá acá"), y los user_id se conseguían listando
-- profiles, que hasta el bloque 3 también era público.
--
-- Ningún cliente inserta notificaciones: todas nacen de triggers y funciones
-- SECURITY DEFINER (013, 014, 015, 021, 022, 023, 024), que corren como owner de la
-- tabla y por lo tanto no pasan por RLS. Borrar la policy no les cambia nada.
DROP POLICY IF EXISTS "System can create notifications" ON notifications;

-- Faltaba la policy de DELETE. No era un agujero sino lo contrario: sin policy, RLS
-- niega, y deleteNotification()/deleteAllNotifications() del repositorio fallaban en
-- silencio (PostgREST devuelve 0 filas afectadas, no error).
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
CREATE POLICY "Users can delete their own notifications"
    ON notifications FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- La de UPDATE necesita WITH CHECK explícito: sin él se hereda el USING, que mira la
-- fila vieja. Alcanzaba para mover una notificación propia al user_id de otro.
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications"
    ON notifications FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications"
    ON notifications FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);


-- ============================================================
-- 2. push_tokens: acotar al rol autenticado
-- ============================================================
--
-- La policy ya filtraba por auth.uid(), pero sin TO también evaluaba para anon,
-- donde auth.uid() es NULL. Hoy eso no matchea ninguna fila, así que no era
-- explotable; se cierra igual para que el permiso sea explícito y no dependa de una
-- propiedad de auth.uid() que podría cambiar.
DROP POLICY IF EXISTS "Users can manage own push tokens" ON push_tokens;
CREATE POLICY "Users can manage own push tokens"
    ON push_tokens FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- 3. profiles: la tabla de usuarios era legible sin login
-- ============================================================
--
-- "Profiles are viewable by everyone" USING (true) sin TO incluía a anon. Con la
-- anon key del APK, un GET a /rest/v1/profiles?select=* devolvía la base entera de
-- usuarios: mail, teléfono, zona y coordenadas de cada persona. Es la filtración más
-- grave del proyecto y no requería ni tener cuenta.
--
-- Acá se cierra el acceso sin login. Que un usuario logueado siga viendo el mail y
-- el teléfono de los demás es un problema aparte, más chico pero real, y se arregla
-- en otra migración porque requiere tocar el cliente: hoy SupabaseProfileRepository
-- hace select('*'), así que restringir columnas ahora rompería la app.
-- Se borran los dos nombres: el viejo porque es el que hay que sacar, y el nuevo
-- para que la migración se pueda volver a correr. Sin la segunda línea, un segundo
-- intento muere con "policy already exists" — justo en el escenario donde más
-- falta hace, que es reintentar después de un fallo a mitad de camino.
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON profiles;
CREATE POLICY "Profiles are viewable by authenticated users"
    ON profiles FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Nadie puede insertar ni borrar perfiles a mano: los crea handle_new_user() y los
-- borra el ON DELETE CASCADE de auth.users. Se deja constancia de que la ausencia de
-- policies de INSERT/DELETE es deliberada y no un olvido.


-- ============================================================
-- 4. profiles: columnas derivadas de sólo lectura
-- ============================================================
--
-- La policy de UPDATE es por fila, no por columna: RLS no sabe distinguir "cambiá tu
-- nombre" de "poné tu rating en 5.00 y tus victorias en 999". Un UPDATE directo a
-- /rest/v1/profiles?id=eq.<uno mismo> con {"rating": 5, "total_wins": 999} pasaba sin
-- problema, y esas columnas alimentan el ranking y las estadísticas que ve el resto.
--
-- Se resuelve con un trigger en vez de GRANTs por columna: los GRANT hay que
-- enumerarlos, y toda columna nueva que agregue una migración futura quedaría fuera
-- de la lista y sin poder escribirse, rompiendo una feature sin ruido. El trigger va
-- al revés — enumera lo prohibido y deja pasar lo demás — así que un campo nuevo es
-- editable por defecto, que es lo que uno espera.
-- OJO con cómo se distingue "lo pidió el usuario" de "lo recalculó el sistema".
--
-- No sirve auth.uid() IS NULL: el JWT se setea por transacción, así que una función
-- interna disparada por un request del usuario lo sigue viendo. update_user_rating()
-- (trigger de match_ratings, migración 001) corre exactamente así, y con ese guard
-- el recálculo del rating quedaría revertido por este mismo trigger.
--
-- El discriminador correcto es current_user. La función va SECURITY INVOKER a
-- propósito: adentro de una SECURITY DEFINER de las nuestras current_user es el
-- owner (postgres), mientras que un UPDATE que entra derecho por PostgREST es
-- 'authenticated' o 'anon'. Sólo a esos dos se les recortan las columnas.
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

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_derived_columns ON profiles;
CREATE TRIGGER protect_profile_derived_columns
    BEFORE UPDATE
    ON profiles
    FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_derived_columns();


-- ============================================================
-- 5. match_ratings: autocalificarse
-- ============================================================
--
-- La policy pedía ser el rater y estar en el partido, pero no que el calificado
-- fuera otra persona. Insertando con rated_user_id = rater_id, el trigger
-- update_user_rating recalculaba el promedio propio: rating 5.00 en un partido, y
-- repetible en cada partido jugado. El UNIQUE (match_id, rater_id, rated_user_id) de
-- 001 sólo evitaba repetir dentro del mismo partido.
--
-- Se limpian primero las filas que violarían el CHECK, si las hubiera.
DELETE FROM match_ratings WHERE rater_id = rated_user_id;

ALTER TABLE match_ratings
    DROP CONSTRAINT IF EXISTS match_ratings_no_self_rating;
ALTER TABLE match_ratings
    ADD CONSTRAINT match_ratings_no_self_rating CHECK (rater_id <> rated_user_id);

-- Y que el calificado también haya jugado: sin esto se podía calificar a cualquier
-- usuario de la base usando un partido propio como excusa.
DROP POLICY IF EXISTS "Participants can rate each other" ON match_ratings;
CREATE POLICY "Participants can rate each other"
    ON match_ratings FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = rater_id
            AND rater_id <> rated_user_id
            AND EXISTS (SELECT 1
                        FROM match_participants
                        WHERE match_id = match_ratings.match_id
                          AND user_id = auth.uid())
            AND EXISTS (SELECT 1
                        FROM match_participants
                        WHERE match_id = match_ratings.match_id
                          AND user_id = match_ratings.rated_user_id)
        );

-- Igual que con profiles: el nombre viejo y el nuevo, para poder reintentar.
DROP POLICY IF EXISTS "Ratings are viewable by everyone" ON match_ratings;
DROP POLICY IF EXISTS "Ratings are viewable by authenticated users" ON match_ratings;
CREATE POLICY "Ratings are viewable by authenticated users"
    ON match_ratings FOR SELECT
    TO authenticated
    USING (true);


-- ============================================================
-- 6. search_path en las funciones SECURITY DEFINER viejas
-- ============================================================
--
-- Una función SECURITY DEFINER corre con los privilegios de su owner (postgres). Si
-- no fija su search_path, resuelve los nombres sin calificar usando el del que la
-- llama; quien pueda crear un objeto en un esquema que quede antes en esa lista hace
-- que la función ejecute código suyo como superusuario.
--
-- Las migraciones de la 021 en adelante ya traen SET search_path. Las de la 001 a la
-- 020 no. En vez de enumerarlas una por una (son ~15 y hay que acertarles la firma),
-- se recorre el catálogo: agarra las que faltan hoy y las que se agreguen mal
-- mañana, porque esta migración es re-ejecutable.
DO
$$
    DECLARE
        fn RECORD;
    BEGIN
        FOR fn IN
            SELECT p.oid::regprocedure AS signature
            FROM pg_proc p
                     JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.prosecdef                       -- SECURITY DEFINER
              AND NOT EXISTS (SELECT 1
                              FROM unnest(COALESCE(p.proconfig, '{}')) AS cfg
                              WHERE cfg LIKE 'search_path=%')
            LOOP
                EXECUTE format('ALTER FUNCTION %s SET search_path = public', fn.signature);
                RAISE NOTICE 'search_path fijado en %', fn.signature;
            END LOOP;
    END
$$;


-- ============================================================
-- 7. Vistas: que no salteen RLS
-- ============================================================
--
-- Una vista corre con los permisos de su dueño salvo que se le pida lo contrario,
-- así que lee las tablas de abajo SIN pasar por RLS. notification_stats es un
-- GROUP BY user_id sobre notifications sin filtro alguno: quien pudiera leerla veía
-- de una la actividad de todos los usuarios, esquivando la policy de notifications.
--
-- Y user_stats / user_sport_stats venían con GRANT SELECT explícito a anon
-- (migraciones 021 y 023). Ese no depende del default del entorno: es un permiso
-- escrito a mano, o sea que las estadísticas y el elo de todos los usuarios se leen
-- hoy sin estar logueado. El GRANT se revoca en el bloque 8.
ALTER VIEW public.user_stats SET (security_invoker = true);
ALTER VIEW public.user_sport_stats SET (security_invoker = true);
ALTER VIEW public.notification_stats SET (security_invoker = true);


-- ============================================================
-- 8. Línea de base de privilegios: explícita, no heredada
-- ============================================================
--
-- RLS filtra filas, pero sólo entra en juego si el rol tiene el GRANT de tabla. Y
-- ese GRANT hoy es ambiente: depende de qué rol creó cada objeto. Las tablas
-- creadas por supabase_admin heredan un default que le da todo el DML a anon y
-- authenticated; las creadas por postgres, uno que no les da nada. Esta base local
-- quedó del segundo lado y la hosteada, donde las migraciones se aplicaron a mano
-- desde el editor SQL, casi seguro del primero.
--
-- Depender de eso es insostenible: la misma migración da distinta seguridad según
-- dónde corra, y no hay forma de auditarlo leyendo el repo. Así que acá se fija a
-- mano. Se revoca todo y se otorga sólo lo que la app usa de verdad.
--
-- service_role, postgres y supabase_admin no se tocan: la Edge Function y los jobs
-- de cron corren con esos y necesitan acceso completo.

-- ── anon: cero acceso ──────────────────────────────────────────────────────
-- Ninguna pantalla consulta la base sin sesión. Login, registro y recuperación de
-- contraseña van por /auth/v1, que es otro servicio y no pasa por PostgREST.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- ── Superficie de RPC ──────────────────────────────────────────────────────
-- Postgres le da EXECUTE a PUBLIC por defecto, así que toda función del esquema es
-- invocable vía /rest/v1/rpc/<nombre> por cualquiera que tenga la anon key. Entre
-- ellas create_notification(), que es SECURITY DEFINER y escribe en notifications
-- salteando RLS: dejarla abierta reabre el agujero del push falso del bloque 1 por
-- la puerta de al lado, con la policy borrada y todo.
--
-- Se cierra todo y se abren sólo las nueve que el cliente llama de verdad. Las
-- demás (triggers, jobs de cron, helpers) no las necesita nadie desde afuera.
REVOKE EXECUTE ON ALL ROUTINES IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL ROUTINES IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL ROUTINES IN SCHEMA public FROM authenticated;

GRANT EXECUTE ON FUNCTION public.accept_join_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_join_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_multiple_players(UUID, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_match_player(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_match_result(UUID, INTEGER, INTEGER, JSONB, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_match_result(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vote_match_result(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_match_result_vote(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.matches_near_location(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

-- Excepción que no es una RPC: sport_levels_are_valid() es el CHECK de
-- profiles.sport_levels, y un CHECK se evalúa con los privilegios de quien escribe.
-- Sin este GRANT, revocar EXECUTE de PUBLIC deja a todos los usuarios sin poder
-- guardar el perfil, con un "permission denied for function" que no menciona el
-- CHECK por ningún lado. Es la única función del esquema referenciada desde una
-- restricción; si mañana se agrega otra, esto hay que repetirlo:
--
--   SELECT DISTINCT p.oid::regprocedure
--   FROM pg_depend d JOIN pg_proc p ON p.oid = d.refobjid
--   WHERE d.refclassid = 'pg_proc'::regclass
--     AND d.classid IN ('pg_constraint'::regclass, 'pg_attrdef'::regclass);
GRANT EXECUTE ON FUNCTION public.sport_levels_are_valid(JSONB) TO authenticated;

-- ── DML para authenticated: partir de cero y otorgar lo justo ──────────────
-- Este REVOKE no es decorativo, es lo que hace que el bloque entero signifique
-- algo. Sin él los GRANT de abajo sólo SUMAN sobre lo que ya había, y "lo que ya
-- había" depende del entorno: en una base creada por postgres, nada; en la
-- hosteada, SELECT/INSERT/UPDATE/DELETE sobre todas las tablas.
--
-- El caso concreto que se escapaba: authenticated conservaba el INSERT en
-- notifications, o sea justo la segunda cerradura que este archivo dice poner. La
-- policy borrada lo seguía frenando, así que no quedaba explotable, pero la
-- defensa en profundidad era ficticia — y peor, la migración daba distinto
-- resultado local que en producción, que es exactamente lo que este bloque vino a
-- eliminar.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;

-- A partir de acá, el criterio es que el GRANT no vaya más lejos que la policy.
-- Donde no hay policy, RLS ya niega y el GRANT sólo sería ruido que confunde en la
-- próxima auditoría.
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.matches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.join_requests TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.match_players TO authenticated;
GRANT SELECT, INSERT ON public.match_ratings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_results TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_player_stats TO authenticated;
GRANT SELECT, DELETE ON public.match_result_confirmations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tournaments TO authenticated;
GRANT SELECT, INSERT ON public.teams TO authenticated;
GRANT SELECT ON public.team_members TO authenticated;

-- notifications a propósito SIN INSERT: es la segunda cerradura sobre el bloque 1.
-- Aunque alguien reponga la policy vieja por error, sin el GRANT no entra.
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;

-- match_notification_log queda sin GRANT: es bitácora interna del job de cron.

GRANT SELECT ON public.user_stats TO authenticated;
GRANT SELECT ON public.user_sport_stats TO authenticated;
GRANT SELECT ON public.notification_stats TO authenticated;

-- ── Y que lo que se cree mañana no vuelva a abrirse solo ───────────────────
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON ROUTINES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON ROUTINES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON ROUTINES FROM authenticated;

-- Los de arriba valen para lo que cree postgres, que es el rol con el que corren
-- las migraciones. El otro dueño posible es supabase_admin, que trae el default
-- permisivo, pero sus default privileges no se pueden tocar desde acá: postgres no
-- es miembro suyo y el ALTER falla con "permission denied to change default
-- privileges", tanto local como en el proyecto hosteado.
--
-- En la práctica no hace falta: todo objeto nuevo va a nacer de una migración
-- corrida como postgres. Lo que sí hay que sostener es el hábito — el bloque 6d del
-- smoke test falla si alguna tabla futura termina accesible para anon, que es la
-- red de seguridad que reemplaza a este ALTER.
