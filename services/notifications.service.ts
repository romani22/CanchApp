import { supabase } from '@/lib/supabase'

export const notificationsService = {
	// 🔹 Listar notificaciones del usuario
	async list(userId: string) {
		return await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false })
	},

	// 🔹 Cantidad de no leídas
	async getUnreadCount(userId: string) {
		const { count, error } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false)

		return { count: count ?? 0, error }
	},

	// 🔹 Marcar como leída
	async markAsRead(notificationId: string) {
		return await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId)
	},

	// 🔹 Marcar todas como leídas
	async markAllAsRead(userId: string) {
		return await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false)
	},
}
