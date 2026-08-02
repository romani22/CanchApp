-- Niveles por deporte.
--
-- Contexto: profiles tenía un único skill_level. Si un usuario juega fútbol y pádel,
-- ese valor no dice a cuál de los dos hace referencia. Se reemplaza por un mapa
-- deporte -> nivel.
--
-- De paso se elimina favorite_sports: las claves de sport_levels ya son los deportes
-- que juega el usuario, así que mantener las dos columnas era duplicar la fuente de
-- verdad y arriesgarse a que divergieran.
--
-- Esta migración es re-ejecutable: cada paso está guardado para poder correrla de
-- nuevo sobre una base donde ya se aplicó parcialmente.

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS sport_levels JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Backfill: cada deporte favorito hereda el skill_level global que había.
-- Es la mejor aproximación disponible; el usuario puede afinarlo después.
--
-- Va dentro de un DO porque más abajo se borra favorite_sports: sin este guard,
-- una segunda corrida fallaría con "column favorite_sports does not exist".
DO
$$
    BEGIN
        IF EXISTS (SELECT 1
                   FROM information_schema.columns
                   WHERE table_schema = 'public'
                     AND table_name = 'profiles'
                     AND column_name = 'favorite_sports') THEN
            EXECUTE $backfill$
            UPDATE profiles
            SET sport_levels = (SELECT COALESCE(
                                               jsonb_object_agg(sport, COALESCE(skill_level::text, 'intermedio')),
                                               '{}'::jsonb)
                                FROM unnest(favorite_sports) AS sport)
            WHERE COALESCE(array_length(favorite_sports, 1), 0) > 0
            $backfill$;
        END IF;
    END
$$;

-- Validación de claves y valores.
--
-- Un CHECK no puede contener subqueries (ERROR 0A000), y recorrer un JSONB exige
-- una: jsonb_each_text() es una función de conjunto. La salida estándar es meter la
-- lógica en una función IMMUTABLE — la restricción aplica a la expresión del CHECK,
-- no al cuerpo de lo que esa expresión invoque.
CREATE OR REPLACE FUNCTION public.sport_levels_are_valid(levels jsonb)
    RETURNS boolean
    LANGUAGE sql
    IMMUTABLE
    PARALLEL SAFE
    SET search_path = pg_catalog, public
AS
$$
SELECT jsonb_typeof(levels) = 'object'
    -- jsonb_each_text() sobre un no-objeto lanza excepción, de ahí el guard previo.
    -- Sobre '{}' no devuelve filas, así que un mapa vacío es válido.
    AND NOT EXISTS (SELECT 1
                    FROM jsonb_each_text(levels) AS entry(sport, level)
                    WHERE entry.sport NOT IN ('futbol', 'padel', 'tenis', 'basquet', 'voley')
                       OR entry.level NOT IN ('principiante', 'intermedio', 'avanzado'));
$$;

ALTER TABLE profiles
    DROP CONSTRAINT IF EXISTS profiles_sport_levels_valid;

ALTER TABLE profiles
    ADD CONSTRAINT profiles_sport_levels_valid CHECK (public.sport_levels_are_valid(sport_levels));

-- Índice GIN (jsonb_ops): soporta los operadores ? (existe la clave) y @> (contención),
-- para consultas tipo "jugadores de pádel" o "avanzados en pádel".
--
-- Nota: listBySport() en el cliente filtra con `sport_levels->padel is not null`, que
-- PostgREST sí sabe expresar pero NO usa este índice (es un seq scan). Con el volumen
-- actual de profiles no importa; si llega a pesar, el camino es una función RPC que
-- use `sport_levels ? 'padel'` y aproveche el índice.
CREATE INDEX IF NOT EXISTS idx_profiles_sport_levels ON profiles USING GIN (sport_levels);

-- La vista user_stats (002_matches_and_stats.sql) sólo referencia p.id,
-- así que no hace falta recrearla antes de borrar las columnas.
ALTER TABLE profiles
    DROP COLUMN IF EXISTS favorite_sports;

ALTER TABLE profiles
    DROP COLUMN IF EXISTS skill_level;
