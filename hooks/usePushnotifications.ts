import { useAuth } from '@/context/AuthContext'
import { notificationsService } from '@/services/notifications.service'
import { NotificationData, pushNotificationService } from '@/services/pushnotifications.service'

import * as Notifications from 'expo-notifications'
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'

export function usePushNotifications() {
	const [expoPushToken, setExpoPushToken] = useState<string | null>(null)
	const [notification, setNotification] = useState<Notifications.Notification | null>(null)
	const [isRegistering, setIsRegistering] = useState(false)
	const notificationListener = useRef<Notifications.Subscription | null>(null)
	const responseListener = useRef<Notifications.Subscription | null>(null)
	const router = useRouter()
	const { user } = useAuth()

	useEffect(() => {
		if (!user?.id) return

		// Registrar el dispositivo y obtener el token
		registerForPushNotifications()

		// Listener: cuando se recibe una notificación
		notificationListener.current = pushNotificationService.addNotificationReceivedListener((notification) => {
			console.log('📩 Notification received:', notification)
			setNotification(notification)

			// Actualizar el badge count
			updateBadgeCount()
		})

		// Listener: cuando el usuario toca una notificación
		responseListener.current = pushNotificationService.addNotificationResponseReceivedListener((response) => {
			console.log('👆 Notification tapped:', response)
			handleNotificationTap(response.notification.request.content.data as NotificationData)
		})

		// Actualizar badge count inicial
		updateBadgeCount()

		// Cleanup
		return () => {
			if (notificationListener.current) {
				notificationListener.current.remove()
			}
			if (responseListener.current) {
				responseListener.current.remove()
			}
		}
	}, [user?.id])

	const registerForPushNotifications = async () => {
		if (!user?.id) return

		try {
			setIsRegistering(true)
			const token = await pushNotificationService.registerForPushNotifications()

			if (token) {
				await pushNotificationService.savePushToken(user.id, token)
				setExpoPushToken(token)
				console.log('✅ Push token registered:', token)
			}
		} catch (error) {
			console.error('❌ Error registering push notifications:', error)
		} finally {
			setIsRegistering(false)
		}
	}

	const updateBadgeCount = async () => {
		if (!user?.id) return

		try {
			const count = await notificationsService.getUnreadCount(user.id)
			await pushNotificationService.setBadgeCount(count)
		} catch (error) {
			console.error('Error updating badge count:', error)
		}
	}

	const handleNotificationTap = (data: NotificationData) => {
		const { type, match_id, request_id } = data

		switch (type) {
			case 'new_match':
			case 'match_reminder':
				if (match_id) {
					router.push(`/(protected)/match/${match_id}`)
				}
				break

			case 'join_request':
				if (match_id) {
					router.push(`/(protected)/match/requests`)
				}
				break

			case 'request_accepted':
			case 'request_rejected':
				if (match_id) {
					router.push(`/(protected)/match/${match_id}`)
				}
				break

			case 'player_joined':
				if (match_id) {
					router.push(`/(protected)/match/${match_id}`)
				}
				break

			default:
				// Ir a la pantalla de notificaciones
				router.push('/(protected)/notificationsSettings/notifications')
				break
		}
	}

	const scheduleMatchReminder = async (matchId: string, matchTitle: string, venueName: string, startsAt: Date) => {
		try {
			const identifier = await pushNotificationService.scheduleMatchReminder(matchId, matchTitle, venueName, startsAt)
			return identifier
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
			await pushNotificationService.sendLocalNotification({
				title,
				body,
				data,
			})
		} catch (error) {
			console.error('Error sending local notification:', error)
		}
	}

	const checkPermissions = async () => {
		return await pushNotificationService.checkPermissions()
	}

	const requestPermissions = async () => {
		return await registerForPushNotifications()
	}

	return {
		expoPushToken,
		notification,
		isRegistering,
		scheduleMatchReminder,
		cancelReminder,
		sendLocalNotification,
		updateBadgeCount,
		checkPermissions,
		requestPermissions,
	}
}
