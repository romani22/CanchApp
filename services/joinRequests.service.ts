import { supabase } from '@/lib/supabase'

export const joinRequestsService = {
    create(matchId: string, message?: string) {
        return supabase.from('join_requests').insert({
            match_id: matchId,
            message,
        })
    },

    listForMatch(matchId: string) {
        return supabase
            .from('join_requests')
            .select('*, user:profiles(*)')
            .eq('match_id', matchId)
            .order('created_at', { ascending: false })
    },

    updateStatus(requestId: string, status: 'accepted' | 'rejected') {
        return supabase
            .from('join_requests')
            .update({ status })
            .eq('id', requestId)
    },
}
