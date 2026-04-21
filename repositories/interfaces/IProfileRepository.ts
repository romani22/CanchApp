import type { Profile, SportType } from '@/types/database.types'

export interface UserStats {
	user_id: string
	total_matches: number
	total_wins: number
	elo_rating: number
	rating: number
	rating_count: number
}

export interface IProfileRepository {
	getById(userId: string): Promise<Profile | null>
	update(userId: string, data: Partial<Profile>): Promise<Profile>
	listBySport(sport: SportType): Promise<Profile[]>
	getUserStats(userId: string): Promise<UserStats | null>
	searchByName(query: string, options?: { excludeUserId?: string; limit?: number }): Promise<Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'skill_level'>[]>
}
