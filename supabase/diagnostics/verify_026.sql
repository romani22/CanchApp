-- =====================================================
-- Verificación posterior a la migración 026
-- =====================================================
--
-- CORRER ESTO DESPUÉS DE APLICAR LA 026, en el editor SQL del proyecto hosteado.
--
-- Es de sólo lectura y no inserta datos de prueba, igual que verify_025.sql. Ésa es
-- la diferencia con smoke_rls_security.sql, que crea usuarios y partidos falsos y
-- dispara triggers de verdad: aquel prueba el comportamiento y sólo va contra la base
-- local, éste inspecciona el estado y por eso es seguro en producción.
--
-- Todo tiene que decir OK. Cualquier FALLA significa que la migración quedó a
-- medias — lo más probable, que una sentencia haya cortado y el resto no corriera.
-- Aplicar la 026 de nuevo es seguro: es re-ejecutable de punta a punta.
-- =====================================================

WITH checks AS (

    -- ── Bloque 1: elo_rating protegido ─────────────────────────────────────
    -- No se puede inspeccionar "qué columnas congela el trigger" desde el catálogo,
    -- así que se busca la asignación en el cuerpo de la función. Es un chequeo de
    -- texto y por lo tanto frágil, pero es lo único disponible sin escribir datos;
    -- la prueba de comportamiento real es el bloque 8 del smoke test local.
    SELECT 1 AS orden,
           'protect_profile_derived_columns congela elo_rating' AS control,
           CASE
               WHEN EXISTS (SELECT 1
                            FROM pg_proc p
                                     JOIN pg_namespace n ON n.oid = p.pronamespace
                            WHERE n.nspname = 'public'
                              AND p.proname = 'protect_profile_derived_columns'
                              AND p.prosrc LIKE '%NEW.elo_rating := OLD.elo_rating%')
                   THEN '' ELSE 'la función no protege elo_rating' END AS problema

    UNION ALL

    SELECT 2,
           'trigger protect_profile_derived_columns activo',
           CASE
               WHEN EXISTS (SELECT 1
                            FROM pg_trigger
                            WHERE tgname = 'protect_profile_derived_columns'
                              AND NOT tgisinternal)
                   THEN '' ELSE 'FALTA' END

    UNION ALL

    -- ── Bloque 2: match_players cerrada ────────────────────────────────────
    SELECT 3,
           'add_multiple_players y remove_match_player borradas',
           COALESCE((SELECT string_agg(p.oid::REGPROCEDURE::TEXT, ', ')
                     FROM pg_proc p
                              JOIN pg_namespace n ON n.oid = p.pronamespace
                     WHERE n.nspname = 'public'
                       AND p.proname IN ('add_multiple_players', 'remove_match_player')), '')

    UNION ALL

    SELECT 4,
           'match_players sin DML para authenticated',
           COALESCE((SELECT string_agg(priv, ', ')
                     FROM unnest(ARRAY ['INSERT','UPDATE','DELETE']) AS priv
                     WHERE has_table_privilege('authenticated', 'public.match_players', priv)), '')

    UNION ALL

    -- La policy de INSERT tiene que exigir ser el creador del partido. Se verifica
    -- que exista con el nombre nuevo Y que la vieja permisiva no siga viva.
    SELECT 5,
           'policy de INSERT de match_players exige el creador',
           CASE
               WHEN EXISTS (SELECT 1 FROM pg_policies
                            WHERE tablename = 'match_players'
                              AND policyname = 'Authenticated users can add players')
                   THEN 'sigue viva la policy permisiva vieja'
               WHEN NOT EXISTS (SELECT 1 FROM pg_policies
                                WHERE tablename = 'match_players'
                                  AND policyname = 'Match creators can add players')
                   THEN 'FALTA la policy nueva'
               ELSE '' END

    UNION ALL

    -- ── Bloque 3: resultados sólo por RPC ──────────────────────────────────
    SELECT 6,
           'match_results sin DML para authenticated',
           COALESCE((SELECT string_agg(priv, ', ')
                     FROM unnest(ARRAY ['INSERT','UPDATE','DELETE']) AS priv
                     WHERE has_table_privilege('authenticated', 'public.match_results', priv)), '')

    UNION ALL

    SELECT 7,
           'match_player_stats sin DML para authenticated',
           COALESCE((SELECT string_agg(priv, ', ')
                     FROM unnest(ARRAY ['INSERT','UPDATE','DELETE']) AS priv
                     WHERE has_table_privilege('authenticated', 'public.match_player_stats', priv)), '')

    UNION ALL

    -- Y las policies FOR ALL de la 021 tienen que estar dadas de baja.
    SELECT 8,
           'policies de escritura de resultados dadas de baja',
           COALESCE((SELECT string_agg(policyname, ', ')
                     FROM pg_policies
                     WHERE policyname IN ('Match creators can write results',
                                          'Match creators can write player stats')), '')

    UNION ALL

    -- Pero la lectura tiene que seguir: alimenta la pantalla de resultado y las
    -- estadísticas del perfil. Si esto falla, la app se rompe.
    SELECT 9,
           'los resultados siguen siendo legibles',
           CASE
               WHEN has_table_privilege('authenticated', 'public.match_results', 'SELECT')
                   AND has_table_privilege('authenticated', 'public.match_player_stats', 'SELECT')
                   THEN '' ELSE 'authenticated perdió el SELECT' END

    UNION ALL

    -- ── Bloque 4: join_requests con la policy invertida ────────────────────
    SELECT 10,
           'join_requests: se fue la policy de UPDATE del creador',
           CASE
               WHEN EXISTS (SELECT 1 FROM pg_policies
                            WHERE tablename = 'join_requests'
                              AND policyname = 'Match creators can update request status')
                   THEN 'sigue viva' ELSE '' END

    UNION ALL

    SELECT 11,
           'join_requests: está la policy del dueño de la solicitud',
           CASE
               WHEN EXISTS (SELECT 1 FROM pg_policies
                            WHERE tablename = 'join_requests'
                              AND policyname = 'Users can re-request their own join request')
                   THEN '' ELSE 'FALTA' END

    UNION ALL

    -- El WITH CHECK de esa policy es lo que impide auto-aceptarse y reasignar la
    -- solicitud a otro usuario. Si quedó sin la condición de 'pending', la policy
    -- existe pero no protege.
    SELECT 12,
           'la policy nueva exige status pending en la fila nueva',
           CASE
               WHEN EXISTS (SELECT 1 FROM pg_policies
                            WHERE tablename = 'join_requests'
                              AND policyname = 'Users can re-request their own join request'
                              AND with_check LIKE '%pending%'
                              AND with_check LIKE '%uid()%')
                   THEN '' ELSE 'el WITH CHECK no es el esperado' END

    UNION ALL

    -- Y authenticated tiene que CONSERVAR el UPDATE sobre join_requests: es lo que
    -- hace falta para volver a pedir entrar después de un rechazo. Este control está
    -- al revés que los de arriba a propósito — acá el riesgo es haber revocado de más.
    SELECT 13,
           'authenticated conserva el UPDATE de join_requests',
           CASE
               WHEN has_table_privilege('authenticated', 'public.join_requests', 'UPDATE')
                   THEN '' ELSE 'se revocó de más: re-solicitar va a fallar' END

    UNION ALL

    -- ── Transversales, heredados de la 025 ─────────────────────────────────
    -- Las policies nuevas se escribieron todas con TO authenticated. Si alguna quedó
    -- sin cláusula TO, aplica también a anon y el permiso deja de ser explícito.
    SELECT 14,
           'policies de la 026 acotadas a authenticated',
           COALESCE((SELECT string_agg(tablename || '.' || policyname, ', ')
                     FROM pg_policies
                     WHERE policyname IN ('Match creators can add players',
                                          'Match players are viewable by authenticated users',
                                          'Can delete own added players or creator can delete',
                                          'Results are viewable by authenticated users',
                                          'Player stats are viewable by authenticated users',
                                          'Users can re-request their own join request',
                                          'Users can view their own requests',
                                          'Authenticated users can create requests',
                                          'Users can delete their own requests')
                       AND NOT ('authenticated' = ANY (roles))), '')

    UNION ALL

    -- La 026 no crea funciones nuevas, pero el bloque 6 de la 025 fijaba search_path
    -- en todas las SECURITY DEFINER. Se revisa de nuevo por si algo quedó suelto.
    SELECT 15,
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
