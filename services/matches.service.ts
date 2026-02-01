import { supabase } from '@/lib/supabase'

export const matchesService = {
  list(filters?: {
    sport?: string
    date?: string
    status?: string
  }) {
    let query = supabase.from('matches').select('*')

    if (filters?.sport) query = query.eq('sport', filters.sport)
    if (filters?.date) query = query.eq('date', filters.date)
    if (filters?.status) query = query.eq('status', filters.status)

    return query.order('date', { ascending: true })
  },

  getById(matchId: string) {
    return supabase
        .from('matches')
        .select(`
        *,
        creator:profiles(*),
        participants:match_participants(
          *,
          user:profiles(*)
        )
      `)
        .eq('id', matchId)
        .single()
  },

  create(data: any) {
    return supabase.from('matches').insert(data)
  },

  update(matchId: string, data: any) {
    return supabase.from('matches').update(data).eq('id', matchId)
  },

  remove(matchId: string) {
    return supabase.from('matches').delete().eq('id', matchId)
  },
}
