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
-- CASCADE se encarga del orden entre estas tablas. profiles va incluida: la
-- recrea el trigger handle_new_user() en el próximo registro.
TRUNCATE TABLE public.match_ratings,
    public.match_players,
    public.match_participants,
    public.match_scores,
    public.join_requests,
    public.notifications,
    public.push_tokens,
    public.matches,
    public.team_members,
    public.teams,
    public.tournaments,
    public.profiles
    RESTART IDENTITY CASCADE;


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
       (SELECT count(*) FROM public.notifications) AS notificaciones;
