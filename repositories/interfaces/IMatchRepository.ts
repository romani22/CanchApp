import type { InsertMatch, Match, MatchListFilters, MatchUpdate, MatchWithCreator } from '@/types/database.types'

export interface IMatchRepository {
	list(filters?: MatchListFilters): Promise<{ data: MatchWithCreator[] | null; error: Error | null }>
	getById(matchId: string): Promise<{ data: MatchWithCreator | null; error: Error | null }>
	getCreatedByUser(userId: string): Promise<{ data: MatchWithCreator[] | null; error: Error | null }>
	getJoined(userId: string): Promise<{ data: MatchWithCreator[] | null; error: Error | null }>
	getRecommended(limit?: number): Promise<Match[]>
	getNextForUser(userId: string): Promise<{ data: Match | null; error: null }>
	create(match: InsertMatch): Promise<Match>
	update(matchId: string, data: MatchUpdate): Promise<void>
	cancel(matchId: string): Promise<void>
	remove(matchId: string): Promise<void>
}
