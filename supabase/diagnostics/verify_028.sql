-- =====================================================
-- Verificación posterior a la migración 028 (eliminar mi cuenta)
-- =====================================================
--
-- CORRER ESTO DESPUÉS DE APLICAR LA 028, en el editor SQL del proyecto hosteado.
--
-- Es de sólo lectura y no inserta datos de prueba, igual que verify_025/026/027.
-- La prueba de comportamiento está en smoke_rls_security.sql (bloque 13), que crea
-- usuarios y partidos falsos y por eso sólo va contra la base local.
--
-- Todo tiene que decir OK. La 028 es re-ejecutable, así que ante una FALLA se puede
-- volver a aplicar entera.
--
-- EL CONTROL QUE MÁS IMPORTA ES EL 1. Si `profiles.id` volviera a referenciar
-- auth.users con ON DELETE CASCADE, el borrado de una cuenta arrastraría los
-- partidos que esa persona organizó y, con ellos, el historial de todos los que
-- jugaron. La feature seguiría "funcionando" y estaría destruyendo datos ajenos en
-- silencio — no hay error, no hay aviso: los partidos simplemente ya no están.
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
    SELECT 6,
           'protect_profile_derived_columns protege deleted_at',
           CASE
               WHEN (SELECT prosrc FROM pg_proc
                     WHERE proname = 'protect_profile_derived_columns') LIKE '%deleted_at%'
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

    -- ── Transversal, heredado de la 025 ────────────────────────────────────
    SELECT 9,
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
