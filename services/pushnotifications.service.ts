import { repositories } from '@/repositories'
import type { NotificationType } from '@/types/database.types'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

// Configuración de comportamiento de notificaciones
Notifications.setNotificationHandler({
	handleNotification: async () => ({
		shouldShowAlert: true,
		shouldPlaySound: true,
		shouldSetBadge: true,
	}),
})

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

export const pushNotificationService = {
	async registerForPushNotifications(): Promise<string | null> {
		try {
			if (!Device.isDevice) {
				console.warn('Push notifications only work on physical devices')
				return null
			}

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
			console.log('Push token saved successfully')
		} catch (error) {
			console.error('Error saving push token:', error)
			throw error
		}
	},

	async removePushToken(userId: string): Promise<void> {
		try {
			await repositories.pushTokens.remove(userId)
			console.log('Push token removed successfully')
		} catch (error) {
			console.error('Error removing push token:', error)
			throw error
		}
	},

	async sendLocalNotification(config: PushNotificationConfig): Promise<void> {
		try {
			await Notifications.scheduleNotificationAsync({
				content: { title: config.title, body: config.body, data: config.data || {}, sound: config.sound !== false, priority: config.priority || 'high' },
				trigger: null,
			})
		} catch (error) {
			console.error('Error sending local notification:', error)
		}
	},

	async scheduleLocalNotification(config: PushNotificationConfig, triggerDate: Date): Promise<string> {
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
		try {
			const reminderTime = new Date(startsAt.getTime() - 11 * 60 * 1000)
			if (reminderTime <= new Date()) {
				console.log('Match starts too soon to schedule reminder')
				return null
			}
			const identifier = await this.scheduleLocalNotification(
				{
					title: '⏰ Tu partido comienza pronto',
					body: `"${matchTitle}" en ${venueName} comienza en 10 minutos`,
					data: { match_id: matchId, type: 'match_reminder' },
					channelId: 'match_reminders',
				},
				reminderTime,
			)
			console.log('Match reminder scheduled:', identifier)
			return identifier
		} catch (error) {
			console.error('Error scheduling match reminder:', error)
			return null
		}
	},

	async cancelMatchReminder(matchId: string): Promise<void> {
		try {
			const scheduled = await Notifications.getAllScheduledNotificationsAsync()
			const reminder = scheduled.find((n) => n.content.data?.match_id === matchId && n.content.data?.type === 'match_reminder')
			if (reminder) {
				await Notifications.cancelScheduledNotificationAsync(reminder.identifier)
				console.log('Match reminder cancelled for match:', matchId)
			}
		} catch (error) {
			console.error('Error cancelling match reminder:', error)
		}
	},

	async cancelScheduledNotification(identifier: string): Promise<void> {
		try {
			await Notifications.cancelScheduledNotificationAsync(identifier)
		} catch (error) {
			console.error('Error cancelling notification:', error)
		}
	},

	async cancelAllScheduledNotifications(): Promise<void> {
		try {
			await Notifications.cancelAllScheduledNotificationsAsync()
		} catch (error) {
			console.error('Error cancelling all notifications:', error)
		}
	},

	async getBadgeCount(): Promise<number> {
		try {
			return await Notifications.getBadgeCountAsync()
		} catch (error) {
			console.error('Error getting badge count:', error)
			return 0
		}
	},

	async setBadgeCount(count: number): Promise<void> {
		try {
			await Notifications.setBadgeCountAsync(count)
		} catch (error) {
			console.error('Error setting badge count:', error)
		}
	},

	addNotificationReceivedListener(callback: (notification: Notifications.Notification) => void): ReturnType<typeof Notifications.addNotificationReceivedListener> {
		return Notifications.addNotificationReceivedListener(callback)
	},

	addNotificationResponseReceivedListener(
		callback: (response: Notifications.NotificationResponse) => void,
	): ReturnType<typeof Notifications.addNotificationResponseReceivedListener> {
		return Notifications.addNotificationResponseReceivedListener(callback)
	},

	async getAllScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
		try {
			return await Notifications.getAllScheduledNotificationsAsync()
		} catch (error) {
			console.error('Error getting scheduled notifications:', error)
			return []
		}
	},

	async checkPermissions(): Promise<boolean> {
		try {
			const { status } = await Notifications.getPermissionsAsync()
			return status === 'granted'
		} catch (error) {
			console.error('Error checking notification permissions:', error)
			return false
		}
	},

	async dismissAllNotifications(): Promise<void> {
		try {
			await Notifications.dismissAllNotificationsAsync()
		} catch (error) {
			console.error('Error dismissing notifications:', error)
		}
	},
}
