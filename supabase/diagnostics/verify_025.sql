-- =====================================================
-- Verificación de la migración 025: cierre de RLS y privilegios
-- =====================================================
--
-- Correr en el editor SQL del hosteado, después de aplicar la migración.
--
-- Sólo lectura: inspecciona el catálogo y no crea datos, por eso es seguro en
-- producción. El comportamiento se prueba en smoke_rls_security.sql, que crea
-- usuarios falsos y sólo va contra la base local.
--
-- Todo tiene que decir OK. La migración es re-ejecutable: ante una FALLA se puede
-- volver a aplicar entera.
-- =====================================================

WITH checks AS (

    -- anon no puede tocar ninguna tabla ni vista de public.
    SELECT 1 AS orden,
           'anon sin acceso a tablas' AS control,
           COALESCE(string_agg(DISTINCT c.relname, ', '), '') AS problema
    FROM pg_class c
             JOIN pg_namespace n ON n.oid = c.relnamespace
             CROSS JOIN unnest(ARRAY ['SELECT','INSERT','UPDATE','DELETE']) AS priv
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'v', 'm')
      AND has_table_privilege('anon', c.oid, priv)

    UNION ALL

    -- anon no puede ejecutar ninguna función de public.
    SELECT 2,
           'anon sin RPC',
           COALESCE(string_agg(p.oid::REGPROCEDURE::TEXT, ', '), '')
    FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND has_function_privilege('anon', p.oid, 'EXECUTE')

    UNION ALL

    -- Nadie puede insertar notificaciones: ni por policy ni por GRANT.
    SELECT 3,
           'notifications sin INSERT para authenticated',
           CASE WHEN has_table_privilege('authenticated', 'public.notifications', 'INSERT')
                    THEN 'authenticated todavía tiene INSERT' ELSE '' END

    UNION ALL

    SELECT 4,
           'policy "System can create notifications" borrada',
           COALESCE((SELECT string_agg(policyname, ', ')
                     FROM pg_policies
                     WHERE schemaname = 'public' AND tablename = 'notifications' AND cmd = 'INSERT'), '')

    UNION ALL

    -- create_notification() cerrada: es el segundo camino al mismo agujero.
    SELECT 5,
           'create_notification() no invocable',
           CASE WHEN has_function_privilege('authenticated',
                                            'public.create_notification(uuid,text,text,text,jsonb)', 'EXECUTE')
                    THEN 'authenticated puede llamarla' ELSE '' END

    UNION ALL

    -- Eran nueve hasta la 025; la 026 borró las dos de match_players.
    --
    -- El CASE con to_regprocedure() es obligatorio: has_function_privilege() sobre una
    -- función inexistente corta con error y se lleva los otros doce chequeos. Tiene que
    -- ser CASE y no OR, porque en un OR Postgres no garantiza el orden de evaluación.
    SELECT 6,
           'las 7 RPC del cliente siguen abiertas',
           COALESCE(string_agg(f.nombre || CASE WHEN to_regprocedure(f.nombre) IS NULL
                                                    THEN ' (NO EXISTE)' ELSE '' END, ', '), '')
    FROM (VALUES ('public.accept_join_request(uuid)'),
                 ('public.reject_join_request(uuid)'),
                 ('public.save_match_result(uuid,integer,integer,jsonb,text,jsonb)'),
                 ('public.delete_match_result(uuid)'),
                 ('public.vote_match_result(uuid,text,text)'),
                 ('public.clear_match_result_vote(uuid)'),
                 ('public.matches_near_location(double precision,double precision,double precision)')
         ) AS f(nombre)
    WHERE CASE WHEN to_regprocedure(f.nombre) IS NULL THEN true
               ELSE NOT has_function_privilege('authenticated', f.nombre, 'EXECUTE') END

    UNION ALL

    -- El CHECK de sport_levels: sin este GRANT nadie puede guardar el perfil.
    SELECT 7,
           'sport_levels_are_valid() ejecutable (CHECK de profiles)',
           CASE WHEN has_function_privilege('authenticated',
                                            'public.sport_levels_are_valid(jsonb)', 'EXECUTE')
                    THEN '' ELSE 'FALTA: nadie va a poder guardar el perfil' END

    UNION ALL

    -- Lo mínimo que la app necesita para funcionar.
    SELECT 8,
           'authenticated conserva lo que la app usa',
           COALESCE(string_agg(g.tabla || ':' || g.priv, ', '), '')
    FROM (VALUES ('public.profiles', 'SELECT'), ('public.profiles', 'UPDATE'),
                 ('public.matches', 'SELECT'), ('public.matches', 'INSERT'),
                 ('public.match_participants', 'SELECT'), ('public.match_participants', 'INSERT'),
                 ('public.join_requests', 'SELECT'), ('public.join_requests', 'INSERT'),
                 ('public.notifications', 'SELECT'), ('public.notifications', 'UPDATE'),
                 ('public.notifications', 'DELETE'),
                 ('public.push_tokens', 'SELECT'), ('public.push_tokens', 'INSERT'),
                 ('public.user_stats', 'SELECT'), ('public.user_sport_stats', 'SELECT')
         ) AS g(tabla, priv)
    WHERE NOT has_table_privilege('authenticated', g.tabla, g.priv)

    UNION ALL

    -- Las tres vistas tienen que respetar RLS.
    SELECT 9,
           'vistas con security_invoker',
           COALESCE(string_agg(c.relname, ', '), '')
    FROM pg_class c
             JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'v'
      AND COALESCE(array_to_string(c.reloptions, ','), '') NOT LIKE '%security_invoker=true%'

    UNION ALL

    -- Ninguna SECURITY DEFINER sin search_path.
    SELECT 10,
           'SECURITY DEFINER con search_path',
           COALESCE(string_agg(p.oid::REGPROCEDURE::TEXT, ', '), '')
    FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND NOT EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig, '{}')) AS cfg
                      WHERE cfg LIKE 'search_path=%')

    UNION ALL

    -- Calificado por tabla: un trigger homónimo en otra tabla haría pasar esto en falso.
    SELECT 11,
           'trigger protect_profile_derived_columns activo',
           CASE WHEN EXISTS (SELECT 1 FROM pg_trigger
                             WHERE tgrelid = 'public.profiles'::REGCLASS
                               AND tgname = 'protect_profile_derived_columns'
                               AND NOT tgisinternal)
                    THEN '' ELSE 'FALTA' END

    UNION ALL

    SELECT 12,
           'CHECK match_ratings_no_self_rating',
           CASE WHEN EXISTS (SELECT 1 FROM pg_constraint
                             WHERE conrelid = 'public.match_ratings'::REGCLASS
                               AND conname = 'match_ratings_no_self_rating')
                    THEN '' ELSE 'FALTA' END

    UNION ALL

    -- Todas las tablas con RLS prendida.
    SELECT 13,
           'todas las tablas con RLS',
           COALESCE(string_agg(c.relname, ', '), '')
    FROM pg_class c
             JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT c.relrowsecurity
)

SELECT CASE WHEN problema = '' THEN 'OK' ELSE 'FALLA' END AS resultado,
       control,
       problema
FROM checks
ORDER BY CASE WHEN problema = '' THEN 1 ELSE 0 END, orden;
