-- Limpieza de archivos al borrar un usuario.
--
-- Problema: storage.objects.owner referencia auth.users, y esa foreign key no
-- cascadea. Si el usuario subió un avatar, borrarlo desde Auth → Users falla con
-- un error de clave foránea. Las 15 FKs propias del esquema sí cascadean; la de
-- Storage es del esquema gestionado por Supabase y no se puede alterar desde acá.
--
-- Solución: un trigger BEFORE DELETE sobre auth.users que borra sus objetos
-- primero. Mismo enfoque que el on_auth_user_created de 001_initial_schema.sql,
-- que ya crea el profile desde un trigger sobre esa tabla.

CREATE OR REPLACE FUNCTION public.handle_user_delete()
    RETURNS TRIGGER
    -- SECURITY DEFINER: el rol que borra el usuario no tiene permiso sobre
    -- storage.objects; la función corre con los privilegios de su dueño.
    SECURITY DEFINER
    SET search_path = public, storage
AS
$$
BEGIN
    -- owner (UUID) existe en todas las versiones de Storage.
    DELETE FROM storage.objects WHERE owner = OLD.id;

    -- owner_id (TEXT) lo agregaron versiones más nuevas. Se consulta por SQL
    -- dinámico porque plpgsql valida los nombres de columna recién al ejecutar:
    -- referenciarla directo haría fallar el trigger en proyectos que no la tienen.
    IF EXISTS (SELECT 1
               FROM information_schema.columns
               WHERE table_schema = 'storage'
                 AND table_name = 'objects'
                 AND column_name = 'owner_id') THEN
        EXECUTE 'DELETE FROM storage.objects WHERE owner_id = $1' USING OLD.id::text;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;

CREATE TRIGGER on_auth_user_deleted
    BEFORE DELETE
    ON auth.users
    FOR EACH ROW
EXECUTE FUNCTION public.handle_user_delete();
