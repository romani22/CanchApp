-- =====================================================
-- Verificación de "eliminar mi cuenta": migraciones 028, 029 y 030
-- =====================================================
--
-- Correr en el editor SQL del hosteado, después de aplicar cada migración.
--
-- Sólo lectura: inspecciona el catálogo y no crea datos, por eso es seguro en
-- producción. El comportamiento se prueba en smoke_rls_security.sql, que crea
-- usuarios falsos y sólo va contra la base local.
--
-- Todo tiene que decir OK. La migración es re-ejecutable: ante una FALLA se puede
-- volver a aplicar entera.
--
-- EL CONTROL QUE MÁS IMPORTA ES EL 1. Si volviera el ON DELETE CASCADE, borrar una
-- cuenta arrastraría los partidos que organizó y el historial de todos los que
-- jugaron, sin error y sin aviso: la feature seguiría "funcionando".
-- =====================================================

WITH checks AS (

    -- ── Lo que evita que el borrado se lleve puesto el historial ───────────
    SELECT 1 AS orden,
           'profiles ya no cascadea desde auth.users' AS control,
           COALESCE((SELECT string_agg(conname, ', ')
                     FROM pg_constraint
                     WHERE conrelid = 'public.profiles'::REGCLASS
                       AND contype = 'f'
                       AND confrelid = 'auth.users'::REGCLASS), '') AS problema

    UNION ALL

    SELECT 2,
           'profiles.deleted_at existe',
           CASE
               WHEN EXISTS (SELECT 1
                            FROM information_schema.columns
                            WHERE table_schema = 'public'
                              AND table_name = 'profiles'
                              AND column_name = 'deleted_at')
                   THEN '' ELSE 'FALTA' END

    UNION ALL

    -- ── La función ─────────────────────────────────────────────────────────
    SELECT 3,
           'delete_my_account() existe y es SECURITY DEFINER',
           CASE
               WHEN to_regprocedure('public.delete_my_account()') IS NULL
                   THEN 'NO EXISTE'
               WHEN NOT (SELECT prosecdef FROM pg_proc
                         WHERE oid = to_regprocedure('public.delete_my_account()'))
                   THEN 'no es SECURITY DEFINER: no va a poder borrar auth.users'
               ELSE '' END

    UNION ALL

    -- Sin parámetros no hay forma de pedirle que borre a otro. Si algún día
    -- aparece una versión con argumentos, esto tiene que gritar.
    SELECT 4,
           'delete_my_account() no recibe parámetros',
           COALESCE((SELECT string_agg(p.oid::REGPROCEDURE::TEXT, ', ')
                     FROM pg_proc p
                              JOIN pg_namespace n ON n.oid = p.pronamespace
                     WHERE n.nspname = 'public'
                       AND p.proname = 'delete_my_account'
                       AND p.pronargs > 0), '')

    UNION ALL

    SELECT 5,
           'sólo authenticated puede llamarla',
           CASE
               WHEN to_regprocedure('public.delete_my_account()') IS NULL
                   THEN 'NO EXISTE'
               WHEN has_function_privilege('anon', 'public.delete_my_account()', 'EXECUTE')
                   THEN 'anon puede llamarla'
               WHEN NOT has_function_privilege('authenticated', 'public.delete_my_account()', 'EXECUTE')
                   THEN 'authenticated NO puede llamarla: la feature no funciona'
               ELSE '' END

    UNION ALL

    -- ── deleted_at es del servidor, no del cliente ─────────────────────────
    -- La firma va completa y por to_regprocedure(), no `WHERE proname = ...`: si
    -- algún día aparece una sobrecarga, el subquery escalar devuelve dos filas y
    -- mata la consulta entera — se pierden los 13 controles, no uno. Es la misma
    -- trampa que dejó inservible a verify_025 desde la 026.
    SELECT 6,
           'protect_profile_derived_columns protege deleted_at',
           CASE
               WHEN to_regprocedure('public.protect_profile_derived_columns()') IS NULL
                   THEN 'NO EXISTE'
               WHEN (SELECT prosrc FROM pg_proc
                     WHERE oid = to_regprocedure('public.protect_profile_derived_columns()'))
                        LIKE '%deleted_at%'
                   THEN ''
               ELSE 'el cliente puede marcarse como borrado sin borrarse' END

    UNION ALL

    SELECT 7,
           'el trigger que lo aplica sigue activo',
           CASE
               WHEN EXISTS (SELECT 1 FROM pg_trigger
                            WHERE tgrelid = 'public.profiles'::REGCLASS
                              AND tgname = 'protect_profile_derived_columns'
                              AND NOT tgisinternal)
                   THEN '' ELSE 'FALTA: el trigger no está' END

    UNION ALL

    -- ── No se invita a una lápida ──────────────────────────────────────────
    SELECT 8,
           'la policy de invitación excluye las cuentas borradas',
           CASE
               WHEN EXISTS (SELECT 1 FROM pg_policies
                            WHERE schemaname = 'public'
                              AND tablename = 'join_requests'
                              AND cmd = 'INSERT'
                              AND with_check LIKE '%deleted_at%')
                   THEN ''
               ELSE 'se puede invitar a una cuenta borrada' END

    UNION ALL

    -- ── No se califica a una lápida (029) ──────────────────────────────────
    SELECT 9,
           'la policy de calificación excluye las cuentas borradas',
           CASE
               WHEN EXISTS (SELECT 1 FROM pg_policies
                            WHERE schemaname = 'public'
                              AND tablename = 'match_ratings'
                              AND cmd = 'INSERT'
                              AND with_check LIKE '%deleted_at%')
                   THEN ''
               ELSE 'se puede calificar a una cuenta borrada' END

    UNION ALL

    SELECT 10,
           'el índice de perfiles activos quedó renombrado',
           CASE
               WHEN EXISTS (SELECT 1 FROM pg_indexes
                            WHERE schemaname = 'public' AND indexname = 'idx_profiles_active')
                   THEN '' ELSE 'FALTA idx_profiles_active' END

    UNION ALL

    -- ── La cuenta borrada sale de lo que viene (030) ───────────────────────
    SELECT 11,
           'delete_my_account sale de los partidos futuros ajenos',
           CASE
               WHEN to_regprocedure('public.delete_my_account()') IS NULL
                   THEN 'NO EXISTE'
               WHEN (SELECT prosrc FROM pg_proc
                     WHERE oid = to_regprocedure('public.delete_my_account()'))
                        LIKE '%DELETE FROM match_participants%'
                   THEN ''
               ELSE 'la lápida sigue ocupando lugar en partidos de otros' END

    UNION ALL

    SELECT 12,
           'create_notification no escribe sobre cuentas borradas',
           CASE
               WHEN to_regprocedure('public.create_notification(uuid,text,text,text,jsonb)') IS NULL
                   THEN 'NO EXISTE'
               WHEN (SELECT prosrc FROM pg_proc
                     WHERE oid = to_regprocedure('public.create_notification(uuid,text,text,text,jsonb)'))
                        LIKE '%deleted_at%'
                   THEN ''
               ELSE 'a una cuenta borrada le siguen entrando notificaciones' END

    UNION ALL

    -- ── Transversal, heredado de la 025 ────────────────────────────────────
    SELECT 13,
           'todas las SECURITY DEFINER con search_path fijo',
           COALESCE((SELECT string_agg(p.oid::REGPROCEDURE::TEXT, ', ')
                     FROM pg_proc p
                              JOIN pg_namespace n ON n.oid = p.pronamespace
                     WHERE n.nspname = 'public'
                       AND p.prosecdef
                       AND NOT EXISTS (SELECT 1
                                       FROM unnest(COALESCE(p.proconfig, '{}')) AS cfg
                                       WHERE cfg LIKE 'search_path=%')), '')
)

SELECT CASE WHEN problema = '' THEN 'OK' ELSE 'FALLA' END AS resultado,
       control,
       problema
FROM checks
ORDER BY CASE WHEN problema = '' THEN 1 ELSE 0 END, orden;
