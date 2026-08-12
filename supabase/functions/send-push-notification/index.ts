import { createClient } from 'jsr:@supabase/supabase-js@2'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

// Espejo de ANDROID_CHANNEL_ID en services/pushnotifications.service.ts, donde
// está la explicación del sufijo de versión. Los dos tienen que moverse juntos:
// Android descarta sin mostrar nada un push cuyo canal no existe en el
// dispositivo, así que un build nuevo con la función vieja (o al revés) deja el
// teléfono mudo aunque el envío diga que salió bien.
const ANDROID_CHANNEL_ID = 'canchapp-v2'

// Maps notification type → profile preference column
const TYPE_TO_PREF: Record<string, string> = {
	new_match: 'notify_new_matches',
	join_request: 'notify_join_requests',
	request_accepted: 'notify_request_response',
	request_rejected: 'notify_request_response',
	player_joined: 'notify_player_joined',
	match_reminder: 'notify_match_reminder',
	match_result: 'notify_match_result',
	match_cancelled: 'notifications_enabled', // always send if global is on
}

/**
 * ¿Quién puede llamar a esta función?
 *
 * Esta función es el último paso antes de que aparezca un cartel en el teléfono
 * de alguien, con el ícono y el nombre de CanchApp. O sea: quien la pueda llamar
 * con contenido a gusto puede hacer phishing con la marca de la app.
 *
 * El JWT NO alcanza como frontera. Supabase valida el token por defecto
 * (verify_jwt), pero la anon key es un JWT válido y viaja adentro del APK:
 * cualquiera la extrae y llega hasta acá. Se mantiene igual como defensa en
 * profundidad, pero la autorización real es este secreto compartido, que sólo
 * conocen el webhook de la base y esta función.
 *
 * Se falla CERRADO si el secreto no está configurado en el entorno: una función
 * sin secreto es una función abierta, y preferimos quedarnos sin push (ruidoso,
 * se nota enseguida) antes que con un endpoint público (silencioso). Ver el
 * orden de deploy en el README de esta carpeta.
 */
// El .trim() no es cosmético: pegar el valor en el campo de secretos del Dashboard
// (o en el header del webhook) arrastra con facilidad un espacio o un salto de línea
// invisible, y el resultado es un 401 permanente imposible de ver a ojo. Se recorta
// en los dos lados para que un secreto "igual pero con un \n" siga entrando.
const WEBHOOK_SECRET = Deno.env.get('PUSH_WEBHOOK_SECRET')?.trim()

/**
 * Comparación en tiempo constante.
 *
 * Un `===` sobre strings corta en el primer byte distinto, así que el tiempo de
 * respuesta filtra cuánto prefijo se acertó y el secreto se puede adivinar de a
 * un carácter. Se comparan los digests SHA-256 en vez de los valores: quedan de
 * largo fijo (32 bytes), así que el largo del secreto tampoco se filtra y el
 * recorrido siempre es el mismo.
 */
async function secretsMatch(a: string, b: string): Promise<boolean> {
	const encoder = new TextEncoder()
	const [digestA, digestB] = await Promise.all([crypto.subtle.digest('SHA-256', encoder.encode(a)), crypto.subtle.digest('SHA-256', encoder.encode(b))])

	const bytesA = new Uint8Array(digestA)
	const bytesB = new Uint8Array(digestB)

	let diff = 0
	for (let i = 0; i < bytesA.length; i++) {
		diff |= bytesA[i] ^ bytesB[i]
	}
	return diff === 0
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
	try {
		if (!WEBHOOK_SECRET) {
			console.error('PUSH_WEBHOOK_SECRET no está configurado: no se envía nada. Ver el README de la función.')
			return new Response('Not configured', { status: 503 })
		}

		const provided = req.headers.get('x-webhook-secret')?.trim()

		// La RESPUESTA no distingue "falta el header" de "el header está mal" —
		// diferenciarlas le regala información a quien esté probando. El LOG sí las
		// distingue, porque es privado y es la única forma de saber si lo que falta es
		// configurar el webhook o corregir el valor. Nunca el valor en sí: sólo su largo,
		// que alcanza para detectar un recorte o un pegado a medias.
		if (!provided) {
			console.warn('Request rechazado: falta el header x-webhook-secret. ¿Está configurado en el webhook send_notification?')
			return new Response('Unauthorized', { status: 401 })
		}

		if (!(await secretsMatch(provided, WEBHOOK_SECRET))) {
			console.warn(`Request rechazado: x-webhook-secret no coincide (largo recibido: ${provided.length}, esperado: ${WEBHOOK_SECRET.length})`)
			return new Response('Unauthorized', { status: 401 })
		}

		// Supabase database webhooks POST the row as { record, old_record, type, table, schema }
		const payload = await req.json()
		const notificationId = payload?.record?.id

		if (typeof notificationId !== 'string' || !UUID_RE.test(notificationId)) {
			return new Response('Missing notification record', { status: 400 })
		}

		const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
			auth: { persistSession: false },
		})

		// 0. Releer la notificación de la base.
		//
		// Del body llega SÓLO el id; todo el resto sale de la tabla. La diferencia es
		// la que hace que esto sea seguro: `notifications` no acepta INSERT de ningún
		// cliente (migración 025, bloque 1: sin policy y sin GRANT), así que el texto
		// de un push sólo puede haberlo escrito un trigger o una función nuestra.
		// Confiando en el body, en cambio, el title/body los elegía quien mandara el
		// request.
		const { data: notification, error: notificationError } = await supabase.from('notifications').select('id, user_id, type, title, body, data').eq('id', notificationId).single()

		if (notificationError || !notification) {
			// Puede pasar sin que nadie ataque nada: el usuario borró la notificación
			// entre el INSERT y este request. No es un error a reintentar.
			console.log('Notification not found:', notificationId, notificationError?.message ?? '')
			return new Response('Notification not found', { status: 200 })
		}

		// 1. Check user notification preferences
		const { data: profile, error: profileError } = await supabase
			.from('profiles')
			.select('notifications_enabled, notify_new_matches, notify_join_requests, notify_request_response, notify_player_joined, notify_match_reminder, notify_match_result')
			.eq('id', notification.user_id)
			.single()

		if (profileError || !profile) {
			console.error('Profile fetch error:', profileError)
			return new Response('Profile not found', { status: 200 })
		}

		if (!profile.notifications_enabled) {
			console.log('Notifications disabled for user:', notification.user_id)
			return new Response('Notifications disabled', { status: 200 })
		}

		const prefKey = TYPE_TO_PREF[notification.type]
		if (prefKey && prefKey !== 'notifications_enabled' && !profile[prefKey as keyof typeof profile]) {
			console.log(`Notification type "${notification.type}" disabled for user:`, notification.user_id)
			return new Response('Notification type disabled', { status: 200 })
		}

		// 2. Get all active push tokens for this user
		const { data: tokens, error: tokenError } = await supabase.from('push_tokens').select('token').eq('user_id', notification.user_id).eq('is_active', true)

		if (tokenError || !tokens?.length) {
			console.log('No active push tokens for user:', notification.user_id)
			return new Response('No tokens', { status: 200 })
		}

		// 3. Build Expo push messages (one per device token)
		const messages = tokens.map((t) => ({
			to: t.token,
			title: notification.title,
			body: notification.body,
			data: {
				...(typeof notification.data === 'object' ? notification.data : {}),
				notification_id: notification.id,
				type: notification.type,
			},
			sound: 'default',
			priority: 'high',
			channelId: ANDROID_CHANNEL_ID,
		}))

		// 4. Send to Expo Push API (accepts up to 100 messages per request)
		const response = await fetch(EXPO_PUSH_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
			body: JSON.stringify(messages),
		})

		if (!response.ok) {
			const text = await response.text()
			console.error('Expo Push API error:', response.status, text)
			return new Response('Push API error', { status: 500 })
		}

		const result = await response.json()

		// Log any individual delivery errors without failing the whole request
		if (result.data) {
			const stale: string[] = []

			result.data.forEach((item: any, i: number) => {
				if (item.status === 'error') {
					console.error(`Push error for token ${tokens[i]?.token}:`, item.message)
					if (item.details?.error === 'DeviceNotRegistered' && tokens[i]?.token) {
						stale.push(tokens[i].token)
					}
				}
			})

			// Con await: antes era un .then() suelto después del return, y el isolate se
			// apagaba antes de que el UPDATE llegara a la base. O sea que los tokens de
			// dispositivos desinstalados nunca se daban de baja y cada notificación
			// seguía intentando entregarles.
			if (stale.length) {
				const { error: deactivateError } = await supabase.from('push_tokens').update({ is_active: false }).in('token', stale)
				if (deactivateError) {
					console.error('No se pudieron desactivar los tokens vencidos:', deactivateError.message)
				} else {
					console.log(`Marked ${stale.length} token(s) as inactive`)
				}
			}
		}

		console.log(`Push sent to ${tokens.length} device(s) for notification ${notification.id}`)
		return new Response(JSON.stringify({ success: true, sent: tokens.length }), {
			headers: { 'Content-Type': 'application/json' },
		})
	} catch (error) {
		console.error('Unexpected error:', error)
		return new Response(JSON.stringify({ error: String(error) }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		})
	}
})
