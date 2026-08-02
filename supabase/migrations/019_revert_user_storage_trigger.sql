-- Revierte la migración 018.
--
-- La 018 agregaba un trigger BEFORE DELETE sobre auth.users que hacía
-- DELETE FROM storage.objects para destrabar el borrado de usuarios.
--
-- No puede funcionar: Supabase protege esas tablas con su propio trigger,
-- storage.protect_delete(), que aborta cualquier borrado directo:
--
--   ERROR: 42501: Direct deletion from storage tables is not allowed.
--          Use the Storage API instead.
--
-- Peor todavía: al dispararse dentro del borrado del usuario, esa excepción
-- abortaba toda la transacción. O sea que la 018 no sólo no ayudaba, sino que
-- garantizaba el fallo.
--
-- Los archivos hay que borrarlos por la Storage API, que es la única que
-- mantiene consistentes la fila y el objeto en el bucket:
--   - Dashboard: Storage → avatars → seleccionar → Delete
--   - Cliente:   supabase.storage.from('avatars').remove([paths])
--                (ya implementado en services/storage.service.ts → deleteAvatar)
--
-- Conclusión: la limpieza de avatares no puede vivir en la base. Si más adelante
-- se agrega "eliminar mi cuenta" en la app, el orden correcto es borrar el avatar
-- con deleteAvatar() y recién después la cuenta.

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
DROP FUNCTION IF EXISTS public.handle_user_delete();
