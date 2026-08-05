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
