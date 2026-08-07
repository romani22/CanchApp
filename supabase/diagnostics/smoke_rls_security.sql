-- =====================================================
-- Smoke test: hardening de RLS (migración 025)
-- =====================================================
--
-- Cómo correrlo contra la base local:
--
--   supabase db reset
--   docker exec -i supabase_db_CanchApp psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/diagnostics/smoke_rls_security.sql
--
-- Cada bloque levanta una excepción si algo no da lo esperado: si termina con
-- ROLLBACK y sin ERROR, pasó todo. Termina en ROLLBACK a propósito.
--
-- Por qué existe: la anon key viaja adentro del APK, así que un atacante habla
-- directo con PostgREST y las policies son la única defensa. Este archivo simula
-- exactamente eso — SET ROLE + request.jwt.claims es lo mismo que hace PostgREST
-- al recibir un request — y verifica las dos mitades de cada regla: que el ataque
-- falle Y que el uso legítimo siga funcionando. Lo segundo importa igual: una
-- policy de más rompe la app tan callada como una de menos.
-- =====================================================
\set ON_ERROR_STOP on

BEGIN;

-- ── Datos de prueba ────────────────────────────────────────────────────────
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('11111111-1111-1111-1111-111111111111', 'ana@test.com', '{"full_name":"Ana"}'),
       ('22222222-2222-2222-2222-222222222222', 'beto@test.com', '{"full_name":"Beto"}');

INSERT INTO matches (id, creator_id, sport, title, starts_at, venue_name, total_players, players_needed)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
        'futbol', 'Picadito RLS', NOW() - INTERVAL '2 hours', 'Cancha Test', 4, 4);

INSERT INTO match_participants (match_id, user_id, is_creator)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', true),
       ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', false);

-- Notificación de arranque para Beto, creada como sistema (igual que los triggers).
INSERT INTO notifications (id, user_id, type, title, body)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222',
        'new_match', 'Notificación de Beto', 'cuerpo');


-- ══════════════════════════════════════════════════════════════════════════
-- 1. profiles ya no es legible sin login
-- ══════════════════════════════════════════════════════════════════════════
-- Dos desenlaces cuentan como aprobado, y conviene distinguirlos: sin GRANT de
-- tabla la consulta ni siquiera llega a RLS y Postgres corta antes (que es la
-- defensa más fuerte); con GRANT pero con la policy acotada a authenticated,
-- devuelve cero filas. Falla sólo si sale algún perfil.
DO
$$
    DECLARE
        visibles INTEGER;
    BEGIN
        SET LOCAL ROLE anon;
        BEGIN
            SELECT COUNT(*) INTO visibles FROM profiles;
            RESET ROLE;
            IF visibles <> 0 THEN
                RAISE EXCEPTION 'FUGA: anon ve % perfiles (mail y teléfono incluidos)', visibles;
            END IF;
            RAISE NOTICE 'OK 1 — anon no ve ningún perfil (RLS lo filtra)';
        EXCEPTION
            WHEN insufficient_privilege THEN
                RESET ROLE;
                RAISE NOTICE 'OK 1 — anon no ve ningún perfil (sin GRANT, corta antes de RLS)';
        END;
    END
$$;

-- Y un usuario logueado sí, que es lo que la app necesita para mostrar rivales.
DO
$$
    DECLARE
        visibles INTEGER;
    BEGIN
        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
        SELECT COUNT(*) INTO visibles FROM profiles;
        RESET ROLE;

        IF visibles < 2 THEN
            RAISE EXCEPTION 'ROTO: un usuario logueado sólo ve % perfiles, esperaba 2', visibles;
        END IF;
        RAISE NOTICE 'OK 1b — un usuario logueado sigue viendo los perfiles';
    END
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- 2. Nadie puede fabricar notificaciones (el vector de push falso)
-- ══════════════════════════════════════════════════════════════════════════
DO
$$
    BEGIN
        SET LOCAL ROLE anon;
        BEGIN
            INSERT INTO notifications (user_id, type, title, body)
            VALUES ('22222222-2222-2222-2222-222222222222', 'new_match',
                    'Tu cuenta fue suspendida', 'Entrá acá para reactivarla');
            RESET ROLE;
            RAISE EXCEPTION 'FUGA: anon pudo insertar una notificación con la anon key';
        EXCEPTION
            WHEN insufficient_privilege THEN
                RESET ROLE;
                RAISE NOTICE 'OK 2 — anon no puede insertar notificaciones';
        END;
    END
$$;

DO
$$
    BEGIN
        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
        BEGIN
            INSERT INTO notifications (user_id, type, title, body)
            VALUES ('22222222-2222-2222-2222-222222222222', 'new_match', 'Falsa', 'cuerpo');
            RESET ROLE;
            RAISE EXCEPTION 'FUGA: Ana pudo mandarle una notificación a Beto';
        EXCEPTION
            WHEN insufficient_privilege THEN
                RESET ROLE;
                RAISE NOTICE 'OK 2b — un usuario logueado tampoco puede';
        END;
    END
$$;

-- Pero los triggers SÍ tienen que poder: son la fuente real de notificaciones.
-- Si esto falla, la app se queda muda.
DO
$$
    DECLARE
        antes   INTEGER;
        despues INTEGER;
    BEGIN
        SELECT COUNT(*) INTO antes FROM notifications
        WHERE user_id = '11111111-1111-1111-1111-111111111111';

        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
        INSERT INTO join_requests (match_id, user_id, message)
        VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'me sumo');
        RESET ROLE;

        SELECT COUNT(*) INTO despues FROM notifications
        WHERE user_id = '11111111-1111-1111-1111-111111111111';

        IF despues <= antes THEN
            RAISE EXCEPTION 'ROTO: el trigger de solicitud no creó la notificación (antes=%, despues=%)', antes, despues;
        END IF;
        RAISE NOTICE 'OK 2c — los triggers siguen creando notificaciones';
    END
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- 3. notifications: sólo las propias, y no se pueden reasignar
-- ══════════════════════════════════════════════════════════════════════════
DO
$$
    DECLARE
        visibles INTEGER;
        afectadas INTEGER;
    BEGIN
        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

        SELECT COUNT(*) INTO visibles FROM notifications
        WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
        IF visibles <> 0 THEN
            RAISE EXCEPTION 'FUGA: Ana ve la notificación de Beto';
        END IF;

        DELETE FROM notifications WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
        GET DIAGNOSTICS afectadas = ROW_COUNT;
        IF afectadas <> 0 THEN
            RAISE EXCEPTION 'FUGA: Ana borró la notificación de Beto';
        END IF;

        RESET ROLE;
        RAISE NOTICE 'OK 3 — las notificaciones ajenas no se ven ni se borran';
    END
$$;

-- El borrado propio sí funciona: antes fallaba en silencio por falta de policy.
DO
$$
    DECLARE
        afectadas INTEGER;
    BEGIN
        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
        DELETE FROM notifications WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
        GET DIAGNOSTICS afectadas = ROW_COUNT;
        RESET ROLE;

        IF afectadas <> 1 THEN
            RAISE EXCEPTION 'ROTO: Beto no pudo borrar su propia notificación (filas=%)', afectadas;
        END IF;
        RAISE NOTICE 'OK 3b — cada uno puede borrar las suyas';
    END
$$;

-- WITH CHECK: no se puede mover una notificación propia al buzón de otro.
DO
$$
    DECLARE
        propia UUID;
    BEGIN
        SELECT id INTO propia FROM notifications
        WHERE user_id = '11111111-1111-1111-1111-111111111111' LIMIT 1;

        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
        BEGIN
            UPDATE notifications
            SET user_id = '22222222-2222-2222-2222-222222222222'
            WHERE id = propia;
            RESET ROLE;
            RAISE EXCEPTION 'FUGA: Ana reasignó su notificación a Beto';
        EXCEPTION
            WHEN insufficient_privilege THEN
                RESET ROLE;
                RAISE NOTICE 'OK 3c — no se puede reasignar una notificación';
        END;
    END
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- 4. profiles: columnas derivadas de sólo lectura
-- ══════════════════════════════════════════════════════════════════════════
DO
$$
    DECLARE
        p RECORD;
    BEGIN
        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
        UPDATE profiles
        SET rating        = 5.00,
            rating_count  = 999,
            total_matches = 999,
            total_wins    = 999,
            email         = 'otro@test.com'
        WHERE id = '11111111-1111-1111-1111-111111111111';
        RESET ROLE;

        SELECT rating, rating_count, total_matches, total_wins, email INTO p
        FROM profiles WHERE id = '11111111-1111-1111-1111-111111111111';

        IF p.rating_count <> 0 OR p.total_matches <> 0 OR p.total_wins <> 0 THEN
            RAISE EXCEPTION 'FUGA: se pudieron inflar las stats (count=%, matches=%, wins=%)',
                p.rating_count, p.total_matches, p.total_wins;
        END IF;
        IF p.email <> 'ana@test.com' THEN
            RAISE EXCEPTION 'FUGA: se pudo cambiar el email del perfil a %', p.email;
        END IF;
        RAISE NOTICE 'OK 4 — rating, stats y email quedaron intactos';
    END
$$;

-- Y lo que la app sí edita tiene que seguir andando (Profile.tsx y onboarding).
DO
$$
    DECLARE
        p RECORD;
    BEGIN
        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
        UPDATE profiles
        SET full_name             = 'Ana Editada',
            phone                 = '1122334455',
            bio                   = 'hola',
            zone                  = 'Palermo',
            sport_levels          = '{"futbol":"avanzado"}'::jsonb,
            onboarding_completed  = true,
            notify_new_matches    = false
        WHERE id = '11111111-1111-1111-1111-111111111111';
        RESET ROLE;

        SELECT full_name, zone, sport_levels, notify_new_matches INTO p
        FROM profiles WHERE id = '11111111-1111-1111-1111-111111111111';

        IF p.full_name <> 'Ana Editada' OR p.zone <> 'Palermo'
            OR p.sport_levels <> '{"futbol":"avanzado"}'::jsonb OR p.notify_new_matches <> false THEN
            RAISE EXCEPTION 'ROTO: el trigger bloqueó campos que el usuario sí puede editar (%)', p;
        END IF;
        RAISE NOTICE 'OK 4b — el perfil editable sigue siendo editable';
    END
$$;

-- Y el perfil ajeno sigue siendo intocable.
DO
$$
    DECLARE
        afectadas INTEGER;
    BEGIN
        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
        UPDATE profiles SET full_name = 'Hackeado'
        WHERE id = '22222222-2222-2222-2222-222222222222';
        GET DIAGNOSTICS afectadas = ROW_COUNT;
        RESET ROLE;

        IF afectadas <> 0 THEN
            RAISE EXCEPTION 'FUGA: Ana editó el perfil de Beto';
        END IF;
        RAISE NOTICE 'OK 4c — no se edita el perfil ajeno';
    END
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- 5. match_ratings: nada de autocalificarse
-- ══════════════════════════════════════════════════════════════════════════
DO
$$
    BEGIN
        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
        BEGIN
            INSERT INTO match_ratings (match_id, rater_id, rated_user_id, rating)
            VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                    '11111111-1111-1111-1111-111111111111',
                    '11111111-1111-1111-1111-111111111111', 5);
            RESET ROLE;
            RAISE EXCEPTION 'FUGA: Ana se autocalificó';
        EXCEPTION
            WHEN check_violation OR insufficient_privilege THEN
                RESET ROLE;
                RAISE NOTICE 'OK 5 — no se puede autocalificar';
        END;
    END
$$;

-- Ni calificar a alguien que no jugó ese partido.
DO
$$
    BEGIN
        INSERT INTO auth.users (id, email, raw_user_meta_data)
        VALUES ('33333333-3333-3333-3333-333333333333', 'ajeno@test.com', '{"full_name":"Ajeno"}');

        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
        BEGIN
            INSERT INTO match_ratings (match_id, rater_id, rated_user_id, rating)
            VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                    '11111111-1111-1111-1111-111111111111',
                    '33333333-3333-3333-3333-333333333333', 1);
            RESET ROLE;
            RAISE EXCEPTION 'FUGA: Ana calificó a alguien que no jugó el partido';
        EXCEPTION
            WHEN insufficient_privilege THEN
                RESET ROLE;
                RAISE NOTICE 'OK 5b — sólo se califica a quien jugó';
        END;
    END
$$;

-- El caso legítimo tiene que seguir andando, y con él update_user_rating(), que
-- escribe una de las columnas que el trigger del bloque 4 protege. Es el punto
-- exacto donde un guard mal elegido (auth.uid() IS NULL en vez de current_user)
-- dejaría el rating congelado sin que nada tire error.
DO
$$
    DECLARE
        r NUMERIC;
        c INTEGER;
    BEGIN
        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
        INSERT INTO match_ratings (match_id, rater_id, rated_user_id, rating)
        VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                '11111111-1111-1111-1111-111111111111',
                '22222222-2222-2222-2222-222222222222', 4);
        RESET ROLE;

        SELECT rating, rating_count INTO r, c
        FROM profiles WHERE id = '22222222-2222-2222-2222-222222222222';

        IF c <> 1 OR r <> 4.00 THEN
            RAISE EXCEPTION 'ROTO: update_user_rating() no recalculó (rating=%, count=%)', r, c;
        END IF;
        RAISE NOTICE 'OK 5c — el recálculo de rating del sistema sigue funcionando';
    END
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- 6. Ninguna SECURITY DEFINER quedó sin search_path
-- ══════════════════════════════════════════════════════════════════════════
DO
$$
    DECLARE
        faltantes TEXT;
    BEGIN
        SELECT string_agg(p.oid::regprocedure::text, ', ') INTO faltantes
        FROM pg_proc p
                 JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.prosecdef
          AND NOT EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig, '{}')) AS cfg
                          WHERE cfg LIKE 'search_path=%');

        IF faltantes IS NOT NULL THEN
            RAISE EXCEPTION 'SECURITY DEFINER sin search_path: %', faltantes;
        END IF;
        RAISE NOTICE 'OK 6 — todas las SECURITY DEFINER tienen search_path fijo';
    END
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- 6b. create_notification() no es invocable desde afuera
-- ══════════════════════════════════════════════════════════════════════════
--
-- Es SECURITY DEFINER y escribe en notifications salteando RLS. Con EXECUTE
-- abierto (el default de Postgres es a PUBLIC), un POST a
-- /rest/v1/rpc/create_notification reabre el push falso con la policy borrada y
-- todo. Es el segundo camino al mismo agujero.
DO
$$
    BEGIN
        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
        BEGIN
            PERFORM create_notification('22222222-2222-2222-2222-222222222222',
                                        'new_match', 'Falsa', 'cuerpo', '{}'::jsonb);
            RESET ROLE;
            RAISE EXCEPTION 'FUGA: create_notification() es invocable por RPC';
        EXCEPTION
            WHEN insufficient_privilege THEN
                RESET ROLE;
                RAISE NOTICE 'OK 6b — create_notification() está cerrada';
        END;
    END
$$;

-- Pero las nueve del cliente sí tienen que estar abiertas.
DO
$$
    DECLARE
        cerradas TEXT;
    BEGIN
        SELECT string_agg(f.nombre, ', ') INTO cerradas
        FROM (VALUES ('accept_join_request(uuid)'),
                     ('reject_join_request(uuid)'),
                     ('add_multiple_players(uuid,uuid,jsonb)'),
                     ('remove_match_player(uuid)'),
                     ('save_match_result(uuid,integer,integer,jsonb,text,jsonb)'),
                     ('delete_match_result(uuid)'),
                     ('vote_match_result(uuid,text,text)'),
                     ('clear_match_result_vote(uuid)'),
                     ('matches_near_location(double precision,double precision,double precision)')
             ) AS f(nombre)
        WHERE NOT has_function_privilege('authenticated', f.nombre, 'EXECUTE');

        IF cerradas IS NOT NULL THEN
            RAISE EXCEPTION 'ROTO: la app no puede llamar a %', cerradas;
        END IF;
        RAISE NOTICE 'OK 6c — las 9 RPC del cliente siguen abiertas';
    END
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- 6d. anon no tiene ni un permiso en public
-- ══════════════════════════════════════════════════════════════════════════
DO
$$
    DECLARE
        con_permiso TEXT;
    BEGIN
        SELECT string_agg(DISTINCT c.relname || ':' || priv, ', ') INTO con_permiso
        FROM pg_class c
                 JOIN pg_namespace n ON n.oid = c.relnamespace
                 CROSS JOIN unnest(ARRAY ['SELECT','INSERT','UPDATE','DELETE']) AS priv
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'v', 'm')
          AND has_table_privilege('anon', c.oid, priv);

        IF con_permiso IS NOT NULL THEN
            RAISE EXCEPTION 'FUGA: anon todavía puede %', con_permiso;
        END IF;
        RAISE NOTICE 'OK 6d — anon no tiene acceso a ninguna tabla ni vista';
    END
$$;

DO
$$
    DECLARE
        abiertas TEXT;
    BEGIN
        SELECT string_agg(p.oid::regprocedure::text, ', ') INTO abiertas
        FROM pg_proc p
                 JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND has_function_privilege('anon', p.oid, 'EXECUTE');

        IF abiertas IS NOT NULL THEN
            RAISE EXCEPTION 'FUGA: anon puede ejecutar %', abiertas;
        END IF;
        RAISE NOTICE 'OK 6e — anon no puede ejecutar ninguna función de public';
    END
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- 6f. Las vistas no saltean RLS
-- ══════════════════════════════════════════════════════════════════════════
--
-- notification_stats agrupa notifications por user_id sin filtro. Sin
-- security_invoker, leerla equivale a leer el buzón de todos.
DO
$$
    DECLARE
        filas INTEGER;
    BEGIN
        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
        SELECT COUNT(*) INTO filas FROM notification_stats
        WHERE user_id <> '11111111-1111-1111-1111-111111111111';
        RESET ROLE;

        IF filas <> 0 THEN
            RAISE EXCEPTION 'FUGA: notification_stats muestra % filas de otros usuarios', filas;
        END IF;
        RAISE NOTICE 'OK 6f — notification_stats respeta RLS';
    END
$$;

-- Y user_stats tiene que seguir siendo legible: la usa loadFullProfile().
DO
$$
    DECLARE
        encontrado INTEGER;
    BEGIN
        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
        SELECT COUNT(*) INTO encontrado FROM user_stats
        WHERE user_id = '11111111-1111-1111-1111-111111111111';
        RESET ROLE;

        IF encontrado <> 1 THEN
            RAISE EXCEPTION 'ROTO: user_stats no devuelve el perfil propio (filas=%)', encontrado;
        END IF;
        RAISE NOTICE 'OK 6g — user_stats sigue funcionando para la app';
    END
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- 7. Ninguna tabla de public quedó sin RLS
-- ══════════════════════════════════════════════════════════════════════════
DO
$$
    DECLARE
        sin_rls TEXT;
    BEGIN
        SELECT string_agg(c.relname, ', ') INTO sin_rls
        FROM pg_class c
                 JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND NOT c.relrowsecurity;

        IF sin_rls IS NOT NULL THEN
            RAISE EXCEPTION 'Tablas sin RLS (legibles con la anon key): %', sin_rls;
        END IF;
        RAISE NOTICE 'OK 7 — todas las tablas de public tienen RLS';
    END
$$;

ROLLBACK;
