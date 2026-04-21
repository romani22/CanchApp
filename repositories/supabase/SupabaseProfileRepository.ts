import { supabase } from '@/lib/supabase'
import type { Profile, SportType } from '@/types/database.types'
import type { IProfileRepository, UserStats } from '../interfaces/IProfileRepository'

/**
 * PostgreSQL POINT espera el formato string "(x,y)".
 * El cliente JS envía objetos { x, y } que Supabase no puede convertir solo.
 */
function serializeCoords(data: Partial<Profile>): Record<string, unknown> {
	const result: Record<string, unknown> = { ...data }
	if ('zone_coordinates' in result) {
		const coords = result.zone_coordinates as { x?: number; y?: number } | null
		if (coords?.x != null && coords?.y != null) {
			result.zone_coordinates = `(${coords.x},${coords.y})`
		} else {
			result.zone_coordinates = null
		}
	}
	return result
}

export class SupabaseProfileRepository implements IProfileRepository {
	async getById(userId: string): Promise<Profile | null> {
		const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
		if (error) throw error
		return data
	}

	async update(userId: string, data: Partial<Profile>): Promise<Profile> {
		const payload = serializeCoords(data)
		const { data: updated, error } = await supabase.from('profiles').update(payload).eq('id', userId).select().single()
		if (error) throw error
		return updated
	}

	async listBySport(sport: SportType): Promise<Profile[]> {
		const { data, error } = await supabase.from('profiles').select('*').contains('favorite_sports', [sport])
		if (error) throw error
		return data ?? []
	}

	async getUserStats(userId: string): Promise<UserStats | null> {
		const { data, error } = await supabase.from('user_stats').select('*').eq('user_id', userId).maybeSingle()
		if (error) throw error
		return data
	}

	async searchByName(
		query: string,
		options?: { excludeUserId?: string; limit?: number },
	): Promise<Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'skill_level'>[]> {
		if (query.trim().length < 2) return []

		let q = supabase
			.from('profiles')
			.select('id, full_name, avatar_url, skill_level')
			.ilike('full_name', `%${query.trim()}%`)
			.limit(options?.limit ?? 10)

		if (options?.excludeUserId) {
			q = q.neq('id', options.excludeUserId)
		}

		const { data, error } = await q
		if (error) throw error
		return data ?? []
	}
}
