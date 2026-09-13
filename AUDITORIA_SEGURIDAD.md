# Auditoría de seguridad — CanchApp

Fecha: 2026-08-08 · Rama: `Desarrollo` · Commit base: `0e9fc32`

## Alcance

Se revisó todo lo que es auditable desde el repo:

- Las 25 migraciones de `supabase/migrations/` (RLS, GRANTs, funciones `SECURITY DEFINER`, triggers, vistas).
- La Edge Function `send-push-notification`.
- `supabase/config.toml` (configuración de auth).
- Todo el cliente: `app/`, `context/`, `services/`, `repositories/`, `hooks/`, `lib/`.
- Manejo de secretos, `.gitignore`, historial de git, `app.json`, `eas.json`, `google-services.json`, el `AndroidManifest.xml` generado.
- Dependencias (`npm audit`).

**Modelo de amenaza asumido** (el mismo que documenta la migración 025, y es el correcto): la anon key viaja dentro del APK. Cualquiera la extrae y le habla directo a PostgREST, a `/auth/v1` y a las Edge Functions con `curl`. Toda validación que sólo viva en el cliente es decorativa. El perímetro real son las policies, los GRANTs y los chequeos dentro de las funciones.

## Resumen

La migración 025 cerró bien los agujeros más grandes (perfiles legibles sin login, push falsos por inserción directa en `notifications`, superficie de RPC abierta a `PUBLIC`, privilegios heredados del ambiente). El trabajo está bien hecho y el smoke test de `supabase/diagnostics/` es la infraestructura correcta para sostenerlo.

Lo que queda son **cinco caminos que reabren, por la puerta de al lado, justo lo que 025 cerró**, más un grupo de problemas de integridad de datos y de higiene del cliente.

## Estado

| Hallazgo | Estado |
|---|---|
| A1 | ✅ Corregido y **verificado en producción**: secreto de webhook + relectura de la fila. Camino completo probado end-to-end. |
| A2, A3, A5, M2, M3 | ✅ Corregidos en `026_close_write_paths.sql`, **aplicada en la base hosteada** y confirmada con `verify_026.sql` (15/15 OK). |
| A6 | ✅ Corregido y **en la calle** (build del 2026-08-13): se fue el `.or()` interpolado y el mail dejó de buscarse por subcadena. |
| M9 | ✅ Corregido en `app.json` (`blockedPermissions`) y buildeado. Falta confirmarlo con `adb shell dumpsys package com.romani22.canchapp \| findstr permission` — el manifest es generado, así que sólo vale si el build corrió `prebuild`. |
| A4 | ✅ Corregido en `027_match_invitations.sql`: invitación + consentimiento del invitado. **Falta aplicar la migración en la base hosteada y hacer un build nuevo** (el cambio es de base y de cliente). |
| M6 | ✅ Corregido: el login con huella ya no guarda la contraseña, guarda el refresh token. Incluye el borrado de las credenciales viejas del dispositivo. **Falta el build.** |
| M8 | ✅ Corregido en `config.toml` y **verificado contra la API local**. **Falta replicarlo en el Dashboard**, que es donde se aplica de verdad — y la confirmación de mail necesita SMTP propio. |
| M5 | ⚠️ Parcial: `allowBackup: false` en `app.json` (falta el build). Queda pendiente mover la sesión de AsyncStorage a SecureStore. |
| M1, M4, M7, M10, B1-B9 | Abiertos. |

Todo lo cerrado está validado contra la base local (2026-09-13): `supabase db reset` reaplica las 29 migraciones sin error, `smoke_rls_security.sql` da 56/56, los cuatro verificadores dan 13/13, 15/15, 13/13 y 11/11, `tsc` limpio, `eslint` limpio y **315 tests** del cliente en verde.

| # | Severidad | Hallazgo |
|---|-----------|----------|
| A1 | ~~**Alta**~~ ✅ | ~~La Edge Function de push confía en el body del request: push arbitrario a cualquier usuario~~ |
| A2 | ~~**Alta**~~ ✅ | ~~`add_multiple_players` y `remove_match_player`: `SECURITY DEFINER` sin ningún chequeo de autorización~~ |
| A3 | ~~**Alta**~~ ✅ | ~~RLS de `match_players` permite agregar jugadores a partidos ajenos → push con texto controlado~~ |
| A4 | ~~**Alta**~~ ✅ | ~~Cualquiera puede destruir el rating y el ELO de cualquier usuario con partidos fabricados~~ |
| A5 | ~~**Alta**~~ ✅ | ~~`elo_rating` quedó fuera del trigger de columnas derivadas: es auto-editable~~ |
| A6 | ~~**Media-alta**~~ ✅ | ~~Inyección de filtros PostgREST en el buscador de jugadores~~ |
| M1 | Media | Mail, teléfono y coordenadas de todos los usuarios legibles por cualquier usuario logueado |
| M2 | ~~Media~~ ✅ | ~~`join_requests` UPDATE sin fijar `user_id`: solicitudes reasignables a terceros~~ |
| M3 | ~~Media~~ ✅ | ~~`match_results` / `match_player_stats` escribibles directo, salteando los guards de la RPC~~ |
| M4 | Media | Spam/phishing masivo vía notificación de "partido cercano" |
| M5 | Media | Sesión de Supabase en AsyncStorage + `allowBackup="true"` |
| M6 | Media | El login biométrico guarda la contraseña en claro |
| M7 | Media | Deep link `canchapp://` sin verificar + `exp://*/*` en los redirect permitidos |
| M8 | Media | Auth sin confirmación de mail, contraseña mínima de 6, sin captcha |
| M9 | ~~Media~~ ✅ | ~~Permisos Android de más: micrófono y "dibujar sobre otras apps"~~ |
| M10 | Media | La API de push de Expo no pide autenticación: con un token de dispositivo se le manda push a ese teléfono |
| B1-B9 | Baja | Higiene (ver al final) |

---

## A1 — La Edge Function de push confía en el body del request ✅ CORREGIDO

> **Estado:** arreglado en el repo. Se agregó el secreto compartido `x-webhook-secret`
> (comparado en tiempo constante) y la función ahora usa **sólo `record.id`** del body:
> el resto lo relee de la tabla. `verify_jwt = true` quedó explícito en `config.toml`.
> **Falta el despliegue**, que tiene un orden obligatorio para no cortar el push:
> `supabase/functions/send-push-notification/README.md`. Ahí está también el `curl`
> que tiene que devolver 401 para confirmar que quedó cerrado.

**Dónde:** `supabase/functions/send-push-notification/index.ts:24-82`

La función toma `payload.record` del body y usa `user_id`, `title`, `body` y `data` **tal como vienen**. Lo único que valida es que exista `record.id`; nunca verifica que esa notificación exista de verdad en la tabla.

```ts
const payload = await req.json()
const notification = payload.record
if (!notification?.id) return new Response('Missing notification record', { status: 400 })
// ...
const messages = tokens.map((t) => ({ to: t.token, title: notification.title, body: notification.body, ... }))
```

**Explotación:** un POST a `https://<proyecto>.supabase.co/functions/v1/send-push-notification` con `Authorization: Bearer <anon key>` (la del APK) y

```json
{"record":{"id":"cualquier-uuid","user_id":"<uuid de la víctima>","type":"match_cancelled","title":"CanchApp","body":"Tu cuenta fue suspendida, verificá acá: …"}}
```

manda un push real, con el ícono y el nombre de la app, a cualquier usuario. Los `user_id` se consiguen del buscador de jugadores (A6/M1). El `verify_jwt` por defecto no ayuda: la anon key **es** un JWT válido, así que no es una frontera de autenticación.

Esto es exactamente el agujero que el bloque 1 de la migración 025 cerró en la tabla `notifications`, pero un paso más adelante en la cadena.

**Arreglo:**

1. Que el webhook mande un header secreto (`x-webhook-secret`) y que la función lo compare contra un `Deno.env.get()` en tiempo constante; rechazar con 401 si no coincide.
2. Aunque esté el secreto: **no confiar en el body**. Usar sólo `record.id` y re-leer la fila con el cliente de `service_role`:
   ```ts
   const { data: notification } = await supabase.from('notifications')
     .select('id, user_id, type, title, body, data').eq('id', payload.record.id).single()
   ```
   Así el texto del push sólo puede venir de la tabla, y la tabla ya está cerrada a inserciones de clientes.
3. Confirmar en el Dashboard que la función tiene `verify_jwt` activo (defensa en profundidad, no la principal).

---

## A2 — `add_multiple_players` y `remove_match_player` no chequean nada ✅ CORREGIDO (026)

> **Estado:** resuelto de otra forma que la propuesta acá abajo, y por una razón que apareció al ir a arreglarlo: la feature está **muerta y además rota**. `AddPlayersForm` sólo se renderiza en la ruta `match/add-payers`, a la que ninguna pantalla navega; `useMatchPlayers` y `PlayersList` no se usan en ningún lado. Y `add_multiple_players` no podía ejecutarse ni con permisos: declara una variable `total_players` que también es columna de `matches` y la referencia sin calificar, así que Postgres corta con `column reference "total_players" is ambiguous`.
>
> Así que en vez de agregarles los guards, la 026 **borra las dos funciones**. Una función que no existe no depende de que nadie acierte su GRANT. La tabla y sus filas quedan intactas, y la `027` va a crear las funciones nuevas para el flujo real (propuesta de un tercero + aprobación del creador).

**Dónde:** `supabase/migrations/013_notifications_and_players_system.sql:126-247`, con `GRANT EXECUTE … TO authenticated` en `025_security_hardening.sql:300-301`

Las dos son `SECURITY DEFINER` (corren como `postgres`, saltean RLS) y **ninguna mira `auth.uid()`**:

- `add_multiple_players(p_match_id, p_added_by_user_id, p_players)` acepta cualquier `p_match_id` y cualquier `p_added_by_user_id`. No verifica que quien llama sea el creador del partido, ni que `p_added_by_user_id = auth.uid()`.
- `remove_match_player(p_player_id)` borra cualquier fila de `match_players`, de cualquier partido, y recalcula `matches.current_players`.

**Explotación** (cualquier usuario logueado, con la anon key):

- Llenar el partido de otro con jugadores inventados hasta `total_players` → nadie más puede entrar (DoS del partido ajeno).
- Vaciar los jugadores de cualquier partido, uno por uno.
- Falsificar `added_by_user_id` para que la fila diga que la agregó otra persona.
- Disparar el trigger `notify_user_on_player_added` con `user_id` de una víctima: le llega el push *"«NOMBRE» te agregó a «TÍTULO»"*, donde `NOMBRE` es el `full_name` del atacante (editable a gusto) y `TÍTULO` el de un partido que él creó. Texto de push arbitrario, otra vez.

Estas dos son las únicas de las nueve RPC expuestas que no validan al llamador; `accept_join_request`, `reject_join_request`, `save_match_result`, `delete_match_result`, `vote_match_result` y `clear_match_result_vote` sí lo hacen y están bien.

**Arreglo:** al principio de cada una,

```sql
-- add_multiple_players
IF p_added_by_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'No podés agregar jugadores en nombre de otra persona';
END IF;
IF NOT EXISTS (SELECT 1 FROM matches WHERE id = p_match_id AND creator_id = auth.uid()) THEN
    RAISE EXCEPTION 'Sólo el creador del partido puede agregar jugadores';
END IF;

-- remove_match_player: el que lo agregó, o el creador del partido
IF NOT EXISTS (SELECT 1 FROM match_players mp JOIN matches m ON m.id = mp.match_id
               WHERE mp.id = p_player_id
                 AND (mp.added_by_user_id = auth.uid() OR m.creator_id = auth.uid())) THEN
    RAISE EXCEPTION 'No podés sacar a este jugador';
END IF;
```

Y agregarles `SET search_path = public` explícito (hoy lo tienen porque el bloque 6 de 025 lo aplica desde el catálogo, pero conviene que quede en el fuente).

---

## A3 — La policy de `match_players` no exige ser el creador del partido ✅ CORREGIDO (026)

> **Estado:** la 026 aplica la policy de acá abajo **y además** revoca `INSERT`/`UPDATE`/`DELETE` del rol `authenticated`, dejando la tabla de sólo lectura hasta que la `027` la abra a propósito. Las dos cerraduras, como en la 025: sin GRANT no entra, y si alguien repone el GRANT sin pensarlo, la policy sigue exigiendo ser el creador.

**Dónde:** `supabase/migrations/013_notifications_and_players_system.sql:41-44`

```sql
CREATE POLICY "Authenticated users can add players"
  ON match_players FOR INSERT
  WITH CHECK (auth.uid() = added_by_user_id);
```

Lo único que pide es que la fila diga que la agregó quien la agrega. **No pide nada sobre `match_id`.** Con `GRANT SELECT, INSERT, DELETE ON public.match_players TO authenticated` (025:343), un INSERT directo a `/rest/v1/match_players` con cualquier `match_id` y cualquier `user_id` pasa.

Es el mismo abuso que A2 pero **sin pasar por la RPC**: arreglar sólo la función deja este camino abierto. Y como el trigger `update_match_players_count` es `SECURITY DEFINER`, el INSERT también incrementa `matches.current_players` del partido ajeno.

**Arreglo:**

```sql
DROP POLICY IF EXISTS "Authenticated users can add players" ON match_players;
CREATE POLICY "Match creators can add players"
    ON match_players FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = added_by_user_id
        AND auth.uid() IN (SELECT creator_id FROM matches WHERE id = match_id)
    );
```

Y acotar con `TO authenticated` las policies de SELECT/DELETE de esta tabla, que hoy no lo tienen.

---

## A4 — Se puede destruir el rating y el ELO de cualquier usuario ✅ CORREGIDO (027)

> **Estado:** implementado con el criterio decidido. El creador ya no suma usuarios registrados: los **invita**, y entran cuando aceptan. Los invitados sin cuenta siguen entrando directo — no tienen perfil, rating ni ELO que se pueda tocar.
>
> La pieza que hace que no sea decorativo: **`accept_join_request` rechaza las invitaciones**. Sin eso el atacante crea su partido, invita a la víctima y aprueba su propia invitación, y el agujero queda igual con dos pasos más. El bloque 12d del smoke test intenta exactamente ese ataque, y el control 6 de `verify_027.sql` verifica que el guard esté (probado además rompiéndolo a propósito: reporta FALLA).
>
> Se reusó `join_requests` con una columna `invited_by` en vez de una tabla nueva: una invitación y una solicitud son la misma fila mirada desde los dos lados, y así el `UNIQUE (match_id, user_id)` hace trabajo real — no pueden coexistir una solicitud y una invitación entre las mismas dos partes.
>
> Tres cosas que aparecieron al implementarlo, las tres arregladas en la misma migración:
>
> 1. **El `ALTER DEFAULT PRIVILEGES` de la 025 no alcanza.** Las funciones nuevas nacieron con `EXECUTE` para `PUBLIC` (`proacl = NULL` en las de trigger, `{=X/postgres,…}` en las RPC), o sea invocables con la anon key. Lo detectó el bloque 6e del smoke test. La 027 rehace la línea de base completa —revocar todo y reabrir las nueve RPC— en vez de agregar dos GRANT y confiar en el default.
> 2. **`player_joined` nunca se agregó al enum `notification_type`.** El trigger `notify_user_on_player_added` de la 013 lo usa, la columna `profiles.notify_player_joined` lo configura y la Edge Function lo mapea, pero el valor no existía en la base: ese trigger habría muerto con `invalid input value for enum` la primera vez que corriera. No se notó porque nunca corrió (vive sobre `match_players`). Se agregó junto con `match_invitation`.
> 3. **Un `upsert` no sirve para invitar.** Con fila previa, PostgREST resuelve el conflicto con `ON CONFLICT DO UPDATE`, y esa rama pasa por la policy de UPDATE — falsa para el creador sobre la fila de otro. Fallaría con un error de permisos que no dice nada. El repositorio hace `INSERT` y resuelve el conflicto mirando la fila: si es una invitación suya la reemplaza, y si es una solicitud del usuario avisa que hay que aceptarla, no convertirla.

**Dónde:** cadena entre `022_join_requires_approval.sql:148-152`, `025_security_hardening.sql:183-197` y `023_result_confirmations.sql:217+`

La policy de INSERT de `match_participants` exige que quien inserta sea el creador del partido, pero **no restringe qué `user_id` se inserta**:

```sql
CREATE POLICY "Only match creators can add participants"
    ON match_participants FOR INSERT
    WITH CHECK (auth.uid() IN (SELECT creator_id FROM matches WHERE id = match_id));
```

Es deliberado (el creador agrega invitados a mano), pero para usuarios registrados significa que **cualquiera puede meterte en su partido sin que te enteres ni lo aceptes**. Y desde ahí:

1. `match_ratings` acepta la calificación porque la policy sólo pide que ambos sean participantes del mismo partido (025:183). El atacante te pone **1 estrella**. El trigger `update_user_rating` (001:294) recalcula el promedio de tu perfil.
2. El `UNIQUE (match_id, rater_id, rated_user_id)` sólo impide repetir *dentro del mismo partido*. Con N partidos fabricados son N calificaciones de 1 → tu rating público baja a 1.00.
3. `save_match_result` valida que los jugadores de las stats sean participantes del partido — condición que el atacante ya cumplió. Te marca `outcome = 'loss'` y `apply_match_elo` (021:291) te baja el ELO de verdad.

Todo con una cuenta común y sin tocar la app. Es un vector de hostigamiento dirigido y también de inflado propio (crear partidos, agregar cuentas descartables, ganarlas todas).

**Arreglo — decidido (2026-08-08): consentimiento.** A un usuario registrado sólo lo puede sumar `accept_join_request`, o sea con una solicitud suya de por medio. El creador sigue agregando a mano únicamente invitados sin cuenta:

```sql
WITH CHECK (
    auth.uid() IN (SELECT creator_id FROM matches WHERE id = match_id)
    AND user_id IS NULL          -- registrados sólo entran por accept_join_request
);
```

Corta el vector de raíz: sin participación forzada no hay calificación ni derrota que imputar. Implica tocar el cliente, porque el flujo actual de "agregar jugador" ofrece buscar usuarios registrados (`SupabaseMatchPlayerRepository.searchUsers`) y sumarlos directo; eso pasa a ser una invitación que genera la solicitud, no un alta. Los invitados sin cuenta no cambian.

La alternativa que se descartó, por si alguna vez se reconsidera: conservar el alta directa y en cambio hacer que el rating y las stats sólo cuenten cuando el jugador entró por solicitud aceptada, más ignorar en el promedio las calificaciones repetidas entre el mismo par de usuarios. Es menos invasiva en el cliente pero deja en pie el "te agregaron a un partido sin preguntarte".

---

## A5 — `elo_rating` es auto-editable ✅ CORREGIDO (026)

> **Estado:** la 026 agrega `NEW.elo_rating := OLD.elo_rating` al trigger. El bloque 8 del smoke test lo verifica en un único UPDATE que toca `elo_rating` y `full_name` a la vez: el derivado no cambia y el editable sí. Así ninguna de las dos mitades se puede aprobar a costa de la otra.

**Dónde:** `supabase/migrations/025_security_hardening.sql:131-159`

El trigger `protect_profile_derived_columns` congela `id`, `email`, `created_at`, `rating`, `rating_count`, `total_matches` y `total_wins`. **Falta `elo_rating`**, que se agregó en `003_level_up_db.sql:44-45` y es tan derivada como las otras: la calcula `apply_match_elo`.

**Explotación:** `PATCH /rest/v1/profiles?id=eq.<uno mismo>` con `{"elo_rating": 99999}`. El GRANT de UPDATE sobre `profiles` existe (025:339) y la policy lo permite porque es la fila propia. Queda primero en el ranking sin jugar.

**Arreglo:** una línea.

```sql
NEW.elo_rating := OLD.elo_rating;
```

Y de paso vale un test que compare la lista del trigger contra las columnas derivadas conocidas, para que la próxima columna calculada no se olvide igual.

---

## A6 — Inyección de filtros PostgREST en el buscador de jugadores ✅ CORREGIDO

> **Estado:** el `.or()` interpolado se fue. El filtro pasó a ser una sola condición con el valor mandado como parámetro por `.ilike()`, así que la coma ya no es estructura sino texto. Y el mail dejó de buscarse por subcadena: si lo escrito **ya es un mail completo** se busca por igualdad (`.ilike` sin comodines es comparación exacta insensible a mayúsculas), y cualquier otra cosa busca por nombre. Eso saca de encima el oráculo de enumeración, no sólo la inyección.
>
> Se encontró de paso una variante en el buscador **que sí está vivo** (`SupabaseProfileRepository.searchByName`, el que usa `Create.tsx`): no era inyectable, pero PostgREST traduce `*` a `%` en los filtros `ilike`, así que escribir un `*` listaba a todo el mundo hasta el límite. Los dos usan ahora el mismo helper, `repositories/supabase/searchPattern.ts`, que también pone techo al `limit`.
>
> El `*` no se puede escapar, se saca: mandar `\*` termina matcheando un `%` literal, que no es lo que el usuario pidió. Cubierto por `__tests__/repositories/searchPattern.test.ts` y por cuatro tests nuevos en `matchPlayers.service.test.ts`, uno de los cuales verifica explícitamente que `.or()` **no** se llame.

**Dónde:** `repositories/supabase/SupabaseMatchPlayerRepository.ts:7` y `:92-100`

```ts
const normalizeSearchQuery = (query: string) => query.trim().replace(/[%_\\]/g, '\\$&')
// ...
.or(`full_name.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%`)
```

El sanitizador escapa los comodines de `LIKE` (`%`, `_`, `\`) pero **no los separadores estructurales de PostgREST**: la coma, el punto y los paréntesis. En un `.or()`, la coma separa condiciones.

**Explotación:** escribiendo en el buscador

```
a,phone.not.is.null
```

la query se convierte en tres condiciones OR, una de ellas puesta por el atacante. Sirve para filtrar por **columnas que no están en el `select`** y usar el resultado como oráculo: confirmar si un mail existe (`a,email.eq.victima@gmail.com`), enumerar por teléfono, por zona, por `zone_coordinates`. Y el `select` devuelve `email`, así que lo que matchea sale con el mail incluido.

**Arreglo:** no armar filtros con interpolación de texto del usuario. Dos consultas separadas con `.ilike()` (que sí manda el valor como parámetro) y unión en el cliente, o si se quiere una sola llamada, sacar los caracteres estructurales:

```ts
const normalizeSearchQuery = (q: string) =>
    q.trim().replace(/[,().*:]/g, ' ').replace(/[%_\\]/g, '\\$&')
```

Conviene revisar la regla de forma general: **ningún `.or()` / `.filter()` construido por concatenación con input del usuario.** Hoy este es el único caso.

---

## M1 — PII de todos los usuarios legible por cualquier usuario logueado

**Dónde:** `025_security_hardening.sql:89-92` (policy `USING (true)`), `repositories/supabase/SupabaseProfileRepository.ts:17` y `:37` (`select('*')`), `SupabaseMatchPlayerRepository.ts:96` (`select(… email …)`), `SupabaseTeamRepository.ts:18` y `SupabaseMatchPlayerRepository.ts:56` (`user:profiles(*)`)

Ya está reconocido como pendiente en el comentario de 025 (bloque 3), y sigue abierto. `profiles` incluye `email`, `phone`, `zone`, `zone_coordinates`. Con una cuenta gratis se baja el padrón entero: mail, teléfono y coordenadas de la zona de cada persona. El buscador de jugadores además consulta `email.ilike`, lo que lo vuelve una herramienta de cosecha de mails con búsquedas de 2 caracteres.

Ya hay un ejemplo del patrón a seguir en el repo: `SupabaseJoinRequestRepository.getInvitations()` (027) devuelve `user:profiles(id, full_name, avatar_url)` en vez del `profiles(*)` que usan las consultas viejas, con el tipo `MatchInvitation` acompañando. Para pintar una fila de lista no hace falta el mail ni el teléfono de nadie, y así se ve.

**Arreglo** (requiere tocar el cliente, que es por lo que quedó postergado):

1. Crear una vista `public_profiles` con `security_invoker = true` y **sólo** las columnas públicas: `id, full_name, avatar_url, sport_levels, skill_level, zone, rating, rating_count, elo_rating, total_matches, total_wins`. `GRANT SELECT` a `authenticated`.
2. Cambiar todos los `select('*')` y los joins `profiles(*)` que traen **otros** perfiles para que apunten a la vista. `getById` sobre el propio usuario puede seguir yendo a `profiles`.
3. Sacar `email` del `select` del buscador y de la condición del `.or()` (buscar sólo por `full_name`).
4. Con el cliente ya migrado, restringir la policy de `profiles` a la fila propia y dejar la vista como único acceso a perfiles de terceros.

---

## M2 — `join_requests` UPDATE no fija `user_id` ✅ CORREGIDO (026)

> **Estado:** resuelto sin el trigger que proponía este apartado, porque al ir a escribirlo apareció que la policy estaba **al revés**, no incompleta. Le sobraba al creador (acepta y rechaza por las RPC, que son `SECURITY DEFINER`) y le faltaba al usuario: volver a pedir entrar después de un rechazo es un UPDATE sobre su propia fila —`join_requests` tiene `UNIQUE(match_id, user_id)`— y ninguna policy lo permitía. `SupabaseJoinRequestRepository.create()` lo hacía igual, el UPDATE afectaba 0 filas y `.maybeSingle()` devolvía `null` sin error: **re-solicitar estaba roto en silencio desde siempre**, aunque la 022 le hubiera puesto un trigger para notificarlo.
>
> La 026 invierte la policy: se va la del creador, entra la del dueño de la solicitud con `WITH CHECK (auth.uid() = user_id AND status = 'pending')`. Eso arregla el bug y de paso cierra el agujero, porque el `WITH CHECK` mira la fila nueva: no se puede reasignar a otro `user_id` ni auto-aceptarse. Cubierto por los bloques 11 a 11e del smoke test.

**Dónde:** `001_initial_schema.sql:411-419`

```sql
CREATE POLICY "Match creators can update request status"
    ON join_requests FOR UPDATE
    USING (auth.uid() IN (SELECT creator_id FROM matches WHERE id = match_id));
```

Sin `WITH CHECK` propio, Postgres reutiliza el `USING` sobre la fila nueva: lo único que se verifica es que quien edita siga siendo el creador del partido. **Nada fija `user_id` ni `match_id`.** El creador puede reapuntar su propia solicitud al `user_id` de un tercero y después:

- ponerla en `accepted` → el trigger `notify_user_on_request_response` (013:391) le manda a la víctima *"Te uniste a «TÍTULO»"*, con título elegido por el atacante (otro push arbitrario);
- llamar `accept_join_request` → la víctima entra como participante, que es la entrada a A4.

**Arreglo:**

```sql
DROP POLICY IF EXISTS "Match creators can update request status" ON join_requests;
CREATE POLICY "Match creators can update request status"
    ON join_requests FOR UPDATE
    TO authenticated
    USING (auth.uid() IN (SELECT creator_id FROM matches WHERE id = match_id))
    WITH CHECK (auth.uid() IN (SELECT creator_id FROM matches WHERE id = match_id));
```

Eso todavía no fija `user_id`. Lo que lo fija de verdad es un trigger `BEFORE UPDATE` que restaure las columnas de identidad (`NEW.user_id := OLD.user_id; NEW.match_id := OLD.match_id;`) cuando `current_user` sea `authenticated`, con la misma técnica de `protect_profile_derived_columns`. Alternativa más limpia: quitarle el UPDATE directo a `authenticated` y dejar que todo pase por las RPC `accept_join_request` / `reject_join_request`, que ya validan bien (hoy el cliente sólo usa las RPC — `SupabaseJoinRequestRepository.ts:81,88` —, así que el GRANT de UPDATE es superficie sin uso).

---

## M3 — Los resultados son escribibles salteando la RPC ✅ CORREGIDO (026)

> **Estado:** la 026 revoca `INSERT`/`UPDATE`/`DELETE` sobre `match_results` y `match_player_stats`, y reduce las policies a `SELECT`. Verificado antes de escribirlo: `SupabaseMatchResultRepository` sólo hace `SELECT` en esas dos tablas y todo lo que escribe va por las cuatro RPC. Los 20 bloques de `smoke_results_and_requests.sql` siguen pasando, o sea que el camino legítimo quedó intacto.

**Dónde:** `021_match_results.sql:137-151`, con GRANTs en `025:345-346`

```sql
CREATE POLICY "Match creators can write results"    ON match_results      FOR ALL USING/WITH CHECK (creador);
CREATE POLICY "Match creators can write player stats" ON match_player_stats FOR ALL USING/WITH CHECK (creador);
```

`save_match_result` valida un montón (partido no cancelado, ya empezado, autor único, que cada jugador de las stats haya jugado, borrado de votos al corregir, ELO una sola vez). Un INSERT/UPDATE directo por PostgREST **no valida nada de eso**: el creador puede escribir stats de usuarios que no son participantes, cambiar el marcador sin borrar las confirmaciones (dejando votos que confirman un resultado que ya no existe) y evitar el `has_dispute`.

**Arreglo:** si la RPC es el único camino previsto — y lo es, `SupabaseMatchResultRepository.ts` sólo usa RPC —, revocar el DML directo y dejar sólo lectura:

```sql
REVOKE INSERT, UPDATE, DELETE ON public.match_results      FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.match_player_stats FROM authenticated;
```

Las policies pueden quedar (no hacen daño sin GRANT), pero conviene reducirlas a `FOR SELECT` para que la próxima auditoría no tenga que cruzar dos archivos.

---

## M4 — Spam y phishing masivo por "partido cercano"

**Dónde:** `013:310-340` (`notify_nearby_users_on_match_create`) + `024:47-88` (`get_nearby_users`)

El trigger de creación de partido manda una notificación a **todos** los usuarios cuya zona coincida o que estén dentro de su radio (20 km por defecto), con el cuerpo:

```sql
format('Hay un partido de %s en %s', NEW.sport, NEW.venue_name)
```

`venue_name` es texto libre del creador. La migración 024 quitó a propósito el filtro `push_token IS NOT NULL`, así que ahora alcanza a todos. No hay límite de partidos por usuario ni por hora.

**Explotación:** crear un partido con `venue_name = "CanchApp: verificá tu cuenta en bit.ly/…"` → push a toda la base de la zona. Repetible en loop.

**Arreglo:**

- No poner texto del usuario en el cuerpo del push de difusión: usar sólo el deporte y la zona (`Hay un partido de fútbol cerca tuyo`), y dejar `venue_name` para el `data` / la pantalla del partido.
- Límite de creación: un trigger que rechace si el usuario creó más de N partidos en la última hora, o un `COUNT` en la policy de INSERT de `matches`.
- Sanear a la entrada (largo máximo y sin URLs) en `venue_name` y `title`, del lado de la base con un `CHECK`, no sólo en el formulario.

---

## M5 — La sesión vive en AsyncStorage, y el backup de Android está habilitado ⚠️ PARCIAL

> **Hecho:** `"allowBackup": false` en `app.json`, que cierra la extracción por `adb backup` — el camino que no necesita root. Falta el build para que tenga efecto (el manifest es generado).
>
> **Pendiente:** mover la sesión de AsyncStorage a SecureStore. Sigue siendo extraíble en un dispositivo rooteado. Ojo con el límite de 2048 bytes por ítem de SecureStore: el JSON de sesión de Supabase puede pasarlo, así que hay que partirlo en chunks o guardar sólo el refresh token, y hace falta una migración silenciosa (leer de AsyncStorage la primera vez, escribir en SecureStore, borrar el original) para no desloguear a todo el mundo en el update.
>
> Efecto colateral de `allowBackup: false` que conviene saber: al cambiar de teléfono o restaurar un backup, los usuarios van a tener que volver a iniciar sesión.

**Dónde:** `lib/supabase.ts:12-19` y `android/app/src/main/AndroidManifest.xml` (`android:allowBackup="true"`)

```ts
export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { storage: AsyncStorage, ... },
})
```

AsyncStorage en Android es un SQLite sin cifrar en el directorio privado de la app. Ahí quedan el access token y el **refresh token**. Con `allowBackup="true"`, un `adb backup` (o un backup de fabricante) los saca sin root; con root o un emulador, directamente. El refresh token vale hasta que rote, así que es toma de cuenta completa.

El proyecto ya tiene `expo-secure-store` instalado y en `plugins` — sólo no se usa para la sesión. Las reglas `secure_store_backup_rules` que agrega ese plugin excluyen del backup lo de SecureStore, pero no AsyncStorage.

**Arreglo:**

1. `"android": { "allowBackup": false }` en `app.json`.
2. Pasar el storage de auth a un adaptador sobre SecureStore (`getItem`/`setItem`/`removeItem` con `SecureStore.*Async`). Ojo con el límite de 2048 bytes por ítem de SecureStore: el JSON de sesión de Supabase puede pasarlo, así que hay que partirlo en chunks o guardar sólo el refresh token. Conviene hacerlo con una migración de datos silenciosa (leer de AsyncStorage la primera vez, escribir en SecureStore, borrar el original) para no desloguear a todo el mundo en el update.
3. El reloj de `AppLockContext` (`canchapp:last_active_at`, AsyncStorage) es manipulable para evitar el bloqueo por inactividad. Impacto bajo — hace falta el teléfono desbloqueado —, pero es gratis moverlo a SecureStore junto con lo anterior.

---

## M6 — El login biométrico guarda la contraseña en claro ✅ CORREGIDO

> **Estado:** ahora se guarda el **refresh token** de la sesión en vez de la contraseña. Mismo comportamiento para el usuario —apoya el dedo y entra— con un secreto que sí se puede revocar (cerrar sesión lo invalida), que sólo sirve para esta app y que no revela la contraseña. El login usa `refreshSession({ refresh_token })`.
>
> **La parte que no era obvia:** cambiar el código no saca la contraseña de los teléfonos donde ya está. `biometricService.purgeLegacyCredentials()` corre en cada arranque, borra la clave vieja y desactiva la huella, para que el usuario entre una vez con contraseña y la reactive. Sin eso, el arreglo sólo valía para instalaciones nuevas.
>
> **Y lo que se decidió NO hacer:** `SecureStore` permite atar el ítem a la biometría con `requireAuthentication: true`, que sería criptográficamente más fuerte que el chequeo en JS. No se usa porque en Android esa opción exige autenticación para **usar** la clave, y eso incluye escribir: como el refresh token rota en cada renovación, habría que reescribirlo cada hora y cada reescritura pediría la huella en medio de cualquier cosa. La consecuencia hay que tenerla clara — en un dispositivo rooteado el gate se puede saltear y leer el token — y es justamente por eso que importa tanto **qué** se guarda.
>
> El refresh token se mantiene al día desde `AuthContext`, que es el único lugar que se entera de todas las renovaciones. Cubierto por 21 tests en `__tests__/services/biometric.service.test.ts`, incluido uno que verifica que ningún camino escriba una contraseña.
>
> **El límite de lo que el refresh token puede dar.** Cerrar sesión lo revoca — es la contracara de haber elegido un secreto revocable, y `{ scope: 'local' }` tampoco lo salva: revoca el de la sesión actual, que es el guardado. O sea que "cerrar sesión y volver a entrar con la huella" no es alcanzable sin dejar viva una sesión que el usuario dio por cerrada. La app no lo disimula: el `signOut` borra el token y el botón de huella se muestra **sólo si hay uno guardado** (`hasStoredToken()`, distinto de la preferencia), así que sin token la pantalla pide mail y contraseña en vez de fallar al apoyar el dedo. La preferencia sobrevive y el token se rearma solo en el próximo ingreso. Donde la huella sí entra es en el caso que la motivó: la app se abre y la sesión local no está, pero el token sigue siendo válido.

**Dónde:** `hooks/useBiometricAuth.ts:20-23`, usado desde `app/(auth)/Login.tsx:60-70`

```ts
await SecureStore.setItemAsync(CREDENTIALS_KEY, JSON.stringify({ email, password }))
```

La contraseña real queda guardada en el dispositivo y `authenticate()` la devuelve en texto plano para reusarla en `signInWithPassword`. SecureStore está respaldado por el Keystore, así que no es trivial de sacar, pero:

- La contraseña de una persona suele ser la misma en otros servicios: si se filtra, el daño sale de CanchApp.
- El ítem se guarda **sin `requireAuthentication: true`**, así que el descifrado no está atado a la biometría; el gate biométrico es una decisión de la app en JS, no una propiedad criptográfica. En un dispositivo rooteado, o con un build modificado, se lee sin pasar por la huella.

**Arreglo:** no guardar la contraseña. La sesión de Supabase ya persiste y se auto-refresca; el "login con huella" puede ser exactamente lo que ya hace `AppLockContext` (sesión viva + gate biométrico para destaparla). Si se necesita sobrevivir a un `signOut` explícito, guardar el **refresh token** en lugar de la contraseña, y en los dos casos con:

```ts
await SecureStore.setItemAsync(KEY, value, { requireAuthentication: true, keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY })
```

Y borrar las credenciales viejas ya guardadas al actualizar (`disable()` en el arranque, una vez).

---

## M7 — Deep link sin verificar y comodín en los redirects

**Dónde:** `repositories/supabase/SupabaseAuthRepository.ts:49` y `supabase/config.toml:156`

El reset de contraseña vuelve a `canchapp://auth/reset-password`, y el manifest declara `<data android:scheme="canchapp"/>` **sin App Links verificados** (`android:autoVerify`, `assetlinks.json`). Cualquier app instalada puede declarar el mismo esquema; según la versión de Android, el usuario ve un diálogo de desambiguación o la otra app se lo queda. Quien intercepte ese link se queda con el token de recuperación → toma de cuenta.

Aparte, `additional_redirect_urls = ["https://127.0.0.1:3000", "exp://*/*"]` tiene un comodín. Si esa configuración es la que está en el proyecto hosteado, un `exp://` arbitrario es destino válido para los tokens de OAuth.

**Arreglo:**

- Usar un App Link verificado (`https://canchapp.<dominio>/auth/reset-password` con `assetlinks.json` publicado y `autoVerify="true"`) para los links de auth. El esquema custom puede quedar para navegación interna, no para nada que lleve credenciales.
- Sacar `exp://*/*` de los redirects del proyecto hosteado; dejarlo sólo en el `config.toml` local si hace falta para Expo Go.
- El flujo PKCE ya está soportado en `signInWithGoogle` (`exchangeCodeForSession`); conviene forzarlo y **quitar la rama del flujo implícito** que parsea `access_token`/`refresh_token` del fragmento, que es la parte interceptable.

---

## M8 — Política de auth débil ✅ CORREGIDO EN EL REPO (falta el Dashboard)

> **Estado:** `config.toml` quedó con `minimum_password_length = 8`, `password_requirements = "lower_upper_letters_digits"` (espejo exacto de `authService.validatePassword`), `enable_confirmations = true` y `secure_password_change = true`. Verificado contra la API de auth local, que es el camino que usa un atacante salteando el cliente:
>
> | Prueba | Resultado |
> |---|---|
> | `signup` con `123456` | `422 weak_password` |
> | `signup` con `abcd1234` (sin mayúscula) | `422 weak_password` |
> | `signup` con `Abcd1234` | `200`, con confirmación pendiente |
> | `login` sin confirmar el mail | `400 email_not_confirmed` |
>
> **`secure_password_change` obligó a arreglar el cambio de contraseña primero.** El modal de `Profile.tsx` pedía sólo la nueva dos veces: cualquiera con el teléfono en la mano y la sesión abierta cambiaba la contraseña y dejaba al dueño afuera, sin probar en ningún momento que era él. Ahora pide la actual y la verifica con un `signIn` — que además deja la sesión marcada como recién autenticada, que es lo que el flag exige del lado del servidor. A las cuentas de Google no se les pide (no tienen contraseña actual que dar).
>
> **Falta el Dashboard**, que es donde se aplica de verdad, y con dos cuidados: la confirmación de mail necesita un SMTP propio configurado, y conviene contar antes cuántas cuentas quedarían sin poder entrar.

**Dónde:** `supabase/config.toml:169-178, 204-215`

- `enable_confirmations = false` → no se verifica el mail. Cualquiera se registra con el mail de otra persona; y como `profiles.email` sale del `auth.users`, queda un perfil con un mail ajeno.
- `minimum_password_length = 6`, `password_requirements = ""`. El cliente pide 8 caracteres con mayúscula y número (`services/auth.service.ts:23-30`), pero eso es cliente: `POST /auth/v1/signup` con `"123456"` entra igual.
- `[auth.captcha]` comentado, sin captcha.
- `sign_in_sign_ups = 30` por 5 minutos **por IP** — laxo para credential stuffing distribuido.
- `secure_password_change = false`: cambiar la contraseña no pide reautenticación, así que un token de sesión robado alcanza para quedarse con la cuenta.

Aclaración: `config.toml` sólo configura el entorno local. Lo que vale es lo que está en el Dashboard del proyecto hosteado — hay que verificarlo ahí (ver checklist).

**Arreglo:** `enable_confirmations = true`, `minimum_password_length = 8`, `password_requirements = "lower_upper_letters_digits"`, `secure_password_change = true`, captcha (hCaptcha/Turnstile) en signup y signin, y bajar los rate limits. Los mismos valores en el Dashboard.

---

## M9 — Permisos Android de más ✅ CORREGIDO

> **Estado:** `blockedPermissions` agregado en `app.json` con los tres. **Sólo tiene efecto después de un `prebuild`**, porque el `AndroidManifest.xml` es generado: hasta el próximo build nativo, el APK instalado sigue pidiéndolos. Para confirmarlo después de compilar:
> `adb shell dumpsys package com.romani22.canchapp | findstr permission`
> — ahí no deberían aparecer `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW` ni `WRITE_EXTERNAL_STORAGE`.
>
> Los tres se verificaron como no usados: la app no graba audio ni video (`storage.service.ts` sólo llama `launchImageLibraryAsync` con `mediaTypes: ['images']`, y en Android ni siquiera se declara `CAMERA`), y no escribe en almacenamiento externo (`expo-file-system` sólo **lee** el archivo elegido). `SYSTEM_ALERT_WINDOW` entra por el soporte de desarrollo de React Native; si en algún build de desarrollo el menú de dev o el LogBox se comportan raro, ese bloqueo es el primer sospechoso — no afecta a producción.

**Dónde:** `android/app/src/main/AndroidManifest.xml`

El manifest generado incluye tres permisos que `app.json` no pide y la app no usa — entran por dependencias transitivas:

- `android.permission.RECORD_AUDIO` (micrófono)
- `android.permission.SYSTEM_ALERT_WINDOW` (dibujar sobre otras apps)
- `android.permission.WRITE_EXTERNAL_STORAGE`

Superficie de ataque y de privacidad gratuita, y motivo habitual de fricción en la revisión de Play Store (el micrófono hay que justificarlo).

**Arreglo:** en `app.json`,

```json
"android": {
  "blockedPermissions": [
    "android.permission.RECORD_AUDIO",
    "android.permission.SYSTEM_ALERT_WINDOW",
    "android.permission.WRITE_EXTERNAL_STORAGE"
  ]
}
```

y verificar el manifest después del próximo `prebuild`. `READ_EXTERNAL_STORAGE` tampoco hace falta en Android 13+ si ya está `READ_MEDIA_IMAGES`; puede quedar acotado con `maxSdkVersion`.

---

## M10 — La API de push de Expo no pide autenticación

**Dónde:** `supabase/functions/send-push-notification/index.ts` (el `fetch` a `EXPO_PUSH_URL`)

Hermano directo de A1, una capa más afuera. `https://exp.host/--/api/v2/push/send` acepta envíos **sin credencial de ningún tipo**: alcanza con conocer el `ExponentPushToken` de un dispositivo para mandarle una notificación que aparece con el ícono y el nombre de CanchApp. Se comprobó en la práctica durante la auditoría, mandando pushes al teléfono de prueba con un simple `Invoke-RestMethod` y nada más.

La superficie es más chica que la de A1 porque los tokens no se pueden listar en masa: la policy de `push_tokens` deja que cada uno lea sólo el suyo. Pero se filtran por los costados — la Edge Function los escribe en los logs cuando Expo devuelve un error (`Push error for token ${...}`), y cualquier volcado de logs o de la tabla los expone.

**Arreglo:**

1. Activar *Enhanced Security for Push Notifications* en el dashboard de Expo (Project settings → Notifications). Desde ese momento Expo rechaza los envíos sin access token.
2. Crear un access token en Expo, guardarlo como secreto (`EXPO_ACCESS_TOKEN`, igual que se hizo con `PUSH_WEBHOOK_SECRET`) y mandarlo en el `fetch`:
   ```ts
   headers: { ..., Authorization: `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}` }
   ```
3. Ojo con el orden, mismo problema que en A1: activar la seguridad en Expo **antes** de desplegar la función deja el push cortado. Primero el secreto y el header, después el switch en Expo.
4. Y sacar el token de los logs de error: alcanza con loguear los últimos 6 caracteres.

---

## Hallazgos bajos e higiene

- **B1 — Dependencias:** 12 vulnerabilidades `high`, todas en herramientas de build (`metro`, `@expo/cli`, `image-size`, `nanoid`), no en código que se empaqueta en el APK. Riesgo real bajo, pero conviene `npx expo install --fix` y volver a correr `npm audit`.
- **B2 — Bucket `avatars` público** (`009_avatars_storage.sql:8`) con path predecible `<user_id>/avatar.jpg` y policy de SELECT `TO public`: quien tenga un `user_id` ve el avatar sin login. Si no molesta, está bien; si se quiere cerrar, bucket privado + URLs firmadas.
- **B3 — `.env` versionado** (hoy vacío). La decisión está justificada en el `.gitignore` y el historial de git está limpio (no hay ninguna service_role key ni JWT commiteado; se verificó sobre todos los commits). Conviene un `.env.example` con las claves esperadas y la regla escrita de que ahí sólo van `EXPO_PUBLIC_*`.
- **B4 — `team_members` con RLS activo y sin ninguna policy**, y sin `GRANT INSERT` en 025. `SupabaseTeamRepository.ts:11,18` escribe y lee esa tabla: el flujo de equipos/torneos está roto en silencio (PostgREST devuelve 0 filas, no error). No es un agujero, pero es superficie sin dueño: o se completa con policies o se saca la feature.
- **B5 — `match_scores`** tiene policy (`004:48-52`) pero quedó sin GRANT después de 025 y ningún archivo del cliente la consulta. Tabla muerta: conviene borrarla.
- **B6 — `dist/`** (build web estático) existe en disco. Está gitignoreado, pero si alguna vez se publica: en web no hay app-lock ni biometría, y `detectSessionInUrl: false` más un `localStorage` sin protección cambian el modelo de amenaza. Confirmar que no se despliegue sin querer.
- **B7 — Sin MFA** y sin registro de eventos de seguridad. Para el tamaño actual está bien, pero vale tenerlo anotado.
- **B9 — Limpieza de canales de Android que no limpia nada.** `LEGACY_ANDROID_CHANNEL_IDS` en [pushnotifications.service.ts:49](services/pushnotifications.service.ts#L49) borra los IDs `'default'`, `'match_reminders'` y `'join_requests'`, pero los que existen de verdad en el dispositivo están prefijados por Expo. Verificado con `adb shell dumpsys notification` en un teléfono real: `EXPO_CHANNEL/@shamanking22/CanchApp/match_reminders`, `.../join_requests`, `.../default`. Así que `deleteNotificationChannelAsync('match_reminders')` no borra nada y esas tres entradas muertas siguen apareciendo en los ajustes del sistema. No es seguridad; se arregla usando los IDs completos.
- **B8 — API key de Firebase** en `google-services.json`: es pública por diseño, no es un secreto. Conviene igual restringirla en Google Cloud Console al package `com.romani22.canchapp` + la firma SHA-1, para que no se pueda reusar desde otra app.

---

## Lo que no se puede auditar desde el repo — checklist para el Dashboard

Estas cosas viven en el proyecto hosteado y no dejan rastro en el código. Hay que mirarlas una por una:

- [ ] **Migración 025 aplicada en producción.** Es lo primero: correr `supabase/diagnostics/verify_025.sql` contra la base hosteada. Todo el análisis de arriba asume que está aplicada; si no lo está, valen además todos los hallazgos que 025 dice arreglar.
- [ ] `verify_jwt` de `send-push-notification` (y el secreto compartido de A1, una vez implementado).
- [ ] Auth: confirmación de mail, largo mínimo y requisitos de contraseña, captcha, rate limits, `secure_password_change` (M8).
- [ ] `additional_redirect_urls` del proyecto: que no tenga comodines (M7).
- [ ] Que la Edge Function desplegada sea la última versión del repo.
- [ ] Webhook `send_notification` activo y `pg_cron` corriendo (ya documentado en las notas de notificaciones).
- [ ] Que no haya extensiones ni funciones creadas a mano desde el editor SQL que no estén en `migrations/` (el bloque 8 de 025 depende de que todo objeto nuevo nazca de una migración corrida como `postgres`).
- [ ] Rotación de la service_role key si alguna vez pasó por un canal no seguro.
- [ ] Backups automáticos y PITR activos.

---

## Lo que está bien

Vale dejarlo asentado, porque es lo que hace que esta auditoría encuentre cinco cosas y no cincuenta:

- La migración 025 identifica y cierra correctamente los agujeros más graves, y —más importante— fija los privilegios de forma explícita en vez de heredarlos del ambiente.
- `save_match_result`, `delete_match_result`, `vote_match_result`, `accept_join_request` y `reject_join_request` validan al llamador, el estado y las condiciones de carrera (`FOR UPDATE`) como corresponde. Seis de las nueve RPC expuestas están bien; sólo las dos de 013 quedaron sin chequeos.
- La superficie de RPC está cerrada por defecto y abierta caso por caso, con el detalle fino de `sport_levels_are_valid` (el `CHECK` que necesitaba su propio GRANT).
- `search_path` fijado en todas las `SECURITY DEFINER`, recorriendo el catálogo en vez de a mano.
- Las vistas con `security_invoker = true`.
- No hay ningún secreto en el historial de git, y no se loguean tokens ni contraseñas en ningún lado (el `console.error` de OAuth loguea a propósito sólo los nombres de los parámetros).
- Los smoke tests de `supabase/diagnostics/` simulan al atacante como es debido (`SET ROLE` + `request.jwt.claims`) y verifican las dos mitades de cada regla.

## Orden sugerido para arreglar

1. ✅ **A1** (Edge Function) — hecho y verificado end-to-end contra el proyecto hosteado.
2. ✅ **A5**, **A2**, **A3**, **M2**, **M3** — migración `026_close_write_paths.sql`, validada localmente con `db reset` + los tres smoke tests. **Pendiente: aplicarla en la base hosteada.**
3. ✅ **A6** (buscadores + helper compartido con tests) y **M9** (`app.json`). **Pendiente: el build nuevo**, que es lo que los pone en la calle.
4. ✅ **A4** — `027_match_invitations.sql` más los cambios de cliente. **Pendiente: aplicar la migración en producción y buildear.**
5. **M8** — el más barato de todos: son cuatro interruptores en el Dashboard (confirmación de mail, largo mínimo de contraseña, requisitos, reautenticación para cambiarla) más el captcha. Cero código.
6. **M10** — chico, y comparte la mecánica del secreto con A1: activar *Enhanced Security* en Expo, un secreto nuevo y un header en el `fetch`.
7. **M5** + **M6** — juntos, porque los dos son "mover cosas a SecureStore" y comparten la migración de datos. M6 es el más urgente de los dos: guarda la contraseña en claro.
8. **M4** — sacar el texto del usuario del push de difusión y poner un límite de partidos por hora.
9. **M7** — necesita un dominio y publicar `assetlinks.json`, así que es el que más depende de algo externo.
10. **M1** — el más invasivo del lado del cliente (vista `public_profiles` y todos los `select('*')`).
11. **B1**, **B4**, **B5**, **B9** y el resto de la higiene.

Cada punto de una migración va con su bloque en `smoke_rls_security.sql`, siguiendo el criterio que ya tenía el archivo: que el ataque falle **y** que el uso legítimo siga andando. La `026` agregó los bloques 8 a 11e con ese formato.

Y una advertencia que ya costó una vez: el bloque **6c** enumera las RPC que tienen que estar abiertas y usa `has_function_privilege()`, que sobre una función inexistente **no devuelve `false`, corta con error** y mata el smoke test entero. Si una migración borra o renombra una RPC, esa lista se actualiza en el mismo commit.
