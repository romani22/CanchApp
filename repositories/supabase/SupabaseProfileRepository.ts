import { supabase } from '@/lib/supabase'
import type { Profile, SportType } from '@/types/database.types'
import { parseRowPoints, parseRowsPoints, serializePoint } from '../coords'
import type { IProfileRepository, UserStats } from '../interfaces/IProfileRepository'

/** PostgreSQL POINT espera el string "(x,y)"; el cliente trabaja con { x, y }. */
function serializeCoords(data: Partial<Profile>): Record<string, unknown> {
	const result: Record<string, unknown> = { ...data }
	if ('zone_coordinates' in result) {
		result.zone_coordinates = serializePoint(result.zone_coordinates)
	}
	return result
}

export class SupabaseProfileRepository implements IProfileRepository {
	async getById(userId: string): Promise<Profile | null> {
		const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
		if (error) throw error
		return parseRowPoints(data, 'zone_coordinates')
	}

	async update(userId: string, data: Partial<Profile>): Promise<Profile> {
		const payload = serializeCoords(data)
		const { data: updated, error } = await supabase.from('profiles').update(payload).eq('id', userId).select().single()
		if (error) throw error
		// Normalizar también la fila devuelta: si el llamador la reenvía a otro
		// update, el string crudo se serializaría a NULL y borraría las coordenadas.
		return parseRowPoints(updated, 'zone_coordinates') as Profile
	}

	async listBySport(sport: SportType): Promise<Profile[]> {
		// "juega este deporte" = la clave existe en el mapa. Reemplaza al viejo
		// .contains('favorite_sports', [sport]).
		//
		// No se usa .contains() acá: la contención JSONB compara clave Y valor, así
		// que {"padel": null} no matchearía {"padel": "avanzado"}. Con el selector
		// -> alcanza con que la clave esté presente, sea cual sea el nivel.
		const { data, error } = await supabase.from('profiles').select('*').not(`sport_levels->${sport}`, 'is', null)
		if (error) throw error
		return parseRowsPoints(data, 'zone_coordinates')
	}

	async getUserStats(userId: string): Promise<UserStats | null> {
		const { data, error } = await supabase.from('user_stats').select('*').eq('user_id', userId).maybeSingle()
		if (error) throw error
		return data
	}

	async searchByName(
		query: string,
		options?: { excludeUserId?: string; limit?: number },
	): Promise<Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'sport_levels'>[]> {
		if (query.trim().length < 2) return []

		let q = supabase
			.from('profiles')
			.select('id, full_name, avatar_url, sport_levels')
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
