import { supabase } from '@/lib/supabase'
import { Profile, SportType } from '@/types/database.types'

export type UserStats = {
	user_id: string
	total_matches: number
	total_wins: number
	elo_rating: number
	rating: number
	rating_count: number
}

/**
 * PostgreSQL POINT espera el formato string "(x,y)".
 * El cliente JS envía objetos { x, y } que Supabase no puede convertir solo.
 * Esta función serializa las coordenadas antes de cualquier insert/update.
 */
function serializeCoords(data: Partial<Profile>): Record<string, unknown> {
	const result: Record<string, unknown> = { ...data }

	if ('zone_coordinates' in result && result.zone_coordinates != null) {
		const coords = result.zone_coordinates as { x: number; y: number }
		// Formato que acepta PostgreSQL POINT: "(longitud,latitud)"
		result.zone_coordinates = `(${coords.x},${coords.y})` as any
	}

	return result
}

export const profilesService = {
	// =============================
	// GET PROFILE
	// =============================
	async getById(userId: string) {
		const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()

		if (error) throw error
		return data
	},

	// =============================
	// UPDATE PROFILE
	// =============================
	async updateProfile(userId: string, data: Partial<Profile>) {
		const payload = serializeCoords(data)

		const { data: updated, error } = await supabase.from('profiles').update(payload).eq('id', userId).select().single()

		if (error) throw error
		return updated
	},

	// =============================
	// LIST BY SPORT
	// =============================
	async listBySport(sport: SportType) {
		const { data, error } = await supabase.from('profiles').select('*').contains('favorite_sports', [sport])

		if (error) throw error
		return data
	},

	// =============================
	// ADD FAVORITE SPORT
	// =============================
	async addFavoriteSport(userId: string, currentSports: SportType[], newSport: SportType) {
		if (currentSports.includes(newSport)) {
			return currentSports
		}

		return await this.updateProfile(userId, {
			favorite_sports: [...currentSports, newSport],
		})
	},

	// =============================
	// REMOVE FAVORITE SPORT
	// =============================
	async removeFavoriteSport(userId: string, currentSports: SportType[], sportToRemove: SportType) {
		return await this.updateProfile(userId, {
			favorite_sports: currentSports.filter((s) => s !== sportToRemove),
		})
	},

	// =============================
	// USER STATS
	// =============================
	async getUserStats(userId: string): Promise<UserStats | null> {
		const { data, error } = await supabase.from('user_stats').select('*').eq('user_id', userId).maybeSingle()

		if (error) throw error
		return data
	},
}
