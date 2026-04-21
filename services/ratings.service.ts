import { repositories } from '@/repositories'
import type { RateInput } from '@/repositories/interfaces/IRatingRepository'

export const ratingsService = {
	rate(data: RateInput) {
		return repositories.ratings.rate(data)
	},

	listForUser(userId: string) {
		return repositories.ratings.listForUser(userId)
	},
}
