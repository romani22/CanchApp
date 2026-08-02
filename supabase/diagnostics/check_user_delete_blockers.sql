-- ¿Por qué no se puede borrar un usuario?
--
-- El dashboard (Auth → Users) borra vía la API de GoTrue, que ante un fallo de
-- base devuelve un error vacío: "Failed to delete user: {}". Borrar por SQL
-- muestra el error real de Postgres, que es el que sirve.
--
-- Correr los bloques DE A UNO y mirar el resultado de cada uno.

-- ── 1. ¿Quedó creado el trigger de la migración 018? ────────────────────────
-- Debe devolver una fila: on_auth_user_deleted.
SELECT tgname AS trigger_name,
       tgenabled AS habilitado
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass
  AND NOT tgisinternal;


-- ── 2. TODAS las FKs que bloquean un borrado en cascada ─────────────────────
-- Esta es la consulta definitiva: recorre el esquema entero, no sólo profiles.
-- Cualquier fila que aparezca acá es un bloqueo potencial.
SELECT con.conname                  AS constraint_name,
       src_ns.nspname || '.' || src.relname AS tabla_que_bloquea,
       tgt_ns.nspname || '.' || tgt.relname AS apunta_a,
       CASE con.confdeltype
           WHEN 'a' THEN 'NO ACTION — BLOQUEA'
           WHEN 'r' THEN 'RESTRICT — BLOQUEA'
           END                      AS al_borrar
FROM pg_constraint con
         JOIN pg_class src ON src.oid = con.conrelid
         JOIN pg_namespace src_ns ON src_ns.oid = src.relnamespace
         JOIN pg_class tgt ON tgt.oid = con.confrelid
         JOIN pg_namespace tgt_ns ON tgt_ns.oid = tgt.relnamespace
WHERE con.contype = 'f'
  AND con.confdeltype IN ('a', 'r')
  AND (tgt_ns.nspname, tgt.relname) IN (('auth', 'users'), ('public', 'profiles'))
ORDER BY src_ns.nspname, src.relname;


-- ── 3. ¿Quedan archivos en Storage de esos usuarios? ────────────────────────
SELECT bucket_id, name, owner
FROM storage.objects;


-- ── 4. El borrado real, con el error de verdad ──────────────────────────────
-- Correr de a un usuario. Si falla, Postgres dice exactamente qué constraint
-- y qué tabla lo impiden — a diferencia del {} del dashboard.
-- Descomentar el que corresponda:

-- DELETE FROM auth.users WHERE id = '830a1083-233a-49d2-863f-1f26e89ed924';
-- DELETE FROM auth.users WHERE id = '5ab44d0f-49ac-402e-a6d2-ef2c0ce4730d';
