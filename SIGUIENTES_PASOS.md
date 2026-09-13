# Retomar acá — estado y próximos pasos

Documento de traspaso del trabajo de ciberseguridad de CanchApp.
Última actualización: 2026-09-10.

El detalle de cada hallazgo está en **[AUDITORIA_SEGURIDAD.md](AUDITORIA_SEGURIDAD.md)**; esto es sólo el "qué sigue" y en qué orden.

---

## Cómo retomar la conversación

Pegá esto en un chat nuevo:

> Estoy retomando el trabajo de ciberseguridad de CanchApp. Leé `SIGUIENTES_PASOS.md` y `AUDITORIA_SEGURIDAD.md` en la raíz del repo para ponerte al día, y decime por dónde seguimos según lo que ya haya hecho yo de la lista de pendientes.

---

## Dónde está cada cosa

| Archivo | Qué es |
|---|---|
| `AUDITORIA_SEGURIDAD.md` | El informe completo: 25 hallazgos, su estado y el arreglo de cada uno |
| `supabase/migrations/025_security_hardening.sql` | Primer cierre de RLS y privilegios |
| `supabase/migrations/026_close_write_paths.sql` | A2, A3, A5, M2, M3 |
| `supabase/migrations/027_match_invitations.sql` | A4 — invitaciones con consentimiento |
| `supabase/migrations/028_delete_account.sql` | Eliminar mi cuenta (bloqueo de Google Play) |
| `supabase/diagnostics/smoke_rls_security.sql` | 54 aserciones. **Sólo contra la base local** (crea usuarios falsos) |
| `supabase/diagnostics/verify_025/026/027/028.sql` | Verificadores de sólo lectura (13 + 15 + 13 + 9 chequeos). **Seguros en producción** |
| `supabase/functions/send-push-notification/README.md` | Cómo desplegar la Edge Function y su secreto |

Validación local completa:

```bash
npx supabase db reset
docker exec -i supabase_db_CanchApp psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/diagnostics/smoke_rls_security.sql
npx tsc --noEmit && npx jest
```

---

## 0. REGRESIÓN DE LA 027 — confirmada y arreglada

> **Confirmado contra la base local el 2026-09-12.** La consulta vieja devuelve `HTTP 300 PGRST201`; con la pista de FK devuelve `200` y trae el perfil correcto (el invitado, no quien invita). El arreglo está aplicado.

La 027 agregó `invited_by UUID REFERENCES profiles(id)` a `join_requests`, que **ya tenía** `user_id REFERENCES profiles(id)`. Con dos claves foráneas a la misma tabla, PostgREST no puede resolver un embed de `profiles` sin una pista: devuelve `300 Multiple Choices` (PGRST201) y la consulta entera falla.

Afectaba a cuatro consultas de `SupabaseJoinRequestRepository` — `getForMatch`, `getInvitations`, `getCreatorPending` y `getUser` — o sea que **está roto desde que se aplicó la 027 en la base hosteada**, no sólo en el build pendiente.

Alcance real: la app **todavía no está en Google Play**, así que lo padecen los builds instalados a mano —el tuyo y el de quien esté probando—, no usuarios finales. Se arregla antes de que exista alguien a quien afectarle.

Y fallaba en silencio: en `match/[id].tsx` las dos llamadas iban con `.catch(() => [])`, así que el creador veía **cero solicitudes y cero invitaciones**, indistinguible de un partido sin nada.

**Ya arreglado en el código:** las cuatro consultas usan `profiles!join_requests_user_id_fkey`, los `.catch()` ahora loguean, y hay un test que falla si alguien saca la pista de la FK. Es el mismo patrón que ya usaban las consultas de `matches` (`matches_creator_id_fkey`), que tiene `creator_id` y `winner_id`.

Lo que devolvió la prueba, como `authenticated` sobre la base local:

| Consulta | Resultado |
|---|---|
| `select=*,user:profiles(*)` | `300` — `PGRST201`, "Could not embed because more than one relationship was found" |
| `select=*,user:profiles!join_requests_user_id_fkey(...)` | `200`, y el `user` embebido es el **invitado**, no quien invitó |
| Las cuatro consultas afectadas, con la pista | `200` las cuatro |
| `getInvitations` desde una cuenta ajena al partido | `200` con `[]` — la RLS sigue tapando |

PostgREST incluso sugiere la pista exacta en el `hint` del error 300, así que si vuelve a aparecer, el mensaje dice qué poner.

**Falta:** el build. Hasta que salga, los teléfonos con el APK viejo siguen sin la pista, o sea con las solicitudes y las invitaciones invisibles.

---

## 1. PENDIENTE INMEDIATO — buildear (bloquea lo demás)

La migración 027 **ya está aplicada en la base hosteada** y verificada, pero el cliente correspondiente **no está buildeado**. Mientras tanto, el build viejo instalado falla al crear un partido con jugadores registrados pre-agregados: la policy nueva rechaza ese INSERT. Se cierra buildeando.

> **La 028 todavía NO está aplicada en la base hosteada.** Es la única migración que falta aplicar allá. Aplicarla antes del build no rompe nada del cliente viejo: agrega una columna y una función que el build viejo no usa. Después, correr `verify_028.sql`.

El build pendiente trae:

- **A4** — invitaciones: el creador invita y el jugador acepta
- Listado de invitaciones pendientes y rechazadas, con botón de cancelar
- El arreglo de la ambigüedad de FK del punto 0 — **es lo que destraba las solicitudes y las invitaciones, hoy invisibles en los builds instalados**
- **M6** — el login con huella ya no guarda la contraseña
- **M5 (parcial)** — `allowBackup: false`
- Cambio de contraseña pidiendo la actual
- **Eliminar mi cuenta** (028), que es lo que destraba la publicación en Google Play

```bash
npx expo prebuild --platform android   # necesario para que M9 y M5 tengan efecto
# después, el build como lo venís haciendo
```

### 1.1 Recorrido de prueba (necesita dos cuentas)

**Cuenta A (creadora):**

1. Crear un partido agregando a la cuenta B. Debe decir *"Invitamos a 1 jugador"*.
2. Abrir el partido: B **no** debe figurar entre los participantes. Arriba debe estar *"Invitaciones — 1 pendiente"* con el nombre y una ✕.
3. Agregar un invitado sin cuenta desde Editar partido: ése **sí** entra directo.

**Cuenta B (invitada):**

4. Debe llegar el push *"Te invitaron a un partido"*. Al tocarlo, va al detalle con el banner **Rechazar / Aceptar y unirme**.
5. Aceptar → aparece como participante, y a A le llega *"Aceptaron tu invitación"*.
6. Repetir con otra invitación y **rechazar**: en A debe quedar la fila tachada con *"rechazó"*.

**Regresiones a mirar:**

- Solicitar unirse desde Explorar, y que A pueda aceptar y rechazar.
- Guardar el perfil (cambiar un deporte o nivel). La 027 revocó `EXECUTE` en masa y eso toca el `CHECK` de `sport_levels`.
- Cambiar la contraseña: ahora pide la actual.
- El acceso con huella aparece **desactivado** tras actualizar. Es a propósito: se borran las credenciales viejas. Hay que entrar una vez con contraseña y reactivarlo.
- Al reactivarlo, el token se guarda **en el momento de activar** (antes se esperaba a un evento de sesión que ya había pasado, y la preferencia quedaba prendida con el almacén vacío).
- **Cerrar sesión oculta el botón de huella**: el logout revoca el token, así que la pantalla pide mail y contraseña. Al ingresar, la huella se rearma sola — no hay que volver a activarla. Que el botón NO aparezca después de un logout es el comportamiento correcto.

### 1.1.b Eliminar cuenta (028) — probarlo con una cuenta descartable

**No lo pruebes con tu cuenta.** No tiene vuelta atrás.

1. Crear una cuenta de prueba, que organice un partido **pasado** con otra cuenta adentro, y otro **futuro**.
2. Perfil → *Eliminar mi cuenta*. Tiene que pedir la contraseña (o escribir ELIMINAR, si entró con Google).
3. Confirmar. Debe volver al login solo.
4. Intentar entrar con ese mail y contraseña: **no debe dejar**.
5. Desde la otra cuenta:
   - el partido pasado **sigue estando**, y el organizador ahora dice *"Usuario eliminado"*;
   - el partido futuro quedó **cancelado**, y llegó el aviso;
   - buscar a esa persona para invitarla a un partido: **no debe aparecer**.
6. Registrarse de nuevo con el mismo mail: **debe dejar** (el mail quedó libre) y tiene que entrar como cuenta nueva, sin nada del historial anterior.

### 1.2 Verificar M9 (permisos Android)

Con el teléfono conectado por USB y depuración activada:

```
adb shell dumpsys package com.romani22.canchapp | findstr permission
```

No deben aparecer `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW` ni `WRITE_EXTERNAL_STORAGE`. Si aparecen, el build no corrió `prebuild`.

---

## 2. Dashboard de Supabase — 5 minutos, sin dependencias

Cierra el 80% de **M8**. No necesita dominio ni SMTP.

Authentication → Providers → Email, y Rate Limits:

- [ ] Minimum password length: **8**
- [ ] Password requirements: **Lowercase, uppercase letters and digits**
- [ ] Secure password change: **ON** (el cliente ya pide la contraseña actual, requisito de este flag)
- [ ] **Captcha** (hCaptcha o Turnstile) — hoy no hay nada frenando fuerza bruta

Ya están en `supabase/config.toml` y verificados contra la API local: las contraseñas débiles devuelven `422 weak_password`.

---

## 3. Lo que depende del dominio

Comprar un dominio (~US$10-15/año; Cloudflare Registrar es el más simple). **Un solo dominio destraba tres cosas.**

### 3.1 Brevo → cierra M8

Plan gratis: 300 mails/día. El motivo real no es la confirmación de mail sino que **"olvidé mi contraseña" hoy es poco confiable**: sale por el servicio incorporado de Supabase, que es de desarrollo y permite unos pocos envíos por hora para todo el proyecto.

Orden (importa — si prendés la confirmación antes de que el mail funcione, el registro queda inutilizable):

1. Crear cuenta en Brevo, elegir **transaccional** (no marketing).
2. Senders, Domains & Dedicated IPs → Add a domain → cargar los registros DNS que muestre (verificación, **DKIM**, **SPF**, **DMARC**) y verificar.
3. SMTP & API → SMTP → crear una **clave SMTP** (no es la contraseña de la cuenta). Host `smtp-relay.brevo.com`, puerto `587`.
4. Supabase → Authentication → Emails → SMTP Settings → activar y cargar los datos. Sender: `no-reply@tudominio`.
5. Authentication → Rate Limits → subir "emails per hour" (el default es de desarrollo).
6. Authentication → URL Configuration → **Site URL** al dominio, y **sacar `exp://*/*`** de los Redirect URLs (es un comodín, y es medio M7).
7. Traducir las plantillas de mail (vienen en inglés y genéricas; parecen phishing).
8. **Probar con la confirmación apagada**: mandarse un "olvidé mi contraseña" y verlo llegar. Brevo → Transactional → Email activity muestra rebotes y motivos.
9. Recién ahí, contar a quién dejarías afuera y prender la confirmación:

```sql
SELECT COUNT(*) FILTER (WHERE email_confirmed_at IS NULL) AS sin_confirmar,
       COUNT(*) AS total
FROM auth.users;
```

### 3.2 M7 — App Links

Hoy el link de recuperación de contraseña vuelve por `canchapp://`, un esquema sin verificar que cualquier app instalada puede reclamar: quien lo intercepte se queda con el token de recuperación.

- Publicar `/.well-known/assetlinks.json` (Android) y `/.well-known/apple-app-site-association` (iOS), por HTTPS, **sin redirecciones**. El de Apple va **sin extensión** y con content-type `application/json`.
- `android:autoVerify` en el intent-filter.
- Cambiar `redirectTo` de `resetPassword()` a la URL https.
- Sacar del OAuth la rama del flujo implícito (`SupabaseAuthRepository.signInWithGoogle` parsea `access_token` del fragmento) y dejar sólo PKCE, que es la parte no interceptable.

### 3.3 El sitio estático — obligatorio para las tiendas

Cuatro páginas y dos JSON, gratis en Cloudflare Pages:

```
index.html              → landing (sirve también para reclutar los 12 testers)
privacidad.html         → obligatoria en Google y Apple
soporte.html            → el Support URL es campo obligatorio en App Store Connect
eliminar-cuenta.html    → Google exige poder pedirlo SIN instalar la app (en la app ya está, 028)
confirmado.html         → a donde vuelve el usuario tras confirmar el mail
.well-known/assetlinks.json
.well-known/apple-app-site-association
```

> **NO publicar el build web de Expo como sitio.** Es el hallazgo B6: en web no existe el bloqueo por inactividad ni la biometría, y la sesión pasa al `localStorage`. Es un modelo de amenaza distinto que no se auditó. HTML estático para el sitio, la app sólo en las tiendas.

---

## 4. Lo que puede avanzar sin que hagas nada

### 4.0. `verify_025.sql` estaba roto — ya arreglado

Listaba 9 RPC del cliente, dos de las cuales (`add_multiple_players` y `remove_match_player`) las borró la 026 con la feature de `match_players`. Y `has_function_privilege()` sobre una función inexistente **no devuelve false: corta con error** — la misma trampa que el propio documento advierte al final. Como los 13 chequeos del archivo son un solo `UNION ALL`, el verificador no reportaba una falla: moría entero, y esos 13 chequeos estuvieron inaccesibles desde la 026.

Ahora la lista tiene las 7 que quedan y cada nombre pasa por `to_regprocedure()` dentro de un `CASE`, así que una RPC borrada sale como FALLA en vez de matar el archivo. Tiene que ser `CASE` y no `OR`: en un `OR` Postgres no garantiza el orden de evaluación y podría llamar a la función igual.

Corre entero: **13/13 OK**.

### El resto, por orden sugerido:

1. **M10** — la API de push de Expo no pide autenticación: con el token de un dispositivo cualquiera le manda un push con la identidad de la app. Se cierra activando *Enhanced Security* en Expo + un access token en la Edge Function. Chico.
2. ~~**Borrado de cuenta**~~ — **hecho en la app** (028). Falta sólo la página web, que va con el dominio (punto 3.3).

   > El apunte que decía "la base ya tiene el trigger de limpieza (migración 018)" **era falso**: la 019 revirtió la 018 entera, porque Supabase no deja borrar de `storage.objects` desde la base. El avatar lo borra el cliente con la Storage API antes de llamar a la RPC.
3. **M4** — spam/phishing masivo: `venue_name` es texto libre y va en el push a todos los usuarios de la zona, sin límite de partidos por hora.
4. **M5 (segunda mitad)** — mover la sesión de AsyncStorage a SecureStore. Ojo con el límite de 2048 bytes por ítem y con no desloguear a todo el mundo en el update.
5. **M1** — el más invasivo: mail, teléfono y coordenadas de todos los usuarios son legibles por cualquiera logueado. Vista `public_profiles` + cambiar todos los `select('*')`. El patrón a seguir ya está en `SupabaseJoinRequestRepository.getInvitations()`.
6. **B1-B9** — higiene: `npm audit`, bucket de avatares público, `team_members` y `match_scores` muertas, la limpieza de canales de Android que no limpia nada, la API key de Firebase sin restringir.

---

## 5. Requisitos de tiendas (no es seguridad, pero bloquea el lanzamiento)

### Presupuesto

| Concepto | Costo | Obligatorio |
|---|---|---|
| Google Play | US$25 único | Sí (Android) |
| Apple Developer | US$99/año | Sí (iOS) |
| Dominio | US$10-15/año | En la práctica sí |
| **Supabase Pro** | **US$25/mes** | No al arranque. **El plan gratis no hace backups** |
| EAS Build | US$0 | 15 builds Android + 15 iOS por mes alcanzan |
| Brevo, Expo Push, FCM, hosting | US$0 | — |

Primer año: ~US$40 sólo Android · ~US$140 con iOS · ~US$440 con Supabase Pro.

Mientras no pagues Pro: programate un `pg_dump` periódico. No es point-in-time recovery, pero es infinitamente mejor que no tener nada.

### Bloqueos que no son plata

- [ ] **12 testers × 14 días corridos** (Google Play, cuentas personales creadas después del 13/11/2023). Es por app y el reloj corre solo: **empezar a juntarlos ya.**
- [x] **Borrado de cuenta dentro de la app** — hecho en la 028. Perfil → *Eliminar mi cuenta*. **Falta el build.**
- [ ] **URL web de borrado** — Google exige poder pedirlo sin instalar la app. Va con el dominio: `eliminar-cuenta.html` del punto 3.3.
- [ ] **Política de privacidad** publicada.
- [ ] Formularios **Data Safety** (Google) y **App Privacy** (Apple): declarar mail, ubicación y fotos.
- [x] Permisos de más — ya resuelto en M9 (habrían levantado preguntas en la revisión).
- **Sign in with Apple: probablemente NO aplica**, porque la app tiene su propio sistema de mail y contraseña además de Google. La regla 4.8 se dispara con login de terceros *exclusivo*.

---

## 6. Decisiones ya tomadas (no rediscutir)

- **Consentimiento de las dos partes** para entrar a un partido: el creador invita y el jugador registrado acepta. La aprobación del creador **no alcanza** — protege el partido, no a la persona: sin el segundo consentimiento, el atacante crea su partido, invita a la víctima y aprueba su propia invitación.
- **`match_players` está cerrada**: feature muerta, sin UI que la alcance y con las funciones rotas. Si vuelve, hay que crear funciones nuevas con sus chequeos, no revivir las borradas.
- **El login con huella guarda el refresh token, nunca la contraseña.** No se usa `requireAuthentication` de SecureStore porque en Android exige autenticación para escribir, y el token rota cada hora: le pediría la huella al usuario todo el tiempo.
- **Los resultados y las solicitudes se escriben sólo por RPC.** Las tablas no tienen DML directo para `authenticated`.
- **Toda migración que agregue o borre una RPC debe actualizar el bloque 6c del smoke test Y el chequeo 6 de `verify_025.sql`.** `has_function_privilege()` sobre una función inexistente no devuelve `false`: corta con error y mata el archivo entero. Ya pasó una vez: la 026 (2026-08-12) dejó `verify_025.sql` muerto, y no se notó porque no aparece como un FALLA visible sino que corta la ejecución. Por eso el chequeo 6 ahora envuelve cada nombre en `to_regprocedure()` dentro de un `CASE` para que una RPC borrada salga como FALLA. Al agregar una RPC nueva, conviene copiar ese patrón.
