import { repositories } from '@/repositories'
import type { Profile, SportType } from '@/types/database.types'

export type { UserStats } from '@/repositories/interfaces/IProfileRepository'

export const profilesService = {
	async getById(userId: string) {
		return repositories.profiles.getById(userId)
	},

	async updateProfile(userId: string, data: Partial<Profile>) {
		return repositories.profiles.update(userId, data)
	},

	async listBySport(sport: SportType) {
		return repositories.profiles.listBySport(sport)
	},

	async addFavoriteSport(userId: string, currentSports: SportType[], newSport: SportType) {
		if (currentSports.includes(newSport)) return currentSports
		return repositories.profiles.update(userId, { favorite_sports: [...currentSports, newSport] })
	},

	async removeFavoriteSport(userId: string, currentSports: SportType[], sportToRemove: SportType) {
		return repositories.profiles.update(userId, { favorite_sports: currentSports.filter((s) => s !== sportToRemove) })
	},

	async getUserStats(userId: string) {
		return repositories.profiles.getUserStats(userId)
	},

	async searchByName(query: string, options?: { excludeUserId?: string; limit?: number }) {
		return repositories.profiles.searchByName(query, options)
	},
}
