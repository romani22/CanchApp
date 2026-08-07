-- =====================================================
-- Preflight de la migración 025 (hardening de RLS)
-- =====================================================
--
-- CORRER ESTO ANTES DE APLICAR LA 025, pegándolo en el editor SQL del proyecto
-- hosteado. Es de sólo lectura: no escribe, no borra, no abre transacción.
--
-- Va como UNA sola consulta a propósito: el editor de Supabase muestra el
-- resultado de la última sentencia nada más, así que un script de varios SELECT
-- se ve por la mitad. Acá todo sale en una tabla con columna `seccion`.
--
-- Contesta tres cosas que no se pueden saber leyendo el repo:
--
--   1. Si la base hosteada tenía el baseline permisivo de privilegios o el
--      restrictivo — o sea, cuánto de la fuga era real.
--   2. Qué filas va a borrar la 025, que es su único paso destructivo.
--   3. Qué privilegios hay hoy, para poder devolverlos si algo se rompe.
-- =====================================================

WITH
    -- ── 1. Qué puede hacer anon hoy ────────────────────────────────────────
    -- Filas acá = la anon key del APK leía esto sin que nadie se loguee.
    -- Cero filas = la base ya estaba del lado restrictivo y la fuga no existía.
    anon_objetos AS (SELECT '1. anon puede acceder a'                AS seccion,
                            c.relname                                AS detalle,
                            string_agg(priv, ', ' ORDER BY priv)     AS valor
                     FROM pg_class c
                              JOIN pg_namespace n ON n.oid = c.relnamespace
                              CROSS JOIN unnest(ARRAY ['SELECT','INSERT','UPDATE','DELETE']) AS priv
                     WHERE n.nspname = 'public'
                       AND c.relkind IN ('r', 'v', 'm')
                       AND has_table_privilege('anon', c.oid, priv)
                     GROUP BY c.relname),

    -- ── 2. Qué funciones puede invocar anon por RPC ────────────────────────
    -- Importa sobre todo create_notification: es SECURITY DEFINER y escribe
    -- notificaciones salteando RLS. Si aparece, el push falso era explotable
    -- sin siquiera tener cuenta.
    anon_funciones AS (SELECT '2. anon puede ejecutar' AS seccion,
                              p.oid::regprocedure::text AS detalle,
                              CASE WHEN p.prosecdef THEN 'SECURITY DEFINER (grave)' ELSE 'normal' END AS valor
                       FROM pg_proc p
                                JOIN pg_namespace n ON n.oid = p.pronamespace
                       WHERE n.nspname = 'public'
                         AND has_function_privilege('anon', p.oid, 'EXECUTE')),

    -- ── 3. Paso destructivo: autocalificaciones ────────────────────────────
    -- La 025 hace DELETE FROM match_ratings WHERE rater_id = rated_user_id para
    -- poder crear el CHECK. Si el total es 0, no borra nada.
    autocalif_total AS (SELECT '3. autocalificaciones a borrar' AS seccion,
                               'TOTAL'                          AS detalle,
                               COUNT(*)::text                   AS valor
                        FROM match_ratings
                        WHERE rater_id = rated_user_id),

    -- A quiénes les baja el rating cuando se recalcule sin ellas.
    autocalif_detalle AS (SELECT '3. autocalificaciones a borrar'                       AS seccion,
                                 COALESCE(p.full_name, p.id::text)                      AS detalle,
                                 COUNT(*) || ' propias — rating hoy ' || p.rating
                                     || ', quedaría en '
                                     || COALESCE(ROUND((SELECT AVG(r2.rating)
                                                        FROM match_ratings r2
                                                        WHERE r2.rated_user_id = p.id
                                                          AND r2.rater_id <> r2.rated_user_id), 2)::text,
                                                 'sin calificaciones')                  AS valor
                          FROM match_ratings mr
                                   JOIN profiles p ON p.id = mr.rated_user_id
                          WHERE mr.rater_id = mr.rated_user_id
                          GROUP BY p.id, p.full_name, p.rating),

    -- ── 4. Policies de notifications ───────────────────────────────────────
    -- Buscamos "System can create notifications", la que deja a cualquiera
    -- escribirle a cualquiera.
    policies_notif AS (SELECT '4. policies en notifications'                  AS seccion,
                              policyname || ' (' || cmd || ')'                AS detalle,
                              'roles: ' || array_to_string(roles, ',')
                                  || COALESCE(' | with_check: ' || with_check, '') AS valor
                       FROM pg_policies
                       WHERE schemaname = 'public'
                         AND tablename = 'notifications'),

    -- ── 5. Vistas que saltean RLS ──────────────────────────────────────────
    vistas AS (SELECT '5. vistas'  AS seccion,
                      c.relname    AS detalle,
                      CASE
                          WHEN COALESCE(array_to_string(c.reloptions, ','), '') LIKE '%security_invoker=true%'
                              THEN 'respeta RLS'
                          ELSE 'SALTEA RLS (lee como el dueño)'
                          END      AS valor
               FROM pg_class c
                        JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = 'public'
                 AND c.relkind = 'v'),

    -- ── 6. Respaldo de los privilegios actuales de authenticated ───────────
    -- Guardá esta salida. Es el estado previo: si la 025 revoca de más y algo
    -- deja de andar, de acá salen los GRANT para devolverlo a mano.
    respaldo AS (SELECT '6. respaldo: authenticated tiene' AS seccion,
                        c.relname                          AS detalle,
                        string_agg(priv, ', ' ORDER BY priv) AS valor
                 FROM pg_class c
                          JOIN pg_namespace n ON n.oid = c.relnamespace
                          CROSS JOIN unnest(ARRAY ['SELECT','INSERT','UPDATE','DELETE']) AS priv
                 WHERE n.nspname = 'public'
                   AND c.relkind IN ('r', 'v', 'm')
                   AND has_table_privilege('authenticated', c.oid, priv)
                 GROUP BY c.relname)

SELECT *
FROM (SELECT * FROM anon_objetos
      UNION ALL SELECT * FROM anon_funciones
      UNION ALL SELECT * FROM autocalif_total
      UNION ALL SELECT * FROM autocalif_detalle
      UNION ALL SELECT * FROM policies_notif
      UNION ALL SELECT * FROM vistas
      UNION ALL SELECT * FROM respaldo) AS reporte
ORDER BY seccion, detalle;
