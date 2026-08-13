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

-- Pero las del cliente sí tienen que estar abiertas.
--
-- Eran nueve hasta la 025. La 026 borró add_multiple_players y remove_match_player
-- (feature muerta, sin chequeo de autorización) y la 027 agregó las dos de
-- invitaciones, así que son nueve otra vez. Y ojo con listar una que no exista:
-- has_function_privilege() sobre una función inexistente no devuelve false, corta
-- con "function does not exist" y el smoke test entero muere ahí. El bloque 9b es el
-- que verifica que las borradas sigan borradas.
DO
$$
    DECLARE
        cerradas TEXT;
    BEGIN
        SELECT string_agg(f.nombre, ', ') INTO cerradas
        FROM (VALUES ('accept_join_request(uuid)'),
                     ('reject_join_request(uuid)'),
                     ('accept_match_invitation(uuid)'),
                     ('reject_match_invitation(uuid)'),
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

-- Guardar el perfil sigue funcionando: profiles.sport_levels tiene un CHECK que
-- llama a sport_levels_are_valid(), y un CHECK se evalúa con los privilegios de
-- quien ESCRIBE. Cada vez que una migración revoca EXECUTE en masa para volver a
-- fijar la línea de base (la 025 y la 027 lo hacen) se lleva también ese GRANT, y
-- el síntoma es un "permission denied for function" al guardar el perfil que no
-- menciona el CHECK por ningún lado. Este bloque es la red para eso.
DO
$$
    DECLARE
        v_levels JSONB;
    BEGIN
        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
        UPDATE profiles
        SET sport_levels = '{"futbol":"intermedio"}'::JSONB
        WHERE id = '11111111-1111-1111-1111-111111111111';
        RESET ROLE;

        SELECT sport_levels INTO v_levels FROM profiles
        WHERE id = '11111111-1111-1111-1111-111111111111';

        IF v_levels IS NULL OR v_levels->>'futbol' IS DISTINCT FROM 'intermedio' THEN
            RAISE EXCEPTION 'ROTO: no se pudo guardar sport_levels (quedó %)', v_levels;
        END IF;
        RAISE NOTICE 'OK 6h — el CHECK de sport_levels conserva su GRANT de EXECUTE';
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


-- ══════════════════════════════════════════════════════════════════════════
-- 8. profiles.elo_rating es derivada (migración 026)
-- ══════════════════════════════════════════════════════════════════════════
-- El trigger de la 025 enumera lo PROHIBIDO y deja pasar el resto, así que un campo
-- calculado que se olvide de la lista queda editable por el usuario. elo_rating fue
-- justamente ese caso: un PATCH a la fila propia con {"elo_rating": 99999} y el
-- ranking era suyo.
--
-- Las dos mitades se prueban en el MISMO update, que es la forma de que no se pueda
-- aprobar una a costa de la otra: el campo derivado no cambia y el editable sí.
DO
$$
    DECLARE
        elo_final    INTEGER;
        nombre_final TEXT;
    BEGIN
        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

        UPDATE profiles
        SET elo_rating = 99999,
            full_name  = 'Ana Editada'
        WHERE id = '11111111-1111-1111-1111-111111111111';
        RESET ROLE;

        SELECT elo_rating, full_name
        INTO elo_final, nombre_final
        FROM profiles
        WHERE id = '11111111-1111-1111-1111-111111111111';

        IF elo_final = 99999 THEN
            RAISE EXCEPTION 'FUGA: Ana se puso el elo_rating en 99999';
        END IF;

        IF nombre_final <> 'Ana Editada' THEN
            RAISE EXCEPTION 'ROTO: el trigger también bloqueó full_name, que sí es editable (quedó "%")', nombre_final;
        END IF;

        RAISE NOTICE 'OK 8 — elo_rating es de sólo lectura y el resto del perfil sigue editable';
    END
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- 9. match_players: cerrada (migración 026)
-- ══════════════════════════════════════════════════════════════════════════
-- La policy vieja sólo pedía auth.uid() = added_by_user_id, sin decir nada del
-- match_id: cualquiera llenaba el partido de otro hasta total_players (y así impedía
-- que entrara nadie más), o disparaba el trigger notify_user_on_player_added contra
-- la víctima que quisiera con un texto de push a gusto.
DO
$$
    BEGIN
        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
        BEGIN
            INSERT INTO match_players (match_id, added_by_user_id, player_name)
            VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                    '22222222-2222-2222-2222-222222222222', 'Colado');
            RESET ROLE;
            RAISE EXCEPTION 'FUGA: Beto agregó un jugador al partido de Ana';
        EXCEPTION
            WHEN insufficient_privilege THEN
                RESET ROLE;
                RAISE NOTICE 'OK 9 — match_players no acepta escrituras del cliente';
        END;
    END
$$;

-- Y las dos funciones SECURITY DEFINER que no miraban auth.uid() ya no existen. Si
-- la 027 rehace la feature, tiene que crear funciones nuevas con sus chequeos, no
-- revivir estas.
DO
$$
    DECLARE
        vivas TEXT;
    BEGIN
        SELECT string_agg(p.oid::REGPROCEDURE::TEXT, ', ') INTO vivas
        FROM pg_proc p
                 JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN ('add_multiple_players', 'remove_match_player');

        IF vivas IS NOT NULL THEN
            RAISE EXCEPTION 'FUGA: siguen existiendo las RPC sin autorización: %', vivas;
        END IF;
        RAISE NOTICE 'OK 9b — add_multiple_players y remove_match_player ya no existen';
    END
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- 10. Los resultados sólo se escriben por la RPC (migración 026)
-- ══════════════════════════════════════════════════════════════════════════
-- La policy de la 021 era FOR ALL con "sos el creador del partido", así que el
-- creador escribía directo y se salteaba todo lo que valida save_match_result: que
-- el partido haya empezado, que cada jugador de las stats haya jugado, el borrado de
-- los votos al corregir, el ELO una sola vez. Ana ES la creadora: antes esto pasaba.
DO
$$
    BEGIN
        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
        BEGIN
            INSERT INTO match_results (match_id, score_a, score_b, reported_by)
            VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 9, 0,
                    '11111111-1111-1111-1111-111111111111');
            RESET ROLE;
            RAISE EXCEPTION 'FUGA: la creadora escribió el resultado sin pasar por save_match_result';
        EXCEPTION
            WHEN insufficient_privilege THEN
                RESET ROLE;
                RAISE NOTICE 'OK 10 — match_results no acepta escrituras directas';
        END;
    END
$$;

DO
$$
    BEGIN
        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
        BEGIN
            INSERT INTO match_player_stats (match_id, user_id, display_name, outcome)
            VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                    '22222222-2222-2222-2222-222222222222', 'Beto', 'loss');
            RESET ROLE;
            RAISE EXCEPTION 'FUGA: la creadora le escribió una derrota a Beto a mano';
        EXCEPTION
            WHEN insufficient_privilege THEN
                RESET ROLE;
                RAISE NOTICE 'OK 10b — match_player_stats no acepta escrituras directas';
        END;
    END
$$;

-- Pero la lectura tiene que seguir andando: las dos tablas alimentan la pantalla de
-- resultado y las estadísticas del perfil.
DO
$$
    BEGIN
        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
        PERFORM COUNT(*) FROM match_results;
        PERFORM COUNT(*) FROM match_player_stats;
        RESET ROLE;
        RAISE NOTICE 'OK 10c — los resultados siguen siendo legibles';
    END
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- 11. join_requests: la policy de UPDATE apunta a quien corresponde (026)
-- ══════════════════════════════════════════════════════════════════════════
-- Usa la solicitud que creó el bloque 2c (Beto sobre el partido de Ana). Se la deja
-- rechazada, igual que si el creador la hubiera rechazado, para probar el re-pedido.
--
-- Esto ANTES fallaba en silencio: la única policy de UPDATE era la del creador, así
-- que el update del propio usuario afectaba 0 filas y .maybeSingle() devolvía null
-- sin error. Volver a pedir entrar después de un rechazo no funcionaba, aunque la
-- 022 le hubiera puesto un trigger para notificarlo.
DO
$$
    DECLARE
        afectadas INTEGER;
    BEGIN
        UPDATE join_requests
        SET status = 'rejected'
        WHERE match_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
          AND user_id = '22222222-2222-2222-2222-222222222222';

        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
        UPDATE join_requests
        SET status     = 'pending',
            updated_at = NOW()
        WHERE match_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
          AND user_id = '22222222-2222-2222-2222-222222222222';
        GET DIAGNOSTICS afectadas = ROW_COUNT;
        RESET ROLE;

        IF afectadas <> 1 THEN
            RAISE EXCEPTION 'ROTO: Beto no puede volver a pedir entrar (filas afectadas=%)', afectadas;
        END IF;
        RAISE NOTICE 'OK 11 — volver a pedir entrar después de un rechazo funciona';
    END
$$;

-- Pero no puede auto-aceptarse: el WITH CHECK exige status = 'pending' en la fila
-- nueva.
DO
$$
    BEGIN
        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
        BEGIN
            UPDATE join_requests
            SET status = 'accepted'
            WHERE match_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
              AND user_id = '22222222-2222-2222-2222-222222222222';
            RESET ROLE;
            RAISE EXCEPTION 'FUGA: Beto se aceptó su propia solicitud';
        EXCEPTION
            WHEN insufficient_privilege THEN
                RESET ROLE;
                RAISE NOTICE 'OK 11b — nadie se acepta su propia solicitud';
        END;
    END
$$;

-- Ni puede reasignársela a otra persona.
--
-- Se verifica el DATO y no las filas afectadas, porque el mecanismo cambió con la
-- 027 y la propiedad es la misma: antes el WITH CHECK de la policy rechazaba el
-- UPDATE, y ahora el trigger protect_join_request_identity le restaura el user_id
-- antes de que la policy lo mire. O sea que el UPDATE ahora "funciona" y no cambia
-- nada — un test que contara filas daría falso positivo de fuga.
DO
$$
    DECLARE
        v_dueño   UUID;
        v_de_ana  INTEGER;
    BEGIN
        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
        BEGIN
            UPDATE join_requests
            SET user_id = '11111111-1111-1111-1111-111111111111'
            WHERE match_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
              AND user_id = '22222222-2222-2222-2222-222222222222';
            RESET ROLE;
        EXCEPTION
            WHEN insufficient_privilege THEN
                RESET ROLE;
        END;

        SELECT user_id INTO v_dueño FROM join_requests
        WHERE match_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
          AND id = (SELECT id FROM join_requests
                    WHERE match_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
                      AND user_id IN ('11111111-1111-1111-1111-111111111111',
                                      '22222222-2222-2222-2222-222222222222')
                    LIMIT 1);

        SELECT COUNT(*) INTO v_de_ana FROM join_requests
        WHERE match_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
          AND user_id = '11111111-1111-1111-1111-111111111111';

        IF v_dueño <> '22222222-2222-2222-2222-222222222222' OR v_de_ana <> 0 THEN
            RAISE EXCEPTION 'FUGA: la solicitud cambió de dueño (dueño=%, filas de Ana=%)', v_dueño, v_de_ana;
        END IF;
        RAISE NOTICE 'OK 11c — una solicitud no se puede reasignar a otro usuario';
    END
$$;

-- Y el creador ya no tiene UPDATE directo: acepta y rechaza por las RPC, que son las
-- que validan estado, cupo y quién llama.
DO
$$
    DECLARE
        afectadas INTEGER;
    BEGIN
        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
        UPDATE join_requests
        SET status = 'accepted'
        WHERE match_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
          AND user_id = '22222222-2222-2222-2222-222222222222';
        GET DIAGNOSTICS afectadas = ROW_COUNT;
        RESET ROLE;

        IF afectadas <> 0 THEN
            RAISE EXCEPTION 'FUGA: la creadora cambió el estado por UPDATE directo (filas=%)', afectadas;
        END IF;
        RAISE NOTICE 'OK 11d — el creador no tiene UPDATE directo sobre las solicitudes';
    END
$$;

-- La otra mitad, que es la que importa para que la app siga andando: la RPC de
-- aceptar sigue funcionando para el creador.
DO
$$
    DECLARE
        v_request_id UUID;
        v_status     request_status;
    BEGIN
        SELECT id
        INTO v_request_id
        FROM join_requests
        WHERE match_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
          AND user_id = '22222222-2222-2222-2222-222222222222';

        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
        PERFORM accept_join_request(v_request_id);
        RESET ROLE;

        SELECT status INTO v_status FROM join_requests WHERE id = v_request_id;

        IF v_status <> 'accepted' THEN
            RAISE EXCEPTION 'ROTO: accept_join_request no aceptó la solicitud (quedó %)', v_status;
        END IF;
        RAISE NOTICE 'OK 11e — accept_join_request sigue funcionando para el creador';
    END
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- 12. Invitaciones: el consentimiento del invitado (migración 027)
-- ══════════════════════════════════════════════════════════════════════════
-- Es el arreglo del hallazgo A4. Antes el creador insertaba cualquier user_id en
-- match_participants: te metía en su partido sin preguntarte y desde ahí te
-- calificaba con 1 estrella y te cargaba derrotas que bajan el ELO de verdad.
--
-- La pieza que hace que el arreglo no sea decorativo es que el creador NO pueda
-- aceptar la invitación que él mismo mandó. Si pudiera, el atacante crea su
-- partido, invita a la víctima, aprueba su propia invitación, y estamos igual que
-- antes con dos pasos más.
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('44444444-4444-4444-4444-444444444444', 'caro@test.com', '{"full_name":"Caro"}');

-- ── Quién puede invitar ────────────────────────────────────────────────────
DO
$$
    DECLARE
        v_id UUID;
    BEGIN
        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
        INSERT INTO join_requests (match_id, user_id, invited_by)
        VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                '44444444-4444-4444-4444-444444444444',
                '11111111-1111-1111-1111-111111111111')
        RETURNING id INTO v_id;
        RESET ROLE;

        IF v_id IS NULL THEN
            RAISE EXCEPTION 'ROTO: la creadora no pudo invitar';
        END IF;
        RAISE NOTICE 'OK 12 — el creador puede invitar a un usuario registrado';
    END
$$;

-- Beto no es el creador del partido: no invita a nadie.
DO
$$
    BEGIN
        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
        BEGIN
            INSERT INTO join_requests (match_id, user_id, invited_by)
            VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                    '44444444-4444-4444-4444-444444444444',
                    '22222222-2222-2222-2222-222222222222');
            RESET ROLE;
            RAISE EXCEPTION 'FUGA: Beto invitó gente al partido de Ana';
        EXCEPTION
            WHEN insufficient_privilege OR unique_violation THEN
                RESET ROLE;
                RAISE NOTICE 'OK 12b — sólo el creador del partido invita';
        END;
    END
$$;

-- Ni se firma una invitación con el uid de otro.
DO
$$
    BEGIN
        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
        BEGIN
            INSERT INTO join_requests (match_id, user_id, invited_by)
            VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                    '44444444-4444-4444-4444-444444444444',
                    '22222222-2222-2222-2222-222222222222');
            RESET ROLE;
            RAISE EXCEPTION 'FUGA: Ana firmó una invitación como si la hubiera hecho Beto';
        EXCEPTION
            WHEN insufficient_privilege OR unique_violation THEN
                RESET ROLE;
                RAISE NOTICE 'OK 12c — la invitación va firmada por quien la manda';
        END;
    END
$$;

-- ── EL BLOQUE QUE IMPORTA: el creador no acepta su propia invitación ───────
DO
$$
    DECLARE
        v_id UUID;
    BEGIN
        SELECT id INTO v_id FROM join_requests
        WHERE match_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
          AND user_id = '44444444-4444-4444-4444-444444444444';

        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
        BEGIN
            PERFORM accept_join_request(v_id);
            RESET ROLE;
            RAISE EXCEPTION 'FUGA GRAVE: la creadora aceptó su propia invitación — A4 sigue abierto';
        EXCEPTION
            WHEN raise_exception THEN
                RESET ROLE;
                RAISE NOTICE 'OK 12d — el creador NO puede aceptar la invitación que mandó';
        END;
    END
$$;

-- Y un tercero tampoco: la invitación es de Caro.
DO
$$
    DECLARE
        v_id UUID;
    BEGIN
        SELECT id INTO v_id FROM join_requests
        WHERE match_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
          AND user_id = '44444444-4444-4444-4444-444444444444';

        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
        BEGIN
            PERFORM accept_match_invitation(v_id);
            RESET ROLE;
            RAISE EXCEPTION 'FUGA: Beto aceptó la invitación de Caro';
        EXCEPTION
            WHEN raise_exception THEN
                RESET ROLE;
                RAISE NOTICE 'OK 12e — la invitación la acepta sólo el invitado';
        END;
    END
$$;

-- Ni se puede convertir la invitación en solicitud para que la acepte el creador.
DO
$$
    DECLARE
        v_invited_by UUID;
    BEGIN
        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
        UPDATE join_requests
        SET invited_by = NULL
        WHERE match_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
          AND user_id = '44444444-4444-4444-4444-444444444444';
        RESET ROLE;

        SELECT invited_by INTO v_invited_by FROM join_requests
        WHERE match_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
          AND user_id = '44444444-4444-4444-4444-444444444444';

        IF v_invited_by IS NULL THEN
            RAISE EXCEPTION 'FUGA: se pudo borrar invited_by y volver la invitación una solicitud';
        END IF;
        RAISE NOTICE 'OK 12f — invited_by no se puede editar';
    END
$$;

-- ── La otra mitad: el invitado sí puede, y recién ahí entra al partido ─────
DO
$$
    DECLARE
        v_id           UUID;
        v_participante INTEGER;
        v_status       request_status;
    BEGIN
        SELECT id INTO v_id FROM join_requests
        WHERE match_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
          AND user_id = '44444444-4444-4444-4444-444444444444';

        -- Antes de aceptar NO está en el partido: es todo el punto de la migración.
        SELECT COUNT(*) INTO v_participante FROM match_participants
        WHERE match_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
          AND user_id = '44444444-4444-4444-4444-444444444444';
        IF v_participante <> 0 THEN
            RAISE EXCEPTION 'FUGA: Caro ya era participante sin haber aceptado nada';
        END IF;

        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
        PERFORM accept_match_invitation(v_id);
        RESET ROLE;

        SELECT COUNT(*) INTO v_participante FROM match_participants
        WHERE match_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
          AND user_id = '44444444-4444-4444-4444-444444444444';
        SELECT status INTO v_status FROM join_requests WHERE id = v_id;

        IF v_participante <> 1 OR v_status <> 'accepted' THEN
            RAISE EXCEPTION 'ROTO: aceptar la invitación no sumó a Caro (participante=%, status=%)', v_participante, v_status;
        END IF;
        RAISE NOTICE 'OK 12g — el invitado acepta y recién ahí entra al partido';
    END
$$;

-- ── La cerradura de verdad: el atajo por PostgREST ─────────────────────────
-- Todo lo anterior prueba el camino de la app. Esto prueba lo que la base permite,
-- que es lo único que un atacante respeta: sin la policy de la 027, un POST a
-- /rest/v1/match_participants saltea el flujo de invitación completo.
DO
$$
    BEGIN
        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
        BEGIN
            -- Ana ES la creadora del partido. Antes de la 027 esto pasaba, y era todo el
            -- hallazgo A4: con la víctima adentro se la calificaba con 1 estrella y se le
            -- cargaban derrotas que le bajan el ELO.
            INSERT INTO match_participants (match_id, user_id)
            VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333');
            RESET ROLE;
            RAISE EXCEPTION 'FUGA GRAVE: la creadora metió a un usuario registrado sin invitación — A4 sigue abierto';
        EXCEPTION
            WHEN insufficient_privilege THEN
                RESET ROLE;
                RAISE NOTICE 'OK 12i — no se puede meter a un registrado salteando la invitación';
        END;
    END
$$;

-- Pero las dos excepciones legítimas siguen andando, o se rompe crear un partido.
DO
$$
    DECLARE
        v_match_id UUID := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
        v_invitados INTEGER;
        v_yo        INTEGER;
    BEGIN
        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

        INSERT INTO matches (id, creator_id, sport, title, starts_at, venue_name, total_players, players_needed)
        VALUES (v_match_id, '22222222-2222-2222-2222-222222222222',
                'tenis', 'Partido de Beto', NOW() + INTERVAL '2 days', 'Cancha 2', 4, 4);

        -- El creador sumándose a sí mismo: es lo primero que hace Create.tsx.
        INSERT INTO match_participants (match_id, user_id)
        VALUES (v_match_id, '22222222-2222-2222-2222-222222222222');

        -- Y un invitado sin cuenta, que es para lo que existe la excepción.
        INSERT INTO match_participants (match_id, guest_name)
        VALUES (v_match_id, 'Primo de Beto');
        RESET ROLE;

        SELECT COUNT(*) INTO v_yo FROM match_participants
        WHERE match_id = v_match_id AND user_id = '22222222-2222-2222-2222-222222222222';
        SELECT COUNT(*) INTO v_invitados FROM match_participants
        WHERE match_id = v_match_id AND guest_name = 'Primo de Beto';

        IF v_yo <> 1 OR v_invitados <> 1 THEN
            RAISE EXCEPTION 'ROTO: crear un partido dejó de funcionar (creador=%, invitado=%)', v_yo, v_invitados;
        END IF;
        RAISE NOTICE 'OK 12j — el creador sigue pudiendo sumarse y agregar invitados sin cuenta';
    END
$$;

-- Y el creador se enteró: invitó y le contestaron.
DO
$$
    DECLARE
        v_avisos INTEGER;
    BEGIN
        SELECT COUNT(*) INTO v_avisos FROM notifications
        WHERE user_id = '11111111-1111-1111-1111-111111111111'
          AND type = 'match_invitation'
          AND title = 'Aceptaron tu invitación ✅';

        IF v_avisos < 1 THEN
            RAISE EXCEPTION 'ROTO: al creador no le llegó el aviso de que aceptaron';
        END IF;
        RAISE NOTICE 'OK 12h — al creador le avisan que aceptaron la invitación';
    END
$$;

ROLLBACK;
