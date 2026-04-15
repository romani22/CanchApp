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
 *  - Programar recordatorios locales cuando llegan notificaciones con datos de partido
 *  - Persistir recordatorios de partido en la tabla notifications (para el inbox)
 *
 * El REGISTRO del push token lo maneja exclusivamente AuthContext.setupPushNotifications
 * para evitar requests concurrentes que pueden invalidar el refresh token de Supabase.
 */
export function usePushNotifications() {
	const [notification, setNotification] = useState<Notifications.Notification | null>(null)
	const notificationListener = useRef<ReturnType<typeof Notifications.addNotificationReceivedListener> | null>(null)
	const responseListener = useRef<ReturnType<typeof Notifications.addNotificationResponseReceivedListener> | null>(null)
	// Evita duplicados cuando received + response listener disparan para la misma notificación
	const recordedRemindersRef = useRef<Set<string>>(new Set())
	const router = useRouter()
	const { user } = useAuth()

	// ── Inbox: persiste recordatorios locales en la tabla notifications ──────
	const persistMatchReminder = useCallback(
		async (n: Notifications.Notification) => {
			const data = n.request.content.data as NotificationData
			if (data?.type !== 'match_reminder' || !data.match_id || !user?.id) return
			if (recordedRemindersRef.current.has(data.match_id)) return

			recordedRemindersRef.current.add(data.match_id)
			notificationsService
				.create(user.id, 'match_reminder', n.request.content.title ?? '⏰ Tu partido comienza pronto', n.request.content.body ?? '', { match_id: data.match_id })
				.catch(() => {
					recordedRemindersRef.current.delete(data.match_id!)
				})
		},
		[user?.id],
	)

	// ── Recordatorio local: programa al recibir request_accepted / player_joined ─
	const scheduleReminderFromNotification = useCallback(async (data: NotificationData) => {
		const { type, match_id, match_title, venue_name, starts_at } = data
		if ((type === 'request_accepted' || type === 'player_joined') && match_id && match_title && venue_name && starts_at) {
			pushNotificationService
				.scheduleMatchReminder(match_id, match_title, venue_name, new Date(starts_at))
				.catch((err) => console.warn('[usePushNotifications] Could not schedule reminder:', err))
		}
	}, [])

	// ── Navegación al tocar una notificación ─────────────────────────────────
	const handleNotificationTap = useCallback(
		(data: NotificationData) => {
			const { type, match_id } = data

			switch (type) {
				case 'new_match':
				case 'match_reminder':
					if (match_id) router.push(`/(protected)/match/${match_id}`)
					break
				case 'join_request':
					if (match_id) router.push(`/(protected)/match/requests`)
					break
				case 'request_accepted':
				case 'request_rejected':
				case 'player_joined':
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
			persistMatchReminder(n)
			scheduleReminderFromNotification(n.request.content.data as NotificationData)
			updateBadgeCount()
		})

		// App en segundo plano o cerrada — el usuario toca la notificación
		responseListener.current = pushNotificationService.addNotificationResponseReceivedListener((response) => {
			persistMatchReminder(response.notification)
			handleNotificationTap(response.notification.request.content.data as NotificationData)
		})

		updateBadgeCount()

		return () => {
			notificationListener.current?.remove()
			responseListener.current?.remove()
		}
	}, [user?.id, persistMatchReminder, scheduleReminderFromNotification, handleNotificationTap, updateBadgeCount])

	const scheduleMatchReminder = async (matchId: string, matchTitle: string, venueName: string, startsAt: Date) => {
		try {
			return await pushNotificationService.scheduleMatchReminder(matchId, matchTitle, venueName, startsAt)
		} catch (error) {
			console.error('Error scheduling match reminder:', error)
			return null
		}
	}

	const cancelReminder = async (identifier: string) => {
		try {
			await pushNotificationService.cancelScheduledNotification(identifier)
		} catch (error) {
			console.error('Error cancelling reminder:', error)
		}
	}

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
		scheduleMatchReminder,
		cancelReminder,
		sendLocalNotification,
		updateBadgeCount,
		checkPermissions,
	}
}
