-- =====================================================
-- Rol de sólo lectura para inspeccionar la base hosteada
-- =====================================================
--
-- Correr UNA vez en el editor SQL del proyecto. Crea un rol que puede mirar y
-- nada más, para poder auditar producción sin riesgo de tocarla.
--
-- ANTES DE PEGARLO: reemplazá el placeholder de la contraseña, pero hacelo EN EL
-- EDITOR DE SUPABASE, no en este archivo. Esta carpeta es parte del repo: una
-- contraseña escrita acá se va al historial de git en el próximo `git add .`, y
-- de ahí no se borra con un commit, hay que reescribir la historia.
--
-- El flujo sano es: generás una al azar, la pegás en el editor junto con el resto
-- del script, y la guardás en la variable de entorno SUPABASE_RO_URL. El archivo
-- queda siempre con el placeholder.
--
-- Que sea aleatoria y única, no una que uses en otro lado: este rol vive en una
-- base de producción con datos de usuarios reales.
--
-- Por qué un rol de la base y no un flag de alguna herramienta: acá el límite lo
-- pone Postgres. No hay comando, ni error, ni descuido que escriba algo — el motor
-- lo rechaza. Un "modo lectura" implementado en el cliente es una promesa; esto es
-- una pared.
-- =====================================================

-- ── 1. El rol ──────────────────────────────────────────────────────────────
-- NOINHERIT para que no absorba privilegios si alguna vez alguien lo mete en un
-- grupo por error.
CREATE ROLE claude_ro WITH
    LOGIN
    PASSWORD 'PEGAR-ACA-EN-EL-EDITOR-DE-SUPABASE-NO-EN-EL-ARCHIVO'
    NOSUPERUSER
    NOCREATEDB
    NOCREATEROLE
    NOINHERIT
    NOREPLICATION
    NOBYPASSRLS;

-- ── 2. Segunda cerradura: transacciones de sólo lectura ────────────────────
-- Redundante con no tener privilegios de escritura, y a propósito. Si mañana
-- alguien le da un GRANT INSERT sin pensarlo, esto lo sigue frenando: el INSERT
-- falla con "cannot execute INSERT in a read-only transaction".
ALTER ROLE claude_ro SET default_transaction_read_only = on;

-- ── 3. Que no pueda tumbar producción con una consulta pesada ──────────────
-- Sin esto, un SELECT sin índice sobre una tabla grande se come una conexión y
-- compite con la app. 30 segundos alcanza de sobra para cualquier auditoría.
ALTER ROLE claude_ro SET statement_timeout = '30s';
ALTER ROLE claude_ro SET idle_in_transaction_session_timeout = '60s';

-- ── 4. Lectura del esquema público ─────────────────────────────────────────
GRANT CONNECT ON DATABASE postgres TO claude_ro;
GRANT USAGE ON SCHEMA public TO claude_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO claude_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO claude_ro;


-- =====================================================
-- OJO CON ESTO: RLS también le aplica
-- =====================================================
--
-- claude_ro no es dueño de las tablas ni tiene BYPASSRLS, así que RLS lo filtra
-- como a cualquiera. Y como las policies de la migración 025 son todas
-- `TO authenticated`, este rol no matchea ninguna: los SELECT sobre profiles,
-- matches o notifications devuelven CERO FILAS.
--
-- No es un error, es la configuración pedida: alcanza para auditar estructura
-- (policies, privilegios, funciones, constraints, índices — todo eso vive en los
-- catálogos, que se leen igual) pero no expone los datos personales de nadie.
--
-- El riesgo real es confundir "RLS me lo ocultó" con "la tabla está vacía". Son
-- indistinguibles desde el resultado. Para saber cuál de las dos es:
--
--   SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'profiles';
--
-- Si hace falta ver datos de verdad para alguna tarea puntual, se habilita y se
-- vuelve a cerrar al terminar:
--
--   ALTER ROLE claude_ro BYPASSRLS;      -- ahora sí ve todo, mails incluidos
--   ALTER ROLE claude_ro NOBYPASSRLS;    -- volver a cerrarlo
--
-- Mejor dejarlo apagado por defecto y prenderlo a demanda que al revés.


-- =====================================================
-- Para dar de baja el acceso
-- =====================================================
--
-- Cuando no lo necesites más, o si la contraseña se filtra:
--
--   REASSIGN OWNED BY claude_ro TO postgres;   -- no debería tener nada, por las dudas
--   DROP OWNED BY claude_ro;                   -- borra sus privilegios
--   DROP ROLE claude_ro;
--
-- Y para sólo cambiar la contraseña:
--
--   ALTER ROLE claude_ro WITH PASSWORD 'la-nueva';
