import type { MatchRating } from '@/types/database.types'

export interface RateInput {
	match_id: string
	rated_user_id: string
	rating: number
	comment?: string
}

export interface IRatingRepository {
	rate(data: RateInput): Promise<{ error: Error | null }>
	listForUser(userId: string): Promise<{ data: MatchRating[] | null; error: Error | null }>
}
