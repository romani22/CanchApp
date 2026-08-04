import { supabase } from '@/lib/supabase'
import type { MatchPlayerStat, MatchResult, MatchResultInput, MatchResultWithPlayers, SportStats, SportType } from '@/types/database.types'
import type { IMatchResultRepository } from '../interfaces/IMatchResultRepository'
import type { SubscriptionHandle } from '../types'

export class SupabaseMatchResultRepository implements IMatchResultRepository {
	async getByMatchId(matchId: string): Promise<MatchResultWithPlayers | null> {
		// Dos queries en paralelo en vez de un embedded select: las stats por jugador
		// se leen también solas (para el modal de participante), y así el shape que
		// devuelve cada una no depende de cómo PostgREST resuelva la relación.
		const [{ data: result, error: resultError }, { data: players, error: playersError }] = await Promise.all([
			supabase.from('match_results').select('*').eq('match_id', matchId).maybeSingle(),
			supabase.from('match_player_stats').select('*').eq('match_id', matchId).order('display_name'),
		])

		if (resultError) throw resultError
		if (playersError) throw playersError
		if (!result) return null

		return { ...(result as MatchResult), players: (players ?? []) as MatchPlayerStat[] }
	}

	async save(matchId: string, input: MatchResultInput): Promise<string> {
		const { data, error } = await supabase.rpc('save_match_result', {
			p_match_id: matchId,
			p_score_a: input.score_a ?? null,
			p_score_b: input.score_b ?? null,
			p_sets: input.sets ?? [],
			p_notes: input.notes ?? null,
			// Las métricas van como null cuando no se cargaron: en la base, null es
			// "no se cargó" y 0 es un cero de verdad.
			p_players: input.players.map((p) => ({
				user_id: p.user_id,
				display_name: p.display_name,
				outcome: p.outcome,
				goals: p.goals ?? null,
				assists: p.assists ?? null,
				saves: p.saves ?? null,
				points: p.points ?? null,
				extra: p.extra ?? {},
			})),
		})

		if (error) throw error
		return data as string
	}

	async remove(matchId: string): Promise<void> {
		const { error } = await supabase.rpc('delete_match_result', { p_match_id: matchId })
		if (error) throw error
	}

	async getMatchIdsWithResult(matchIds: string[]): Promise<Set<string>> {
		if (matchIds.length === 0) return new Set()

		const { data, error } = await supabase.from('match_results').select('match_id').in('match_id', matchIds)
		if (error) throw error
		return new Set((data ?? []).map((row) => row.match_id as string))
	}

	async getUserSportStats(userId: string): Promise<SportStats[]> {
		const { data, error } = await supabase.from('user_sport_stats').select('*').eq('user_id', userId)
		if (error) throw error
		return (data ?? []) as SportStats[]
	}

	async getUserStatsForSport(userId: string, sport: SportType): Promise<SportStats | null> {
		const { data, error } = await supabase.from('user_sport_stats').select('*').eq('user_id', userId).eq('sport', sport).maybeSingle()
		if (error) throw error
		return (data as SportStats) ?? null
	}

	async getStatsForUsers(userIds: string[], sport: SportType): Promise<Record<string, SportStats>> {
		if (userIds.length === 0) return {}

		const { data, error } = await supabase.from('user_sport_stats').select('*').in('user_id', userIds).eq('sport', sport)
		if (error) throw error

		return Object.fromEntries(((data ?? []) as SportStats[]).map((row) => [row.user_id, row]))
	}

	subscribe(matchId: string, callback: () => void): SubscriptionHandle {
		const channel = supabase
			.channel(`match_results:${matchId}`)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'match_results', filter: `match_id=eq.${matchId}` }, () => callback())
			.subscribe()

		return { unsubscribe: () => supabase.removeChannel(channel) }
	}
}
