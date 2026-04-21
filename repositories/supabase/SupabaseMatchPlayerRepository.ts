import { supabase } from '@/lib/supabase'
import type { MatchPlayer, MatchPlayerWithUser, Profile, TeamSlot } from '@/types/database.types'
import type { AddMultiplePlayersResult, AddPlayerInput, IMatchPlayerRepository } from '../interfaces/IMatchPlayerRepository'
import type { SubscriptionHandle } from '../types'

const normalizeSearchQuery = (query: string) => query.trim().replace(/[%_\\]/g, '\\$&')
const normalizeSearchLimit = (limit: number) => Math.max(1, Math.min(limit, 10))

export class SupabaseMatchPlayerRepository implements IMatchPlayerRepository {
	async add(matchId: string, addedByUserId: string, player: AddPlayerInput): Promise<MatchPlayer> {
		const { data: match, error: matchError } = await supabase.from('matches').select('current_players, total_players, status').eq('id', matchId).single()
		if (matchError) throw matchError

		if (match.status === 'full' || match.current_players >= match.total_players) {
			throw new Error('El partido está lleno')
		}

		if (player.user_id) {
			const { data: existingPlayer } = await supabase.from('match_players').select('id').eq('match_id', matchId).eq('user_id', player.user_id).maybeSingle()
			if (existingPlayer) throw new Error('Este usuario ya está en el partido')

			const { data: existingParticipant } = await supabase.from('match_participants').select('id').eq('match_id', matchId).eq('user_id', player.user_id).maybeSingle()
			if (existingParticipant) throw new Error('Este usuario ya es participante del partido')
		}

		const { data, error } = await supabase
			.from('match_players')
			.insert({
				match_id: matchId,
				added_by_user_id: addedByUserId,
				user_id: player.user_id,
				player_name: player.player_name,
				team_slot: player.team_slot,
			})
			.select()
			.single()

		if (error) throw error
		return data
	}

	async addMultiple(matchId: string, addedByUserId: string, players: AddPlayerInput[]): Promise<AddMultiplePlayersResult[]> {
		const { data, error } = await supabase.rpc('add_multiple_players', {
			p_match_id: matchId,
			p_added_by_user_id: addedByUserId,
			p_players: players,
		})
		if (error) throw error
		return data as AddMultiplePlayersResult[]
	}

	async getForMatch(matchId: string): Promise<MatchPlayerWithUser[]> {
		const { data, error } = await supabase
			.from('match_players')
			.select('*, user:profiles!match_players_user_id_fkey(*), added_by:profiles!match_players_added_by_user_id_fkey(*)')
			.eq('match_id', matchId)
			.order('created_at', { ascending: true })
		if (error) throw error
		return (data as MatchPlayerWithUser[]) ?? []
	}

	async getByUser(matchId: string, userId: string): Promise<MatchPlayerWithUser[]> {
		const { data, error } = await supabase
			.from('match_players')
			.select('*, user:profiles!match_players_user_id_fkey(*), added_by:profiles!match_players_added_by_user_id_fkey(*)')
			.eq('match_id', matchId)
			.eq('added_by_user_id', userId)
			.order('created_at', { ascending: true })
		if (error) throw error
		return (data as MatchPlayerWithUser[]) ?? []
	}

	async remove(playerId: string): Promise<boolean> {
		const { data, error } = await supabase.rpc('remove_match_player', { p_player_id: playerId })
		if (error) throw error
		return data as boolean
	}

	async updateTeam(playerId: string, teamSlot: TeamSlot | null): Promise<void> {
		const { error } = await supabase.from('match_players').update({ team_slot: teamSlot }).eq('id', playerId)
		if (error) throw error
	}

	async canAddMore(matchId: string): Promise<{ canAdd: boolean; remaining: number }> {
		const { data: match, error } = await supabase.from('matches').select('current_players, total_players, status').eq('id', matchId).single()
		if (error) return { canAdd: false, remaining: 0 }
		const remaining = match.total_players - match.current_players
		return { canAdd: match.status === 'open' && remaining > 0, remaining }
	}

	async searchUsers(query: string, options?: { excludeUserId?: string; limit?: number }): Promise<Profile[]> {
		if (query.trim().length < 2) return []
		const safeQuery = normalizeSearchQuery(query)
		let q = supabase
			.from('profiles')
			.select('id, full_name, avatar_url, email, skill_level')
			.or(`full_name.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%`)
			.limit(normalizeSearchLimit(options?.limit ?? 10))

		if (options?.excludeUserId) {
			q = q.neq('id', options.excludeUserId)
		}

		const { data, error } = await q
		if (error) throw error
		return (data ?? []) as Profile[]
	}

	async getStats(matchId: string): Promise<{ total: number; registered: number; guests: number; byTeam: { A: number; B: number; none: number } }> {
		const { data, error } = await supabase.from('match_players').select('user_id, team_slot').eq('match_id', matchId)
		if (error) return { total: 0, registered: 0, guests: 0, byTeam: { A: 0, B: 0, none: 0 } }

		return {
			total: data.length,
			registered: data.filter((p) => p.user_id !== null).length,
			guests: data.filter((p) => p.user_id === null).length,
			byTeam: {
				A: data.filter((p) => p.team_slot === 'A').length,
				B: data.filter((p) => p.team_slot === 'B').length,
				none: data.filter((p) => p.team_slot === null).length,
			},
		}
	}

	subscribe(matchId: string, callback: (payload: unknown) => void): SubscriptionHandle {
		const channel = supabase
			.channel(`match_players:${matchId}`)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'match_players', filter: `match_id=eq.${matchId}` }, callback)
			.subscribe()

		return { unsubscribe: () => supabase.removeChannel(channel) }
	}
}
