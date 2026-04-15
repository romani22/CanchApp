import { supabase } from '@/lib/supabase'
import { DevicePlatform, NotificationType } from '@/types/database.types'
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
	/**
	 * Registra el dispositivo para recibir notificaciones push
	 */
	async registerForPushNotifications(): Promise<string | null> {
		try {
			// Verificar si es un dispositivo físico
			if (!Device.isDevice) {
				console.warn('Push notifications only work on physical devices')
				return null
			}

			// Solicitar permisos
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

			// Obtener el token de Expo
			const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId

			if (!projectId) {
				console.error('Project ID not found')
				return null
			}

			const tokenData = await Notifications.getExpoPushTokenAsync({
				projectId,
			})

			const token = tokenData.data

			// Configurar canal de Android
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

	/**
	 * Guarda el push token en Supabase
	 */
	async savePushToken(userId: string, token: string): Promise<void> {
		try {
			const platform: DevicePlatform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web'

			const deviceName = Device.deviceName || `${Platform.OS} Device`

			// Desactivar tokens antiguos de este dispositivo
			await supabase.from('push_tokens').update({ is_active: false }).eq('user_id', userId).eq('device_name', deviceName)

			// Insertar o actualizar el token actual
			const { error } = await supabase
				.from('push_tokens')
				.upsert(
					{
						user_id: userId,
						token,
						platform,
						device_name: deviceName,
						is_active: true,
						last_used_at: new Date().toISOString(),
					},
					{
						onConflict: 'user_id,token',
					},
				)
				.select()

			if (error) throw error

			// También actualizar el campo legacy push_token en profiles
			await supabase.from('profiles').update({ push_token: token }).eq('id', userId)

			console.log('Push token saved successfully')
		} catch (error) {
			console.error('Error saving push token:', error)
			throw error
		}
	},

	/**
	 * Elimina el push token del usuario (al cerrar sesión)
	 */
	async removePushToken(userId: string): Promise<void> {
		try {
			await supabase.from('push_tokens').update({ is_active: false }).eq('user_id', userId)

			await supabase.from('profiles').update({ push_token: null }).eq('id', userId)

			console.log('Push token removed successfully')
		} catch (error) {
			console.error('Error removing push token:', error)
			throw error
		}
	},

	/**
	 * Envía una notificación local (para testing o cuando no hay backend)
	 */
	async sendLocalNotification(config: PushNotificationConfig): Promise<void> {
		try {
			await Notifications.scheduleNotificationAsync({
				content: {
					title: config.title,
					body: config.body,
					data: config.data || {},
					sound: config.sound !== false,
					priority: config.priority || 'high',
				},
				trigger: null, // Inmediata
			})
		} catch (error) {
			console.error('Error sending local notification:', error)
		}
	},

	/**
	 * Programa una notificación local para más tarde
	 */
	async scheduleLocalNotification(config: PushNotificationConfig, triggerDate: Date): Promise<string> {
		try {
			const seconds = Math.max(0, Math.floor((triggerDate.getTime() - Date.now()) / 1000))

			const content = {
				title: config.title,
				body: config.body,
				data: config.data || {},
				sound: config.sound !== false,
				priority: config.priority || 'high',
			}

			if (seconds <= 0) {
				return await Notifications.scheduleNotificationAsync({ content, trigger: null })
			}

			let identifier: string
			try {
				// DATE fires at an absolute time — exact even in Doze mode.
				// Requires SCHEDULE_EXACT_ALARM (Android 12) or USE_EXACT_ALARM (Android 13+),
				// both declared in app.json. On Android 13+ the permission is auto-granted.
				identifier = await Notifications.scheduleNotificationAsync({
					content,
					trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
				})
			} catch {
				// Fallback for Android 12 if the user hasn't granted SCHEDULE_EXACT_ALARM yet.
				// Notification may arrive a few minutes late due to Doze mode coalescing.
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

	/**
	 * Programa recordatorios de partido (10 minutos antes)
	 */
	async scheduleMatchReminder(matchId: string, matchTitle: string, venueName: string, startsAt: Date): Promise<string | null> {
		try {
			const reminderTime = new Date(startsAt.getTime() - 11 * 60 * 1000) // 11 min antes para compensar ~1 min de delay del OS

			// Solo programar si es en el futuro
			if (reminderTime <= new Date()) {
				console.log('Match starts too soon to schedule reminder')
				return null
			}

			const identifier = await this.scheduleLocalNotification(
				{
					title: '⏰ Tu partido comienza pronto',
					body: `"${matchTitle}" en ${venueName} comienza en 10 minutos`,
					data: {
						match_id: matchId,
						type: 'match_reminder',
					},
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

	/**
	 * Cancela una notificación programada
	 */
	async cancelScheduledNotification(identifier: string): Promise<void> {
		try {
			await Notifications.cancelScheduledNotificationAsync(identifier)
		} catch (error) {
			console.error('Error cancelling notification:', error)
		}
	},

	/**
	 * Cancela todas las notificaciones programadas
	 */
	async cancelAllScheduledNotifications(): Promise<void> {
		try {
			await Notifications.cancelAllScheduledNotificationsAsync()
		} catch (error) {
			console.error('Error cancelling all notifications:', error)
		}
	},

	/**
	 * Obtiene el conteo de notificaciones del badge
	 */
	async getBadgeCount(): Promise<number> {
		try {
			const count = await Notifications.getBadgeCountAsync()
			return count
		} catch (error) {
			console.error('Error getting badge count:', error)
			return 0
		}
	},

	/**
	 * Establece el conteo del badge
	 */
	async setBadgeCount(count: number): Promise<void> {
		try {
			await Notifications.setBadgeCountAsync(count)
		} catch (error) {
			console.error('Error setting badge count:', error)
		}
	},

	/**
	 * Listener para cuando se recibe una notificación
	 */
	addNotificationReceivedListener(callback: (notification: Notifications.Notification) => void): ReturnType<typeof Notifications.addNotificationReceivedListener> {
		return Notifications.addNotificationReceivedListener(callback)
	},

	/**
	 * Listener para cuando el usuario toca una notificación
	 */
	addNotificationResponseReceivedListener(callback: (response: Notifications.NotificationResponse) => void): ReturnType<typeof Notifications.addNotificationResponseReceivedListener> {
		return Notifications.addNotificationResponseReceivedListener(callback)
	},

	/**
	 * Obtiene todas las notificaciones programadas
	 */
	async getAllScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
		try {
			return await Notifications.getAllScheduledNotificationsAsync()
		} catch (error) {
			console.error('Error getting scheduled notifications:', error)
			return []
		}
	},

	/**
	 * Verifica los permisos de notificaciones
	 */
	async checkPermissions(): Promise<boolean> {
		try {
			const { status } = await Notifications.getPermissionsAsync()
			return status === 'granted'
		} catch (error) {
			console.error('Error checking notification permissions:', error)
			return false
		}
	},

	/**
	 * Limpia las notificaciones de la bandeja del sistema
	 */
	async dismissAllNotifications(): Promise<void> {
		try {
			await Notifications.dismissAllNotificationsAsync()
		} catch (error) {
			console.error('Error dismissing notifications:', error)
		}
	},
}
