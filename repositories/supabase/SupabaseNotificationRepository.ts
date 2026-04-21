import { supabase } from '@/lib/supabase'
import type { Notification, NotificationType, NotificationWithData } from '@/types/database.types'
import type { INotificationRepository, NotificationSettings } from '../interfaces/INotificationRepository'
import type { SubscriptionHandle } from '../types'

// notifications no tiene FK hacia matches (el match_id vive en el campo JSONB `data`).
// Los campos match/user de NotificationWithData son opcionales; se dejan como undefined.
const WITH_RELATIONS = '*'

export class SupabaseNotificationRepository implements INotificationRepository {
	async list(userId: string): Promise<NotificationWithData[]> {
		const { data, error } = await supabase.from('notifications').select(WITH_RELATIONS).eq('user_id', userId).order('created_at', { ascending: false })
		if (error) throw error
		return (data as NotificationWithData[]) ?? []
	}

	async getUnread(userId: string): Promise<NotificationWithData[]> {
		const { data, error } = await supabase.from('notifications').select(WITH_RELATIONS).eq('user_id', userId).eq('is_read', false).order('created_at', { ascending: false })
		if (error) throw error
		return (data as NotificationWithData[]) ?? []
	}

	async getUnreadCount(userId: string): Promise<number> {
		const { count, error } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false)
		if (error) throw error
		return count ?? 0
	}

	async markAsRead(notificationId: string): Promise<void> {
		const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId)
		if (error) throw error
	}

	async markAllAsRead(userId: string): Promise<void> {
		const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false)
		if (error) throw error
	}

	async create(userId: string, type: NotificationType, title: string, body: string, data?: Record<string, unknown>): Promise<Notification> {
		const { data: notification, error } = await supabase
			.from('notifications')
			.insert({ user_id: userId, type, title, body, data: data ?? {}, is_read: false })
			.select()
			.single()
		if (error) throw error
		return notification
	}

	async delete(notificationId: string): Promise<void> {
		const { error } = await supabase.from('notifications').delete().eq('id', notificationId)
		if (error) throw error
	}

	async deleteAll(userId: string): Promise<void> {
		const { error } = await supabase.from('notifications').delete().eq('user_id', userId)
		if (error) throw error
	}

	async getByType(userId: string, type: NotificationType): Promise<NotificationWithData[]> {
		const { data, error } = await supabase.from('notifications').select(WITH_RELATIONS).eq('user_id', userId).eq('type', type).order('created_at', { ascending: false })
		if (error) throw error
		return (data as NotificationWithData[]) ?? []
	}

	async updateSettings(userId: string, settings: Partial<NotificationSettings>): Promise<void> {
		const { error } = await supabase.from('profiles').update(settings).eq('id', userId)
		if (error) throw error
	}

	async getSettings(userId: string): Promise<NotificationSettings | null> {
		const { data, error } = await supabase
			.from('profiles')
			.select('notifications_enabled, notification_radius, notify_new_matches, notify_join_requests, notify_request_response, notify_player_joined, notify_match_reminder')
			.eq('id', userId)
			.single()
		if (error) throw error
		return data
	}

	async getStats(userId: string) {
		const { data, error } = await supabase.from('notification_stats').select('*').eq('user_id', userId).single()

		if (!error) return data

		// Fallback: calcular manualmente si la vista no existe
		const { data: notifications } = await supabase.from('notifications').select('type, is_read').eq('user_id', userId)

		if (!notifications) {
			return { total_notifications: 0, unread_count: 0, new_matches: 0, join_requests: 0, accepted_requests: 0, rejected_requests: 0 }
		}

		return {
			total_notifications: notifications.length,
			unread_count: notifications.filter((n) => !n.is_read).length,
			new_matches: notifications.filter((n) => n.type === 'new_match').length,
			join_requests: notifications.filter((n) => n.type === 'join_request').length,
			accepted_requests: notifications.filter((n) => n.type === 'request_accepted').length,
			rejected_requests: notifications.filter((n) => n.type === 'request_rejected').length,
		}
	}

	subscribe(userId: string, callback: (payload: unknown) => void): SubscriptionHandle {
		const channel = supabase
			.channel(`notifications:${userId}`)
			.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, callback)
			.subscribe()

		return { unsubscribe: () => supabase.removeChannel(channel) }
	}

	subscribeToChanges(userId: string, onInsert: (payload: unknown) => void, onUpdate: (payload: unknown) => void): SubscriptionHandle {
		const channel = supabase
			.channel(`notifications-${userId}`)
			.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, onInsert)
			.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, onUpdate)
			.subscribe()

		return { unsubscribe: () => supabase.removeChannel(channel) }
	}
}
