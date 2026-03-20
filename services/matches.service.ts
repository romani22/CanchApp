import { supabase } from '@/lib/supabase'
import type { InsertMatch, Match, SportType } from '@/types/database.types'
import { Database } from '@/types/database.types'
import { format } from 'date-fns'

type MatchUpdate = Database['public']['Tables']['matches']['Update']

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

const mapMatchToCard = (match: Match): MatchCard => ({
	id: match.id,
	title: match.title,
	sport: match.sport,
	location: match.venue_name,
	dateTime: format(new Date(match.starts_at), 'dd/MM/yyyy HH:mm'),
	spotsLeft: match.total_players - match.current_players,
	level: match.skill_level,
	isMixed: match.is_mixed,
})

// Fragmento reutilizable para participantes — incluye skill_level para el modal
const PARTICIPANTS_SELECT = `
	id,
	user_id,
	guest_name,
	joined_at,
	user:profiles(
		id,
		full_name,
		avatar_url,
		rating,
		elo_rating,
		skill_level
	)
`

/**
 * PostgreSQL POINT espera el formato string "(x,y)".
 * El cliente JS envía { x, y } que Supabase no puede convertir solo.
 * Esta función serializa venue_coordinates antes de cualquier insert/update.
 */
function serializeMatchCoords(data: Record<string, unknown>): Record<string, unknown> {
	const result = { ...data }
	if ('venue_coordinates' in result) {
		const coords = result.venue_coordinates as { x?: number; y?: number } | null | undefined
		if (coords?.x != null && coords?.y != null) {
			result.venue_coordinates = `(${coords.x},${coords.y})`
		} else {
			result.venue_coordinates = null
		}
	}
	return result
}

export type ZoneListFilter = { type: 'coordinates'; lng: number; lat: number; radiusKm: number } | { type: 'name'; zoneName: string }

export const matchesService = {
	/**
	 * Lista partidos abiertos y futuros.
	 *
	 * Filtros de zona:
	 * - type 'coordinates': usa la función RPC matches_near_location (PostGIS)
	 * - type 'name': filtra por venue_zone (texto, case-insensitive)
	 * - sin zona: devuelve todos
	 */
	async list(filters?: { sport?: SportType; zone?: ZoneListFilter }) {
		const now = new Date().toISOString()

		// ── Filtro por coordenadas via RPC ────────────────────────────────
		if (filters?.zone?.type === 'coordinates') {
			const { lng, lat, radiusKm } = filters.zone
			const { data, error } = await supabase.rpc('matches_near_location', {
				lng,
				lat,
				radius_meters: radiusKm * 1000,
			})

			if (error) return { data: null, error }

			// Los IDs de partidos cercanos — ahora buscamos con relaciones
			const nearbyIds: string[] = (data ?? []).map((m: { id: string }) => m.id).filter(Boolean)

			if (nearbyIds.length === 0) return { data: [], error: null }

			let query = supabase
				.from('matches')
				.select(
					`
					*,
					creator:profiles!matches_creator_id_fkey(*),
					participants:match_participants(${PARTICIPANTS_SELECT})
				`,
				)
				.in('id', nearbyIds)
				.eq('status', 'open')
				.gte('starts_at', now)
				.order('starts_at', { ascending: true })

			if (filters.sport) query = query.eq('sport', filters.sport)

			return query
		}

		// ── Filtro por nombre de localidad ────────────────────────────────
		if (filters?.zone?.type === 'name') {
			let query = supabase
				.from('matches')
				.select(
					`
					*,
					creator:profiles!matches_creator_id_fkey(*),
					participants:match_participants(${PARTICIPANTS_SELECT})
				`,
				)
				.eq('status', 'open')
				.gte('starts_at', now)
				.ilike('venue_zone', `%${filters.zone.zoneName}%`)
				.order('starts_at', { ascending: true })

			if (filters.sport) query = query.eq('sport', filters.sport)

			return query
		}

		// ── Sin filtro de zona — todos los partidos ───────────────────────
		let query = supabase
			.from('matches')
			.select(
				`
				*,
				creator:profiles!matches_creator_id_fkey(*),
				participants:match_participants(${PARTICIPANTS_SELECT})
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
				participants:match_participants(${PARTICIPANTS_SELECT})
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

	async getRecommendedMatches(limit = 5): Promise<MatchCard[]> {
		const now = new Date().toISOString()
		const { data, error } = await supabase.from('matches').select('*').eq('status', 'open').gte('starts_at', now).order('starts_at', { ascending: true }).limit(limit)
		if (error) throw error
		return (data || []).map(mapMatchToCard)
	},

	async getNextMatchForUser(userId: string) {
		const now = new Date().toISOString()
		const [{ data: created }, { data: joined }] = await Promise.all([supabase.from('matches').select('*').eq('creator_id', userId), supabase.from('matches').select(`*, match_participants!inner(user_id)`).eq('match_participants.user_id', userId)])

		const seen = new Set<string>()
		const upcoming = [...(created || []), ...(joined || [])]
			.filter((m) => {
				if (seen.has(m.id)) return false
				seen.add(m.id)
				return m.starts_at >= now
			})
			.sort((a, b) => a.starts_at.localeCompare(b.starts_at))

		return { data: upcoming[0] ?? null, error: null }
	},

	async create(match: InsertMatch): Promise<Match> {
		const payload = serializeMatchCoords(match as Record<string, unknown>)
		const { data, error } = await supabase.from('matches').insert(payload).select().single()
		if (error) throw error
		return data
	},

	update(matchId: string, data: MatchUpdate) {
		const payload = serializeMatchCoords(data as Record<string, unknown>)
		return supabase.from('matches').update(payload).eq('id', matchId)
	},

	remove(matchId: string) {
		return supabase.from('matches').delete().eq('id', matchId)
	},
}
