import { repositories } from '@/repositories'
import type { Profile, SkillLevel, SportLevels, SportType } from '@/types/database.types'

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

	/**
	 * Agrega un deporte al perfil con su nivel, o actualiza el nivel si ya estaba.
	 * Reemplaza a addFavoriteSport: ahora sumar un deporte exige decir con qué nivel.
	 */
	async setSportLevel(userId: string, currentLevels: SportLevels, sport: SportType, level: SkillLevel) {
		return repositories.profiles.update(userId, { sport_levels: { ...currentLevels, [sport]: level } })
	},

	/** Quita un deporte del perfil. Reemplaza a removeFavoriteSport. */
	async removeSport(userId: string, currentLevels: SportLevels, sportToRemove: SportType) {
		const { [sportToRemove]: _removed, ...rest } = currentLevels
		return repositories.profiles.update(userId, { sport_levels: rest })
	},

	async getUserStats(userId: string) {
		return repositories.profiles.getUserStats(userId)
	},

	async searchByName(query: string, options?: { excludeUserId?: string; limit?: number }) {
		return repositories.profiles.searchByName(query, options)
	},
}
