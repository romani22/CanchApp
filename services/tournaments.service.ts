import { supabase } from '@/lib/supabase'

export const tournamentsService = {
    list() {
        return supabase
            .from('tournaments')
            .select('*')
            .order('created_at', { ascending: false })
    },

    getById(id: string) {
        return supabase
            .from('tournaments')
            .select(`
        *,
        teams(*)
      `)
            .eq('id', id)
            .single()
    },

    create(data: any) {
        return supabase.from('tournaments').insert(data)
    },

    update(id: string, data: any) {
        return supabase.from('tournaments').update(data).eq('id', id)
    },
}
