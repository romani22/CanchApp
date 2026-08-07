-- =====================================================
-- Verificación posterior a la migración 025
-- =====================================================
--
-- CORRER ESTO DESPUÉS DE APLICAR LA 025, en el editor SQL del proyecto hosteado.
--
-- Es de sólo lectura y no inserta datos de prueba. Esa es la diferencia con
-- smoke_rls_security.sql, que sí crea usuarios y partidos falsos: aquel prueba el
-- comportamiento y por eso sólo va contra la base local, éste inspecciona el
-- estado y por eso es seguro en producción.
--
-- Todo tiene que decir OK. Cualquier FALLA significa que la migración quedó a
-- medias — lo más probable es que una sentencia haya cortado y el resto no corrió.
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
           COALESCE(string_agg(p.oid::regprocedure::text, ', '), '')
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

    -- Las 9 RPC del cliente tienen que seguir abiertas, o la app se rompe.
    SELECT 6,
           'las 9 RPC del cliente siguen abiertas',
           COALESCE(string_agg(f.nombre, ', '), '')
    FROM (VALUES ('public.accept_join_request(uuid)'),
                 ('public.reject_join_request(uuid)'),
                 ('public.add_multiple_players(uuid,uuid,jsonb)'),
                 ('public.remove_match_player(uuid)'),
                 ('public.save_match_result(uuid,integer,integer,jsonb,text,jsonb)'),
                 ('public.delete_match_result(uuid)'),
                 ('public.vote_match_result(uuid,text,text)'),
                 ('public.clear_match_result_vote(uuid)'),
                 ('public.matches_near_location(double precision,double precision,double precision)')
         ) AS f(nombre)
    WHERE NOT has_function_privilege('authenticated', f.nombre, 'EXECUTE')

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
           COALESCE(string_agg(p.oid::regprocedure::text, ', '), '')
    FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND NOT EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig, '{}')) AS cfg
                      WHERE cfg LIKE 'search_path=%')

    UNION ALL

    -- El trigger que protege las columnas derivadas del perfil.
    SELECT 11,
           'trigger protect_profile_derived_columns activo',
           CASE WHEN EXISTS (SELECT 1 FROM pg_trigger
                             WHERE tgname = 'protect_profile_derived_columns' AND NOT tgisinternal)
                    THEN '' ELSE 'FALTA' END

    UNION ALL

    -- El CHECK que impide autocalificarse.
    SELECT 12,
           'CHECK match_ratings_no_self_rating',
           CASE WHEN EXISTS (SELECT 1 FROM pg_constraint
                             WHERE conname = 'match_ratings_no_self_rating')
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
