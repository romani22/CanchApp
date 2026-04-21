import { supabase } from '@/lib/supabase'
import type { MatchRating } from '@/types/database.types'
import type { IRatingRepository, RateInput } from '../interfaces/IRatingRepository'

export class SupabaseRatingRepository implements IRatingRepository {
	async rate(data: RateInput): Promise<{ error: Error | null }> {
		const { error } = await supabase.from('match_ratings').insert(data)
		return { error: error ?? null }
	}

	async listForUser(userId: string): Promise<{ data: MatchRating[] | null; error: Error | null }> {
		const { data, error } = await supabase.from('match_ratings').select('*').eq('rated_user_id', userId)
		return { data, error: error ?? null }
	}
}
