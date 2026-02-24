import { supabase } from '@/lib/supabase'
import type { InsertMatch, Match, SportType } from '@/types/database.types'
import { format } from 'date-fns'

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
	list(filters?: { sport?: string }) {
		const now = new Date()

		const today = format(now, 'yyyy-MM-dd')
		const currentTime = format(now, 'HH:mm:ss')

		let query = supabase
			.from('matches')
			.select(
				`
			*,
			creator:profiles!matches_creator_id_fkey(*)
		`,
			)
			.eq('status', 'open')
			.or(`date.gt.${today},and(date.eq.${today},start_time.gte.${currentTime})`)

		if (filters?.sport) query = query.eq('sport', filters.sport)

		return query.order('date', { ascending: true }).order('start_time', { ascending: true })
	},
	async getById(matchId: string) {
		return supabase
			.from('matches')
			.select(
				`
				*,
				creator:profiles!matches_creator_id_fkey(
					id,
					full_name,
					avatar_url,
					rating,
					elo_rating
				),
				participants:match_participants(
					id,
					user_id,
					joined_at,
					user:profiles(
					id,
					full_name,
					avatar_url,
					rating,
					elo_rating
					)
				)
				`,
			)
			.eq('id', matchId)
			.single()
	},
	getCreatedByUser(userId: string) {
		return supabase
			.from('matches')
			.select(
				`
					*,
					creator:profiles!matches_creator_id_fkey(*),
					winner:profiles!matches_winner_id_fkey(*),
					participants:match_participants(
						*,
						user:profiles(*)
					)
					`,
			)
			.eq('creator_id', userId)
			.order('date', { ascending: true })
	},
	getJoined(userId: string) {
		return supabase
			.from('matches')
			.select(
				`
      *,
      creator:profiles!matches_creator_id_fkey(*),
      winner:profiles!matches_winner_id_fkey(*),
      participants:match_participants!inner(
        *,
        user:profiles(*)
      )
    `,
			)
			.eq('participants.user_id', userId)
			.order('date', { ascending: true })
	},

	async getRecommendedMatches(limit: number = 5): Promise<MatchCard[]> {
		const now = new Date()

		const today = format(now, 'yyyy-MM-dd')
		const currentTime = format(now, 'yyyy-MM-dd HH:mm:ss')

		const { data, error } = await supabase.from('matches').select('*').eq('status', 'open').or(`date.gt.${today},and(date.eq.${today},start_time.gte.${currentTime})`).order('date', { ascending: true }).order('start_time', { ascending: true }).limit(limit)

		if (error) {
			console.error(error)
			throw error
		}

		return (data || []).map(mapMatchToCard)
	},
	async getNextMatchForUser(userId: string) {
		const now = new Date()
		const today = format(now, 'yyyy-MM-dd')
		const currentTime = format(now, 'HH:mm:ss')

		// 1️⃣ Partidos creados por el usuario
		const createdQuery = supabase.from('matches').select('*').eq('creator_id', userId)

		// 2️⃣ Partidos donde es participante
		const joinedQuery = supabase
			.from('matches')
			.select(
				`
			*,
			match_participants!inner(user_id)
		`,
			)
			.eq('match_participants.user_id', userId)

		const [{ data: created }, { data: joined }] = await Promise.all([createdQuery, joinedQuery])

		// 3️⃣ Unimos resultados
		const allMatches = [...(created || []), ...(joined || [])]

		// 4️⃣ Filtramos fecha/hora en JS
		const upcoming = allMatches
			.filter((match) => {
				if (match.date > today) return true
				if (match.date === today && match.start_time >= currentTime) return true
				return false
			})
			.sort((a, b) => {
				if (a.date === b.date) return a.start_time.localeCompare(b.start_time)
				return a.date.localeCompare(b.date)
			})

		return {
			data: upcoming[0] ?? null,
			error: null,
		}
	},
	async create(match: InsertMatch): Promise<Match> {
		const { data, error } = await supabase.from('matches').insert(match).select().single()

		if (error) throw error

		return data
	},

	update(matchId: string, data: any) {
		return supabase.from('matches').update(data).eq('id', matchId)
	},

	remove(matchId: string) {
		return supabase.from('matches').delete().eq('id', matchId)
	},
}
