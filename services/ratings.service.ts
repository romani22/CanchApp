import { supabase } from '@/lib/supabase'

export const ratingsService = {
    rate(data: {
        match_id: string
        rated_user_id: string
        rating: number
        comment?: string
    }) {
        return supabase.from('match_ratings').insert(data)
    },

    listForUser(userId: string) {
        return supabase
            .from('match_ratings')
            .select('*')
            .eq('rated_user_id', userId)
    },
}
