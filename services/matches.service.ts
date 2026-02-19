import { supabase } from '@/lib/supabase'
import type { Match, SportType } from '@/types/database.types'

/**
 * 🎨 Modelo para la UI (lo que renderiza el componente)
 */
export interface MatchCard {
	id: string
	title: string
	sport: SportType
	location: string
	dateTime: string
	spotsLeft: number
	level: string
	isMixed: boolean
}

const mapMatchToCard = (match: Match): MatchCard => {
	const spotsLeft = match.total_players - match.current_players

	return {
		id: match.id,
		title: match.title,
		sport: match.sport,
		location: match.venue_name,
		dateTime: `${match.date} ${match.start_time}`,
		spotsLeft,
		level: match.skill_level,
		isMixed: match.is_mixed,
	}
}

export const matchesService = {
	list(filters?: { sport?: string; date?: string; status?: string }) {
		let query = supabase.from('matches').select('*')

		if (filters?.sport) query = query.eq('sport', filters.sport)
		if (filters?.date) query = query.eq('date', filters.date)
		if (filters?.status) query = query.eq('status', filters.status)

		return query.order('date', { ascending: true })
	},

	getById(matchId: string) {
		return supabase
			.from('matches')
			.select(
				`
					*,
					creator:profiles(*),
					participants:match_participants(
					*,
					user:profiles(*)
					)
				`,
			)
			.eq('id', matchId)
			.maybeSingle()
	},
	getJoined(userId: string) {
		return supabase
			.from('matches')
			.select(
				`
					*,
					creator:profiles(*),
					participants:match_participants(
					*,
					user:profiles(*)
					)
				`,
			)
			.contains('participants', { user_id: userId })
			.order('date', { ascending: true })
	},

	async getNextMatchForUser(userId: string) {
		const now = new Date().toISOString()

		const { data, error } = await supabase
			.from('matches')
			.select(
				`
				*,
				participants:match_participants!inner(user_id)
				`,
			)
			.eq('participants.user_id', userId)
			.gte('date', now)
			.order('date', { ascending: true })
			.limit(1)
			.maybeSingle()

		return { data, error }
	},

	async getRecommendedMatches(limit: number = 5): Promise<MatchCard[]> {
		const today = new Date().toISOString().split('T')[0]

		const { data, error } = await supabase.from('matches').select('*').eq('status', 'open').gte('date', today).order('date', { ascending: true }).limit(limit)
		if (error) {
			console.error('Error fetching recommended matches:', error)
			throw error
		}

		if (!data) return []

		return data.map(mapMatchToCard)
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
