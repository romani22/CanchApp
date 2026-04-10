import { supabase } from '@/lib/supabase'
import { Notification, NotificationType, NotificationWithData } from '@/types/database.types'

export const notificationsService = {
	/**
	 * Listar notificaciones del usuario con datos relacionados
	 */
	async list(userId: string): Promise<NotificationWithData[]> {
		const { data, error } = await supabase
			.from('notifications')
			.select(
				`
        *,
        match:matches(*),
        user:profiles(*)
      `,
			)
			.eq('user_id', userId)
			.order('created_at', { ascending: false })

		if (error) throw error

		return (data as NotificationWithData[]) || []
	},

	/**
	 * Obtener notificaciones no leídas
	 */
	async getUnread(userId: string): Promise<NotificationWithData[]> {
		const { data, error } = await supabase
			.from('notifications')
			.select(
				`
        *,
        match:matches(*),
        user:profiles(*)
      `,
			)
			.eq('user_id', userId)
			.eq('is_read', false)
			.order('created_at', { ascending: false })

		if (error) throw error

		return (data as NotificationWithData[]) || []
	},

	/**
	 * Cantidad de no leídas
	 */
	async getUnreadCount(userId: string): Promise<number> {
		const { count, error } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false)

		if (error) throw error

		return count ?? 0
	},

	/**
	 * Marcar como leída
	 */
	async markAsRead(notificationId: string): Promise<void> {
		const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId)

		if (error) throw error
	},

	/**
	 * Marcar todas como leídas
	 */
	async markAllAsRead(userId: string): Promise<void> {
		const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false)

		if (error) throw error
	},

	/**
	 * Crear una notificación manualmente (normalmente se usa desde triggers)
	 */
	async create(userId: string, type: NotificationType, title: string, body: string, data?: any): Promise<Notification> {
		const { data: notification, error } = await supabase
			.from('notifications')
			.insert({
				user_id: userId,
				type,
				title,
				body,
				data: data || {},
				is_read: false,
			})
			.select()
			.single()

		if (error) throw error

		return notification
	},

	/**
	 * Eliminar una notificación
	 */
	async delete(notificationId: string): Promise<void> {
		const { error } = await supabase.from('notifications').delete().eq('id', notificationId)

		if (error) throw error
	},

	/**
	 * Eliminar todas las notificaciones de un usuario
	 */
	async deleteAll(userId: string): Promise<void> {
		const { error } = await supabase.from('notifications').delete().eq('user_id', userId)

		if (error) throw error
	},

	/**
	 * Obtener notificaciones por tipo
	 */
	async getByType(userId: string, type: NotificationType): Promise<NotificationWithData[]> {
		const { data, error } = await supabase
			.from('notifications')
			.select(
				`
        *,
        match:matches(*),
        user:profiles(*)
      `,
			)
			.eq('user_id', userId)
			.eq('type', type)
			.order('created_at', { ascending: false })

		if (error) throw error

		return (data as NotificationWithData[]) || []
	},

	/**
	 * Actualizar preferencias de notificaciones del usuario
	 */
	async updateSettings(
		userId: string,
		settings: {
			notifications_enabled?: boolean
			notification_radius?: number
			notify_new_matches?: boolean
			notify_join_requests?: boolean
			notify_request_response?: boolean
			notify_player_joined?: boolean
			notify_match_reminder?: boolean
		},
	): Promise<void> {
		const { error } = await supabase.from('profiles').update(settings).eq('id', userId)

		if (error) throw error
	},

	/**
	 * Obtener preferencias de notificaciones del usuario
	 */
	async getSettings(userId: string) {
		const { data, error } = await supabase
			.from('profiles')
			.select(
				`
        notifications_enabled,
        notification_radius,
        notify_new_matches,
        notify_join_requests,
        notify_request_response,
        notify_player_joined,
        notify_match_reminder
      `,
			)
			.eq('id', userId)
			.single()

		if (error) throw error

		return data
	},

	/**
	 * Suscribirse a cambios en notificaciones
	 */
	subscribe(userId: string, callback: (payload: any) => void) {
		return supabase
			.channel(`notifications:${userId}`)
			.on(
				'postgres_changes',
				{
					event: 'INSERT',
					schema: 'public',
					table: 'notifications',
					filter: `user_id=eq.${userId}`,
				},
				callback,
			)
			.subscribe()
	},

	/**
	 * Obtener estadísticas de notificaciones
	 */
	async getStats(userId: string) {
		const { data, error } = await supabase.from('notification_stats').select('*').eq('user_id', userId).single()

		if (error) {
			// Si no existe en la vista, calcular manualmente
			const { data: notifications } = await supabase.from('notifications').select('type, is_read').eq('user_id', userId)

			if (!notifications) {
				return {
					total_notifications: 0,
					unread_count: 0,
					new_matches: 0,
					join_requests: 0,
					accepted_requests: 0,
					rejected_requests: 0,
				}
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

		return data
	},
}
