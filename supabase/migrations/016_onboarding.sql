-- Onboarding: marca si el usuario ya completó la carga inicial de su perfil.
--
-- Contexto: handle_new_user() sólo inserta id/email/full_name/avatar_url. El resto
-- de las columnas caía a sus defaults, así que un alta por Google terminaba con
-- favorite_sports = '{}', zone = NULL y skill_level = 'intermedio' sin que el
-- usuario hubiese elegido nada. El registro por email lo compensaba a mano; el de
-- Google no. Esta bandera permite interceptar ambos caminos en un solo lugar.

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;

-- Backfill: los perfiles que ya tienen deportes cargados vienen del registro por
-- email, que sí pedía deportes/nivel/zona. No los mandamos al onboarding.
UPDATE profiles
SET onboarding_completed = true
WHERE COALESCE(array_length(favorite_sports, 1), 0) > 0;

-- Trigger de alta actualizado.
--
-- Dos arreglos respecto de la versión de 001_initial_schema.sql:
--   1. Google OIDC manda los claims como 'name' y 'picture'. La versión anterior
--      sólo miraba 'full_name' y 'avatar_url', así que según el proveedor el
--      nombre caía al fallback del email y la foto quedaba NULL.
--   2. COALESCE no filtra strings vacíos. Con NULLIF, un full_name = '' ahora
--      cae al siguiente candidato en vez de guardarse vacío.
CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER
    SET search_path = public
AS
$$
BEGIN
    INSERT INTO public.profiles (id,
                                 email,
                                 full_name,
                                 avatar_url,
                                 onboarding_completed)
    VALUES (NEW.id,
            COALESCE(NEW.email, 'no-email'),
            COALESCE(
                    NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
                    NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
                    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
                    'Usuario'
            ),
            COALESCE(
                    NULLIF(NEW.raw_user_meta_data ->> 'avatar_url', ''),
                    NULLIF(NEW.raw_user_meta_data ->> 'picture', '')
            ),
            false);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
