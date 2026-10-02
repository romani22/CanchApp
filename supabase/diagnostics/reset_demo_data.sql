-- ⚠️  DESTRUCTIVO — BORRA TODOS LOS DATOS Y TODAS LAS CUENTAS  ⚠️
--
-- Deja la base vacía para arrancar una demo desde cero. No borra el esquema:
-- tablas, funciones, triggers, políticas RLS y buckets quedan intactos.
--
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │  PASO 0 — HACER ESTO PRIMERO, A MANO, FUERA DEL SQL EDITOR              │
-- │                                                                         │
-- │  Dashboard → Storage → bucket "avatars" → seleccionar todo → Delete     │
-- │                                                                         │
-- │  No se puede hacer por SQL. Supabase protege esas tablas con el trigger │
-- │  storage.protect_delete():                                              │
-- │                                                                         │
-- │    ERROR: 42501: Direct deletion from storage tables is not allowed.    │
-- │           Use the Storage API instead.                                  │
-- │                                                                         │
-- │  Si te salteás este paso, el PASO 3 falla: storage.objects.owner        │
-- │  referencia auth.users con una FK que no cascadea.                      │
-- └─────────────────────────────────────────────────────────────────────────┘


-- ── PASO 1: vaciar los datos de la app ──────────────────────────────────────
-- Sólo profiles, a propósito: toda tabla con datos de usuario cuelga de ella por
-- FK, y CASCADE las vacía a todas, incluidas las que se agreguen después. La lista
-- explícita que había acá se quedó sin las tablas de la 023 y la 024, y nombrar
-- una tabla que ya no existe hace fallar el TRUNCATE entero.
-- TRUNCATE no dispara los triggers por fila: un DELETE en cascada correría los
-- de recálculo de cupos y estadísticas sobre filas que se están borrando.
-- profiles la recrea el trigger handle_new_user() en el próximo registro.
TRUNCATE TABLE public.profiles RESTART IDENTITY CASCADE;


-- ── PASO 2: comprobar que el bucket quedó vacío ─────────────────────────────
-- Tiene que devolver 0. Si devuelve más, volvé al PASO 0: el PASO 3 va a fallar.
SELECT count(*) AS archivos_pendientes
FROM storage.objects;


-- ── PASO 3: borrar las cuentas ──────────────────────────────────────────────
-- Cascadea a auth.identities, auth.sessions y demás tablas internas de GoTrue.
DELETE
FROM auth.users;


-- ── VERIFICACIÓN: todo debe dar 0 ───────────────────────────────────────────
SELECT (SELECT count(*) FROM auth.users)           AS usuarios,
       (SELECT count(*) FROM public.profiles)      AS perfiles,
       (SELECT count(*) FROM public.matches)       AS partidos,
       (SELECT count(*) FROM storage.objects)      AS archivos,
       (SELECT count(*) FROM public.notifications) AS notificaciones,
       (SELECT count(*) FROM public.push_tokens)   AS tokens,
       (SELECT count(*) FROM public.match_results) AS resultados;
