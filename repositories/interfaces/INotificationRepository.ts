import type { Notification, NotificationSettings, NotificationType, NotificationWithData } from '@/types/database.types'
import type { SubscriptionHandle } from '../types'

export type { NotificationSettings }

export interface INotificationRepository {
	list(userId: string): Promise<NotificationWithData[]>
	getUnread(userId: string): Promise<NotificationWithData[]>
	getUnreadCount(userId: string): Promise<number>
	markAsRead(notificationId: string): Promise<void>
	markAllAsRead(userId: string): Promise<void>
	create(userId: string, type: NotificationType, title: string, body: string, data?: Record<string, unknown>): Promise<Notification>
	delete(notificationId: string): Promise<void>
	deleteAll(userId: string): Promise<void>
	getByType(userId: string, type: NotificationType): Promise<NotificationWithData[]>
	updateSettings(userId: string, settings: Partial<NotificationSettings>): Promise<void>
	getSettings(userId: string): Promise<NotificationSettings | null>
	getStats(userId: string): Promise<{
		total_notifications: number
		unread_count: number
		new_matches: number
		join_requests: number
		accepted_requests: number
		rejected_requests: number
	}>
	/** Subscribes to INSERT events only (legacy single-callback API) */
	subscribe(userId: string, callback: (payload: unknown) => void): SubscriptionHandle
	/** Subscribes to INSERT and UPDATE events on the notifications table for a user */
	subscribeToChanges(
		userId: string,
		onInsert: (payload: unknown) => void,
		onUpdate: (payload: unknown) => void,
	): SubscriptionHandle
}
