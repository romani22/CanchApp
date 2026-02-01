import { supabase } from '@/lib/supabase'

export const teamsService = {
    create(data: any) {
        return supabase.from('teams').insert(data)
    },

    addMember(teamId: string, userId: string) {
        return supabase.from('team_members').insert({
            team_id: teamId,
            user_id: userId,
        })
    },

    listByTournament(tournamentId: string) {
        return supabase
            .from('teams')
            .select(`
        *,
        members:team_members(
          *,
          user:profiles(*)
        )
      `)
            .eq('tournament_id', tournamentId)
    },
}
