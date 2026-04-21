import { supabase } from '@/lib/supabase'
import type { InsertMatch, Match, MatchListFilters, MatchUpdate, MatchWithCreator } from '@/types/database.types'
import { format } from 'date-fns'
import type { IMatchRepository } from '../interfaces/IMatchRepository'

// Fragmento reutilizable para participantes con skill_level incluido
const PARTICIPANTS_SELECT = `
	id,
	user_id,
	guest_name,
	joined_at,
	team_slot,
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

export class SupabaseMatchRepository implements IMatchRepository {
	async list(filters?: MatchListFilters): Promise<{ data: MatchWithCreator[] | null; error: Error | null }> {
		const now = new Date().toISOString()

		if (filters?.zone?.type === 'coordinates') {
			const { lng, lat, radiusKm } = filters.zone
			const { data: rpcData, error: rpcError } = await supabase.rpc('matches_near_location', {
				lng,
				lat,
				radius_meters: radiusKm * 1000,
			})
			if (rpcError) return { data: null, error: rpcError }

			const nearbyIds: string[] = (rpcData ?? []).map((m: { id: string }) => m.id).filter(Boolean)
			if (nearbyIds.length === 0) return { data: [], error: null }

			let query = supabase
				.from('matches')
				.select(`*, creator:profiles!matches_creator_id_fkey(*), participants:match_participants(${PARTICIPANTS_SELECT})`)
				.in('id', nearbyIds)
				.eq('status', 'open')
				.gte('starts_at', now)
				.order('starts_at', { ascending: true })

			if (filters.sport) query = query.eq('sport', filters.sport)

			const { data, error } = await query
			return { data: data as unknown as MatchWithCreator[] | null, error: error ?? null }
		}

		if (filters?.zone?.type === 'name') {
			let query = supabase
				.from('matches')
				.select(`*, creator:profiles!matches_creator_id_fkey(*), participants:match_participants(${PARTICIPANTS_SELECT})`)
				.eq('status', 'open')
				.gte('starts_at', now)
				.ilike('venue_zone', `%${filters.zone.zoneName}%`)
				.order('starts_at', { ascending: true })

			if (filters.sport) query = query.eq('sport', filters.sport)

			const { data, error } = await query
			return { data: data as unknown as MatchWithCreator[] | null, error: error ?? null }
		}

		let query = supabase
			.from('matches')
			.select(`*, creator:profiles!matches_creator_id_fkey(*), participants:match_participants(${PARTICIPANTS_SELECT})`)
			.eq('status', 'open')
			.gte('starts_at', now)

		if (filters?.sport) query = query.eq('sport', filters.sport)

		const { data, error } = await query.order('starts_at', { ascending: true })
		return { data: data as unknown as MatchWithCreator[] | null, error: error ?? null }
	}

	async getById(matchId: string): Promise<{ data: MatchWithCreator | null; error: Error | null }> {
		const { data, error } = await supabase
			.from('matches')
			.select(`*, creator:profiles!matches_creator_id_fkey(id, full_name, avatar_url, rating, elo_rating), participants:match_participants(${PARTICIPANTS_SELECT})`)
			.eq('id', matchId)
			.single()

		return { data: data as unknown as MatchWithCreator | null, error: error ?? null }
	}

	async getCreatedByUser(userId: string): Promise<{ data: MatchWithCreator[] | null; error: Error | null }> {
		const { data, error } = await supabase
			.from('matches')
			.select(`*, creator:profiles!matches_creator_id_fkey(*), winner:profiles!matches_winner_id_fkey(*), participants:match_participants(*, user:profiles(*))`)
			.eq('creator_id', userId)
			.order('starts_at', { ascending: true })

		return { data: data as unknown as MatchWithCreator[] | null, error: error ?? null }
	}

	async getJoined(userId: string): Promise<{ data: MatchWithCreator[] | null; error: Error | null }> {
		const { data, error } = await supabase
			.from('matches')
			.select(`*, creator:profiles!matches_creator_id_fkey(*), winner:profiles!matches_winner_id_fkey(*), participants:match_participants!inner(*, user:profiles(*))`)
			.eq('participants.user_id', userId)
			.order('starts_at', { ascending: true })

		return { data: data as unknown as MatchWithCreator[] | null, error: error ?? null }
	}

	async getRecommended(limit = 5): Promise<Match[]> {
		const now = new Date().toISOString()
		const { data, error } = await supabase.from('matches').select('*').eq('status', 'open').gte('starts_at', now).order('starts_at', { ascending: true }).limit(limit)
		if (error) throw error
		return data ?? []
	}

	async getNextForUser(userId: string): Promise<{ data: Match | null; error: null }> {
		const now = new Date().toISOString()
		const [{ data: created }, { data: joined }] = await Promise.all([
			supabase.from('matches').select('*').eq('creator_id', userId),
			supabase.from('matches').select(`*, match_participants!inner(user_id)`).eq('match_participants.user_id', userId),
		])

		const seen = new Set<string>()
		const upcoming = [...(created || []), ...(joined || [])]
			.filter((m) => {
				if (seen.has(m.id)) return false
				seen.add(m.id)
				return m.starts_at >= now && m.status !== 'cancelled'
			})
			.sort((a, b) => a.starts_at.localeCompare(b.starts_at))

		return { data: upcoming[0] ?? null, error: null }
	}

	async create(match: InsertMatch): Promise<Match> {
		const payload = serializeMatchCoords(match as Record<string, unknown>)
		const { data, error } = await supabase.from('matches').insert(payload).select().single()
		if (error) throw error
		return data
	}

	async update(matchId: string, data: MatchUpdate): Promise<void> {
		const payload = serializeMatchCoords(data as Record<string, unknown>)
		const { error } = await supabase.from('matches').update(payload).eq('id', matchId)
		if (error) throw error
	}

	async cancel(matchId: string): Promise<void> {
		const { error } = await supabase.from('matches').update({ status: 'cancelled' }).eq('id', matchId)
		if (error) throw error
	}

	async remove(matchId: string): Promise<void> {
		const { error } = await supabase.from('matches').delete().eq('id', matchId)
		if (error) throw error
	}
}
