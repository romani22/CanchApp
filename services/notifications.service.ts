import { repositories } from '@/repositories'
import type { NotificationSettings } from '@/repositories/interfaces/INotificationRepository'
import type { SubscriptionHandle } from '@/repositories/types'
import type { Notification, NotificationType, NotificationWithData } from '@/types/database.types'

export const notificationsService = {
	async list(userId: string): Promise<NotificationWithData[]> {
		return repositories.notifications.list(userId)
	},

	async getUnread(userId: string): Promise<NotificationWithData[]> {
		return repositories.notifications.getUnread(userId)
	},

	async getUnreadCount(userId: string): Promise<number> {
		return repositories.notifications.getUnreadCount(userId)
	},

	async markAsRead(notificationId: string): Promise<void> {
		return repositories.notifications.markAsRead(notificationId)
	},

	async markAllAsRead(userId: string): Promise<void> {
		return repositories.notifications.markAllAsRead(userId)
	},

	async create(userId: string, type: NotificationType, title: string, body: string, data?: any): Promise<Notification> {
		return repositories.notifications.create(userId, type, title, body, data)
	},

	async delete(notificationId: string): Promise<void> {
		return repositories.notifications.delete(notificationId)
	},

	async deleteAll(userId: string): Promise<void> {
		return repositories.notifications.deleteAll(userId)
	},

	async getByType(userId: string, type: NotificationType): Promise<NotificationWithData[]> {
		return repositories.notifications.getByType(userId, type)
	},

	async updateSettings(userId: string, settings: Partial<NotificationSettings>): Promise<void> {
		return repositories.notifications.updateSettings(userId, settings)
	},

	async getSettings(userId: string) {
		return repositories.notifications.getSettings(userId)
	},

	async getStats(userId: string) {
		return repositories.notifications.getStats(userId)
	},

	/** Suscribirse solo a INSERT (API legada de un solo callback) */
	subscribe(userId: string, callback: (payload: unknown) => void) {
		return repositories.notifications.subscribe(userId, callback)
	},

	/** Suscribirse a INSERT y UPDATE en notificaciones del usuario */
	subscribeToChanges(
		userId: string,
		onInsert: (payload: unknown) => void,
		onUpdate: (payload: unknown) => void,
	): SubscriptionHandle {
		return repositories.notifications.subscribeToChanges(userId, onInsert, onUpdate)
	},
}
