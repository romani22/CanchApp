import { supabase } from '@/lib/supabase'
import type { InsertMatch, Match, SportType } from '@/types/database.types'
import { Database } from '@/types/database.types'
import { format } from 'date-fns'

type MatchUpdate = Database['public']['Tables']['matches']['Update']

/**
 * Modelo para la UI (lo que renderiza el componente)
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
		dateTime: format(new Date(match.starts_at), 'dd/MM/yyyy HH:mm'),
		spotsLeft,
		level: match.skill_level,
		isMixed: match.is_mixed,
	}
}

export const matchesService = {
	list(filters?: { sport?: string }) {
		// FIX: usar .toISOString() para que Supabase reciba UTC puro ("2025-03-15T12:00:00.000Z")
		// en vez de un objeto Date que React Native serializa con zona local ("GMT-0300")
		const now = new Date().toISOString()

		let query = supabase
			.from('matches')
			.select(
				`
				*,
				creator:profiles!matches_creator_id_fkey(*),
				participants:match_participants(
					id,
					user_id,
					guest_name,
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
			.eq('status', 'open')
			.gte('starts_at', now)

		if (filters?.sport) query = query.eq('sport', filters.sport)

		return query.order('starts_at', { ascending: true })
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
				guest_name,
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
			.order('starts_at', { ascending: true })
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
			.order('starts_at', { ascending: true })
	},

	async getRecommendedMatches(limit: number = 5): Promise<MatchCard[]> {
		const now = new Date().toISOString()
		const { data, error } = await supabase.from('matches').select('*').eq('status', 'open').gte('starts_at', now).order('starts_at', { ascending: true }).limit(limit)

		if (error) {
			console.error(error)
			throw error
		}

		return (data || []).map(mapMatchToCard)
	},

	async getNextMatchForUser(userId: string) {
		// FIX: usar .toISOString() también para el filtro JS posterior
		const now = new Date().toISOString()

		const createdQuery = supabase.from('matches').select('*').eq('creator_id', userId)

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

		// Deduplicar por id (el usuario puede ser creador Y participante del mismo partido)
		const seen = new Set<string>()
		const allMatches = [...(created || []), ...(joined || [])].filter((m) => {
			if (seen.has(m.id)) return false
			seen.add(m.id)
			return true
		})

		// Filtrar futuros y ordenar por más próximo
		const upcoming = allMatches.filter((match) => match.starts_at >= now).sort((a, b) => a.starts_at.localeCompare(b.starts_at))

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

	update(matchId: string, data: MatchUpdate) {
		return supabase.from('matches').update(data).eq('id', matchId)
	},

	remove(matchId: string) {
		return supabase.from('matches').delete().eq('id', matchId)
	},
}
