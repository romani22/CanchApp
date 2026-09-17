-- =====================================================
-- Verificación de la migración 027: invitaciones con consentimiento
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
--
-- OJO CON EL CONTROL 4: la 027 revoca EXECUTE en masa para refijar la línea de base
-- y eso se lleva el GRANT que necesita el CHECK de profiles.sport_levels. Si falla,
-- nadie puede guardar el perfil.
-- =====================================================

WITH checks AS (

    -- ── La columna que da la dirección ─────────────────────────────────────
    SELECT 1 AS orden,
           'join_requests.invited_by existe' AS control,
           CASE
               WHEN EXISTS (SELECT 1
                            FROM information_schema.columns
                            WHERE table_schema = 'public'
                              AND table_name = 'join_requests'
                              AND column_name = 'invited_by')
                   THEN '' ELSE 'FALTA' END AS problema

    UNION ALL

    SELECT 2,
           'notification_type tiene match_invitation',
           CASE
               WHEN EXISTS (SELECT 1 FROM pg_enum
                            WHERE enumtypid = 'notification_type'::REGTYPE
                              AND enumlabel = 'match_invitation')
                   THEN '' ELSE 'FALTA' END

    UNION ALL

    -- ── Las RPC del cliente: las nueve, ni una menos ───────────────────────
    -- Se usa el oid y no el nombre para no repetir el problema de
    -- has_function_privilege() sobre una función inexistente, que corta con error en
    -- vez de devolver false y se lleva el resto de la consulta.
    SELECT 3,
           'las 9 RPC del cliente están abiertas para authenticated',
           COALESCE((SELECT string_agg(f.nombre, ', ')
                     FROM (VALUES ('accept_join_request'),
                                  ('reject_join_request'),
                                  ('accept_match_invitation'),
                                  ('reject_match_invitation'),
                                  ('save_match_result'),
                                  ('delete_match_result'),
                                  ('vote_match_result'),
                                  ('clear_match_result_vote'),
                                  ('matches_near_location')) AS f(nombre)
                     WHERE NOT EXISTS (SELECT 1
                                       FROM pg_proc p
                                                JOIN pg_namespace n ON n.oid = p.pronamespace
                                       WHERE n.nspname = 'public'
                                         AND p.proname = f.nombre
                                         AND has_function_privilege('authenticated', p.oid, 'EXECUTE'))), '')

    UNION ALL

    -- ── El GRANT que se lleva puesto el REVOKE en masa ─────────────────────
    SELECT 4,
           'el CHECK de sport_levels conserva su EXECUTE',
           COALESCE((SELECT CASE
                                WHEN has_function_privilege('authenticated', p.oid, 'EXECUTE') THEN ''
                                ELSE 'los usuarios NO pueden guardar el perfil' END
                     FROM pg_proc p
                              JOIN pg_namespace n ON n.oid = p.pronamespace
                     WHERE n.nspname = 'public'
                       AND p.proname = 'sport_levels_are_valid'),
                    'no existe sport_levels_are_valid')

    UNION ALL

    -- ── Y que el REVOKE en masa haya alcanzado a lo nuevo ──────────────────
    -- Éste es el control que importa de la 027: Postgres le da EXECUTE a PUBLIC en
    -- toda función nueva, y el ALTER DEFAULT PRIVILEGES de la 025 no lo evitó. Si
    -- esto falla, hay funciones invocables con la anon key vía /rest/v1/rpc.
    -- has_function_privilege sobre anon también da true cuando el permiso lo tiene
    -- PUBLIC, así que un solo chequeo cubre los dos casos.
    SELECT 5,
           'anon no puede ejecutar ninguna función de public',
           COALESCE((SELECT string_agg(p.oid::REGPROCEDURE::TEXT, ', ')
                     FROM pg_proc p
                              JOIN pg_namespace n ON n.oid = p.pronamespace
                     WHERE n.nspname = 'public'
                       AND has_function_privilege('anon', p.oid, 'EXECUTE')), '')

    UNION ALL

    -- ── El corazón de la migración ─────────────────────────────────────────
    -- accept_join_request tiene que rechazar las invitaciones. Sin eso, el creador
    -- acepta la invitación que él mismo mandó y el consentimiento del invitado es
    -- decorativo — o sea, el hallazgo A4 sigue abierto con dos pasos más.
    --
    -- Es un chequeo de texto sobre el cuerpo de la función y por lo tanto frágil; la
    -- prueba de verdad es el bloque 12d del smoke test local, que intenta el ataque.
    SELECT 6,
           'accept_join_request rechaza las invitaciones',
           CASE
               WHEN EXISTS (SELECT 1
                            FROM pg_proc p
                                     JOIN pg_namespace n ON n.oid = p.pronamespace
                            WHERE n.nspname = 'public'
                              AND p.proname = 'accept_join_request'
                              AND p.prosrc LIKE '%invited_by IS NOT NULL%')
                   THEN '' ELSE 'NO tiene el guard: A4 sigue abierto' END

    UNION ALL

    SELECT 7,
           'accept_match_invitation exige ser el invitado',
           CASE
               WHEN EXISTS (SELECT 1
                            FROM pg_proc p
                                     JOIN pg_namespace n ON n.oid = p.pronamespace
                            WHERE n.nspname = 'public'
                              AND p.proname = 'accept_match_invitation'
                              AND p.prosrc LIKE '%user_id IS DISTINCT FROM auth.uid()%')
                   THEN '' ELSE 'NO valida quién acepta' END

    UNION ALL

    -- ── Triggers ───────────────────────────────────────────────────────────
    SELECT 8,
           'trigger protect_join_request_identity activo',
           CASE
               WHEN EXISTS (SELECT 1 FROM pg_trigger
                            WHERE tgrelid = 'public.join_requests'::REGCLASS
                              AND tgname = 'protect_join_request_identity'
                              AND NOT tgisinternal)
                   THEN '' ELSE 'FALTA' END

    UNION ALL

    SELECT 9,
           'trigger de aviso al invitado activo',
           CASE
               WHEN EXISTS (SELECT 1 FROM pg_trigger
                            WHERE tgrelid = 'public.join_requests'::REGCLASS
                              AND tgname = 'trigger_notify_match_invitation'
                              AND NOT tgisinternal)
                   THEN '' ELSE 'FALTA' END

    UNION ALL

    -- ── Policies ───────────────────────────────────────────────────────────
    SELECT 10,
           'la policy de INSERT distingue solicitud de invitación',
           CASE
               WHEN EXISTS (SELECT 1 FROM pg_policies
                            WHERE tablename = 'join_requests'
                              AND policyname = 'Authenticated users can create requests')
                   THEN 'sigue viva la policy vieja, que sólo aceptaba auto-solicitudes'
               WHEN NOT EXISTS (SELECT 1 FROM pg_policies
                                WHERE tablename = 'join_requests'
                                  AND policyname = 'Users request and creators invite'
                                  AND with_check LIKE '%invited_by%')
                   THEN 'FALTA la policy nueva'
               ELSE '' END

    UNION ALL

    SELECT 11,
           'las policies de la 027 están acotadas a authenticated',
           COALESCE((SELECT string_agg(policyname, ', ')
                     FROM pg_policies
                     WHERE tablename = 'join_requests'
                       AND NOT ('authenticated' = ANY (roles))), '')

    UNION ALL

    -- ── La cerradura de verdad ─────────────────────────────────────────────
    -- Lo anterior verifica el camino de la app. Esto verifica lo que la base permite:
    -- sin esta policy, un POST a /rest/v1/match_participants saltea el flujo de
    -- invitación completo y A4 sigue abierto, por más que la app invite bien.
    SELECT 13,
           'match_participants no acepta registrados sin invitación',
           CASE
               WHEN EXISTS (SELECT 1 FROM pg_policies
                            WHERE tablename = 'match_participants'
                              AND policyname = 'Only match creators can add participants')
                   THEN 'sigue viva la policy vieja: A4 abierto por PostgREST'
               WHEN NOT EXISTS (SELECT 1 FROM pg_policies
                                WHERE tablename = 'match_participants'
                                  AND cmd = 'INSERT'
                                  AND with_check LIKE '%user_id IS NULL%')
                   THEN 'la policy de INSERT no limita el user_id'
               ELSE '' END

    UNION ALL

    -- ── Transversal, heredado de la 025 ────────────────────────────────────
    SELECT 12,
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
