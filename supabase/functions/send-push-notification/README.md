# send-push-notification

Último paso del camino de una notificación: toma una fila de `notifications` y la
manda al teléfono vía la API de push de Expo.

La dispara el webhook `send_notification` (Dashboard → Integrations → Database
Webhooks), en `INSERT` sobre `notifications`. Ver `migrations/014_push_notification_delivery.sql`
para el resto del cableado.

## Cómo está protegida

Dos capas, y sólo una de ellas cuenta:

1. **`verify_jwt = true`** (defensa en profundidad). No autoriza a nadie: la anon
   key es un JWT válido y viaja adentro del APK.
2. **Header `x-webhook-secret`** (la frontera real). Sólo lo conocen el webhook y
   la función. Se compara en tiempo constante contra `PUSH_WEBHOOK_SECRET`.

Y la regla de fondo: **del body sólo se usa `record.id`**. Todo el contenido del
push (`user_id`, `title`, `body`, `data`) se relee de la tabla. `notifications` no
acepta INSERT de ningún cliente — sin policy y sin GRANT desde la migración 025 —,
así que el texto de un push sólo puede haberlo escrito un trigger nuestro.

Si `PUSH_WEBHOOK_SECRET` no está en el entorno, la función responde 503 y no manda
nada. Falla cerrado a propósito: sin push se nota enseguida, un endpoint abierto no.

## Configurar y desplegar

**El orden importa**, o el push se corta por unos minutos.

```bash
# 1. Generar el secreto (guardalo en el gestor de contraseñas, no en el repo)
openssl rand -hex 32

# 2. Cargarlo en el proyecto ANTES de desplegar
supabase secrets set PUSH_WEBHOOK_SECRET=<el valor generado>
```

**3. Agregar el header al webhook, todavía antes de desplegar.** Dashboard →
Integrations → Database Webhooks → `send_notification` → Edit → sección *HTTP
Headers* → agregar:

| Header             | Valor                  |
| ------------------ | ---------------------- |
| `x-webhook-secret` | `<el mismo valor>`     |

No tocar el `Authorization` que Supabase pone solo.

```bash
# 4. Recién ahora, desplegar
supabase functions deploy send-push-notification
```

Con este orden nunca hay una ventana donde la función pida un header que el webhook
todavía no manda.

**5. Verificar.** Insertar una notificación como sistema y confirmar que llega al
teléfono:

```sql
-- En el SQL Editor. El INSERT directo simula lo que hace un trigger.
INSERT INTO notifications (user_id, type, title, body)
VALUES ('<tu user_id>', 'match_cancelled', 'Prueba', 'Llegó el push');
```

Y confirmar que el camino cerrado quedó cerrado — esto tiene que dar **401**:

```bash
curl -i -X POST 'https://<project-ref>.supabase.co/functions/v1/send-push-notification' \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H 'Content-Type: application/json' \
  -d '{"record":{"id":"00000000-0000-0000-0000-000000000000","user_id":"<victima>","type":"match_cancelled","title":"CanchApp","body":"texto arbitrario"}}'
```

Antes de este cambio eso mandaba un push real con ese texto a la víctima.

## Para rotar el secreto

Al revés que el alta, y sin ventana: la función acepta un solo valor, así que hay
que cambiar los dos lados casi juntos. Poner el nuevo valor primero en el webhook
y después en los secretos deja un hueco de segundos donde los push se pierden (no
se encolan). Si eso molesta, agregar soporte transitorio para dos secretos válidos
en la función, rotar, y sacarlo.

## Cuando se agrega un tipo de notificación

Se toca en los dos lados: el `enum notification_type` en la base y el mapa
`TYPE_TO_PREF` de `index.ts`. Un tipo que no está en el mapa se manda siempre
(sólo lo frena la preferencia global). Y hay que **redesplegar la función**: si no,
el tipo nuevo llega al listado pero no suena.
