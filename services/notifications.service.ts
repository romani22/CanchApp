import { supabase } from '@/lib/supabase'

export const notificationsService = {
    list() {
        return supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
    },

    markAsRead(notificationId: string) {
        return supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId)
    },
}
