import { supabase } from '@/lib/supabase'

export const matchParticipantsService = {
    join(matchId: string, userId: string) {
        return supabase.from('match_participants').insert({
            match_id: matchId,
            user_id: userId,
        })
    },

    leave(matchId: string, userId: string) {
        return supabase
            .from('match_participants')
            .delete()
            .eq('match_id', matchId)
            .eq('user_id', userId)
    },

    list(matchId: string) {
        return supabase
            .from('match_participants')
            .select('*, profiles(*)')
            .eq('match_id', matchId)
    },
}
