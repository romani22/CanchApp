import { supabase } from '@/lib/supabase'
import type { ITeamRepository } from '../interfaces/ITeamRepository'

export class SupabaseTeamRepository implements ITeamRepository {
	async create(data: Record<string, unknown>): Promise<{ error: Error | null }> {
		const { error } = await supabase.from('teams').insert(data)
		return { error: error ?? null }
	}

	async addMember(teamId: string, userId: string): Promise<{ error: Error | null }> {
		const { error } = await supabase.from('team_members').insert({ team_id: teamId, user_id: userId })
		return { error: error ?? null }
	}

	async listByTournament(tournamentId: string): Promise<{ data: unknown[] | null; error: Error | null }> {
		const { data, error } = await supabase
			.from('teams')
			.select('*, members:team_members(*, user:profiles(*))')
			.eq('tournament_id', tournamentId)
		return { data, error: error ?? null }
	}
}
