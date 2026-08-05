import { useAuth } from '@/context/AuthContext'
import { notificationsService } from '@/services/notifications.service'
import { NotificationData, pushNotificationService } from '@/services/pushnotifications.service'

import * as Notifications from 'expo-notifications'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Gestiona los listeners de notificaciones push para toda la sesión autenticada.
 *
 * Responsabilidades:
 *  - Escuchar notificaciones recibidas (foreground) y taps (background/killed)
 *  - Navegar al destino correcto al tocar una notificación
 *  - Mantener el badge de la app al día
 *
 * Nada se programa desde acá: toda notificación nace como fila en `notifications`
 * y de ahí sale al teléfono (024_notifications_single_channel.sql). Antes los
 * recordatorios se programaban en el dispositivo y había que volcarlos al listado
 * a mano, con la mitad de los casos sin cubrir.
 *
 * El REGISTRO del push token lo maneja exclusivamente AuthContext.setupPushNotifications
 * para evitar requests concurrentes que pueden invalidar el refresh token de Supabase.
 */
export function usePushNotifications() {
	const [notification, setNotification] = useState<Notifications.Notification | null>(null)
	const notificationListener = useRef<ReturnType<typeof Notifications.addNotificationReceivedListener> | null>(null)
	const responseListener = useRef<ReturnType<typeof Notifications.addNotificationResponseReceivedListener> | null>(null)
	const router = useRouter()
	const { user } = useAuth()

	// ── Navegación al tocar una notificación ─────────────────────────────────
	const handleNotificationTap = useCallback(
		(data: NotificationData) => {
			const { type, match_id } = data

			switch (type) {
				case 'join_request':
					if (match_id) router.push(`/(protected)/match/requests`)
					break
				case 'new_match':
				case 'match_reminder':
				case 'request_accepted':
				case 'request_rejected':
				case 'player_joined':
				case 'match_result':
				case 'match_cancelled':
					if (match_id) router.push(`/(protected)/match/${match_id}`)
					break
				default:
					router.push('/(protected)/(tabs)/Notifications')
			}
		},
		[router],
	)

	// ── Utilidades expuestas ──────────────────────────────────────────────────
	const updateBadgeCount = useCallback(async () => {
		if (!user?.id) return
		try {
			const count = await notificationsService.getUnreadCount(user.id)
			await pushNotificationService.setBadgeCount(count)
		} catch (error) {
			console.error('Error updating badge count:', error)
		}
	}, [user?.id])

	// ── Listeners ─────────────────────────────────────────────────────────────
	useEffect(() => {
		if (!user?.id) return

		// App en primer plano
		notificationListener.current = pushNotificationService.addNotificationReceivedListener((n) => {
			setNotification(n)
			updateBadgeCount()
		})

		// App en segundo plano o cerrada — el usuario toca la notificación
		responseListener.current = pushNotificationService.addNotificationResponseReceivedListener((response) => {
			handleNotificationTap(response.notification.request.content.data as NotificationData)
		})

		updateBadgeCount()

		return () => {
			notificationListener.current?.remove()
			responseListener.current?.remove()
		}
	}, [user?.id, handleNotificationTap, updateBadgeCount])

	const sendLocalNotification = async (title: string, body: string, data?: NotificationData) => {
		try {
			await pushNotificationService.sendLocalNotification({ title, body, data })
		} catch (error) {
			console.error('Error sending local notification:', error)
		}
	}

	const checkPermissions = () => pushNotificationService.checkPermissions()

	return {
		notification,
		sendLocalNotification,
		updateBadgeCount,
		checkPermissions,
	}
}
