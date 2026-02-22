import { supabase } from '@/lib/supabase'
import { SportType } from '@/types/database.types'

export type UserStats = {
	user_id: string
	total_matches: number
	total_wins: number
	elo_rating: number
	rating: number
	rating_count: number
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
	async updateProfile(userId: string, data: Partial<any>) {
		const { data: updated, error } = await supabase.from('profiles').update(data).eq('id', userId).select().single()

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

		const updatedSports = [...currentSports, newSport]

		return await this.updateProfile(userId, {
			favorite_sports: updatedSports,
		})
	},

	// =============================
	// REMOVE FAVORITE SPORT
	// =============================
	async removeFavoriteSport(userId: string, currentSports: SportType[], sportToRemove: SportType) {
		const updatedSports = currentSports.filter((s) => s !== sportToRemove)

		return await this.updateProfile(userId, {
			favorite_sports: updatedSports,
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
