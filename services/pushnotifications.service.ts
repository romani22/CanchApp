import { repositories } from '@/repositories'
import type { NotificationType } from '@/types/database.types'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import type * as NotificationsType from 'expo-notifications'
import { Platform } from 'react-native'

export interface NotificationData {
	match_id?: string
	request_id?: string
	user_id?: string
	type?: NotificationType
	[key: string]: any
}

export interface PushNotificationConfig {
	title: string
	body: string
	data?: NotificationData
	sound?: boolean
	priority?: 'default' | 'high' | 'max'
	channelId?: string
}

const isExpoGo = Constants.executionEnvironment === 'storeClient'

// En Expo Go nunca se llama require(), así DevicePushTokenAutoRegistration no se ejecuta
// eslint-disable-next-line @typescript-eslint/no-require-imports
const getNotifications = (): typeof NotificationsType => require('expo-notifications')

if (!isExpoGo) {
	getNotifications().setNotificationHandler({
		handleNotification: async () => ({
			shouldShowAlert: true,
			shouldShowBanner: true,
			shouldShowList: true,
			shouldPlaySound: true,
			shouldSetBadge: true,
		}),
	})
}

export const pushNotificationService = {
	async registerForPushNotifications(): Promise<string | null> {
		try {
			if (isExpoGo) {
				return null
			}

			if (!Device.isDevice) {
				console.warn('Push notifications only work on physical devices')
				return null
			}

			const Notifications = getNotifications()

			const { status: existingStatus } = await Notifications.getPermissionsAsync()
			let finalStatus = existingStatus

			if (existingStatus !== 'granted') {
				const { status } = await Notifications.requestPermissionsAsync()
				finalStatus = status
			}

			if (finalStatus !== 'granted') {
				console.warn('Push notification permissions not granted')
				return null
			}

			const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
			if (!projectId) {
				console.error('Project ID not found')
				return null
			}

			const tokenData = await Notifications.getExpoPushTokenAsync({ projectId })
			const token = tokenData.data

			if (Platform.OS === 'android') {
				await Notifications.setNotificationChannelAsync('default', {
					name: 'Default',
					importance: Notifications.AndroidImportance.MAX,
					vibrationPattern: [0, 250, 250, 250],
					lightColor: '#FF231F7C',
				})
				await Notifications.setNotificationChannelAsync('match_reminders', {
					name: 'Recordatorios de Partido',
					importance: Notifications.AndroidImportance.HIGH,
					vibrationPattern: [0, 250, 250, 250],
					sound: 'default',
				})
				await Notifications.setNotificationChannelAsync('join_requests', {
					name: 'Solicitudes de Unión',
					importance: Notifications.AndroidImportance.HIGH,
					vibrationPattern: [0, 250, 250, 250],
					sound: 'default',
				})
			}

			return token
		} catch (error) {
			console.error('Error registering for push notifications:', error)
			return null
		}
	},

	async savePushToken(userId: string, token: string): Promise<void> {
		try {
			const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? ('android' as const) : ('web' as const)
			const deviceName = Device.deviceName || `${Platform.OS} Device`
			await repositories.pushTokens.save(userId, token, platform, deviceName)
		} catch (error) {
			console.error('Error saving push token:', error)
			throw error
		}
	},

	async removePushToken(userId: string): Promise<void> {
		try {
			await repositories.pushTokens.remove(userId)
		} catch (error) {
			console.error('Error removing push token:', error)
			throw error
		}
	},

	async sendLocalNotification(config: PushNotificationConfig): Promise<void> {
		if (isExpoGo) return
		try {
			const Notifications = getNotifications()
			await Notifications.scheduleNotificationAsync({
				content: { title: config.title, body: config.body, data: config.data || {}, sound: config.sound !== false, priority: config.priority || 'high' },
				trigger: null,
			})
		} catch (error) {
			console.error('Error sending local notification:', error)
		}
	},

	async scheduleLocalNotification(config: PushNotificationConfig, triggerDate: Date): Promise<string> {
		if (isExpoGo) return ''
		const Notifications = getNotifications()
		try {
			const seconds = Math.max(0, Math.floor((triggerDate.getTime() - Date.now()) / 1000))
			const content = { title: config.title, body: config.body, data: config.data || {}, sound: config.sound !== false, priority: config.priority || 'high' }

			if (seconds <= 0) {
				return await Notifications.scheduleNotificationAsync({ content, trigger: null })
			}

			let identifier: string
			try {
				identifier = await Notifications.scheduleNotificationAsync({
					content,
					trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
				})
			} catch {
				// Fallback intencional, no un error tragado: algunas plataformas y
				// versiones no aceptan el trigger por DATE, así que se reintenta con
				// TIME_INTERVAL. Si este segundo también falla, propaga.
				identifier = await Notifications.scheduleNotificationAsync({
					content,
					trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
				})
			}
			return identifier
		} catch (error) {
			console.error('Error scheduling notification:', error)
			throw error
		}
	},

	async scheduleMatchReminder(matchId: string, matchTitle: string, venueName: string, startsAt: Date): Promise<string | null> {
		if (isExpoGo) return null
		try {
			const reminderTime = new Date(startsAt.getTime() - 11 * 60 * 1000)
			if (reminderTime <= new Date()) return null
			const identifier = await this.scheduleLocalNotification(
				{
					title: '⏰ Tu partido comienza pronto',
					body: `"${matchTitle}" en ${venueName} comienza en 10 minutos`,
					data: { match_id: matchId, type: 'match_reminder' },
					channelId: 'match_reminders',
				},
				reminderTime,
			)
			return identifier
		} catch (error) {
			console.error('Error scheduling match reminder:', error)
			return null
		}
	},

	/**
	 * Le avisa al CREADOR, un rato después de que el partido terminó, que cargue el
	 * resultado. Sin esto un partido puede quedar para siempre sin resultado y las
	 * estadísticas de todos los que jugaron se quedan quietas.
	 *
	 * Es una notificación local programada, no un push del servidor: el envío por
	 * pg_net de 014 está sin activar, así que el servidor hoy no puede mandar nada.
	 * La contra es que vive en el dispositivo donde se programó, y por eso el aviso
	 * también aparece dentro de la app (banner en el detalle y "Falta resultado" en
	 * Mis Turnos), que es lo que cubre el caso de haber cambiado de teléfono.
	 */
	async scheduleResultReminder(matchId: string, matchTitle: string, endsAt: Date): Promise<string | null> {
		if (isExpoGo) return null
		try {
			// 15 minutos después del final estimado: si el partido se estiró un poco,
			// el aviso no le llega al creador mientras todavía está jugando.
			const reminderTime = new Date(endsAt.getTime() + 15 * 60 * 1000)
			if (reminderTime <= new Date()) return null
			return await this.scheduleLocalNotification(
				{
					title: '📊 ¿Cómo salió?',
					body: `Cargá el resultado de "${matchTitle}" para que cuente en las estadísticas`,
					// type 'match_result' y no 'match_reminder': cancelar uno no tiene que
					// pisar al otro, y los dos pueden estar programados a la vez.
					data: { match_id: matchId, type: 'match_result' },
					channelId: 'match_reminders',
				},
				reminderTime,
			)
		} catch (error) {
			console.error('Error scheduling result reminder:', error)
			return null
		}
	},

	async cancelMatchReminder(matchId: string): Promise<void> {
		return this.cancelScheduledForMatch(matchId, 'match_reminder')
	},

	async cancelResultReminder(matchId: string): Promise<void> {
		return this.cancelScheduledForMatch(matchId, 'match_result')
	},

	/** Cancela los avisos locales de un partido de un tipo dado. */
	async cancelScheduledForMatch(matchId: string, type: NotificationType): Promise<void> {
		if (isExpoGo) return
		try {
			const Notifications = getNotifications()
			const scheduled = await Notifications.getAllScheduledNotificationsAsync()
			// Todos los que matcheen, no sólo el primero: si alguna vez se programó de
			// más, cancelar tiene que dejar el partido sin avisos pendientes de verdad.
			const matching = scheduled.filter((n) => n.content.data?.match_id === matchId && n.content.data?.type === type)
			await Promise.all(matching.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)))
		} catch (error) {
			console.error('Error cancelling scheduled notification for match:', error)
		}
	},

	async cancelScheduledNotification(identifier: string): Promise<void> {
		if (isExpoGo) return
		try {
			await getNotifications().cancelScheduledNotificationAsync(identifier)
		} catch (error) {
			console.error('Error cancelling notification:', error)
		}
	},

	async cancelAllScheduledNotifications(): Promise<void> {
		if (isExpoGo) return
		try {
			await getNotifications().cancelAllScheduledNotificationsAsync()
		} catch (error) {
			console.error('Error cancelling all notifications:', error)
		}
	},

	async getBadgeCount(): Promise<number> {
		if (isExpoGo) return 0
		try {
			return await getNotifications().getBadgeCountAsync()
		} catch (error) {
			console.error('Error getting badge count:', error)
			return 0
		}
	},

	async setBadgeCount(count: number): Promise<void> {
		if (isExpoGo) return
		try {
			await getNotifications().setBadgeCountAsync(count)
		} catch (error) {
			console.error('Error setting badge count:', error)
		}
	},

	addNotificationReceivedListener(callback: (notification: NotificationsType.Notification) => void): { remove: () => void } {
		if (isExpoGo) return { remove: () => {} }
		return getNotifications().addNotificationReceivedListener(callback)
	},

	addNotificationResponseReceivedListener(callback: (response: NotificationsType.NotificationResponse) => void): { remove: () => void } {
		if (isExpoGo) return { remove: () => {} }
		return getNotifications().addNotificationResponseReceivedListener(callback)
	},

	async getAllScheduledNotifications(): Promise<NotificationsType.NotificationRequest[]> {
		if (isExpoGo) return []
		try {
			return await getNotifications().getAllScheduledNotificationsAsync()
		} catch (error) {
			console.error('Error getting scheduled notifications:', error)
			return []
		}
	},

	async checkPermissions(): Promise<boolean> {
		if (isExpoGo) return false
		try {
			const { status } = await getNotifications().getPermissionsAsync()
			return status === 'granted'
		} catch (error) {
			console.error('Error checking notification permissions:', error)
			return false
		}
	},

	async dismissAllNotifications(): Promise<void> {
		if (isExpoGo) return
		try {
			await getNotifications().dismissAllNotificationsAsync()
		} catch (error) {
			console.error('Error dismissing notifications:', error)
		}
	},
}
