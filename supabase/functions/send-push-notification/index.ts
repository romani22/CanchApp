import { createClient } from 'jsr:@supabase/supabase-js@2'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

// Maps notification type → profile preference column
const TYPE_TO_PREF: Record<string, string> = {
	new_match: 'notify_new_matches',
	join_request: 'notify_join_requests',
	request_accepted: 'notify_request_response',
	request_rejected: 'notify_request_response',
	player_joined: 'notify_player_joined',
	match_reminder: 'notify_match_reminder',
	match_cancelled: 'notifications_enabled', // always send if global is on
}

Deno.serve(async (req) => {
	try {
		// Supabase database webhooks POST the row as { record, old_record, type, table, schema }
		const payload = await req.json()
		const notification = payload.record

		if (!notification?.id) {
			return new Response('Missing notification record', { status: 400 })
		}

		const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
			auth: { persistSession: false },
		})

		// 1. Check user notification preferences
		const { data: profile, error: profileError } = await supabase
			.from('profiles')
			.select('notifications_enabled, notify_new_matches, notify_join_requests, notify_request_response, notify_player_joined, notify_match_reminder')
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
			channelId: notification.type === 'match_reminder' ? 'match_reminders' : notification.type === 'join_request' ? 'join_requests' : 'default',
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
			result.data.forEach((item: any, i: number) => {
				if (item.status === 'error') {
					console.error(`Push error for token ${tokens[i]?.token}:`, item.message)
					// Mark token as inactive if it's invalid
					if (item.details?.error === 'DeviceNotRegistered') {
						supabase.from('push_tokens').update({ is_active: false }).eq('token', tokens[i].token).then(() => {
							console.log('Marked token as inactive:', tokens[i].token)
						})
					}
				}
			})
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
