import { repositories } from '@/repositories'
import type { SubscriptionHandle } from '@/repositories/types'
import type { MatchResultInput, MatchResultVote, MatchResultWithPlayers, SportStats, SportType } from '@/types/database.types'

export const matchResultsService = {
	async getByMatchId(matchId: string): Promise<MatchResultWithPlayers | null> {
		return repositories.matchResults.getByMatchId(matchId)
	},

	async save(matchId: string, input: MatchResultInput): Promise<string> {
		return repositories.matchResults.save(matchId, input)
	},

	async remove(matchId: string): Promise<void> {
		return repositories.matchResults.remove(matchId)
	},

	async vote(matchId: string, vote: MatchResultVote, comment?: string): Promise<void> {
		return repositories.matchResults.vote(matchId, vote, comment)
	},

	async clearVote(matchId: string): Promise<void> {
		return repositories.matchResults.clearVote(matchId)
	},

	async getMatchIdsWithResult(matchIds: string[]): Promise<Set<string>> {
		return repositories.matchResults.getMatchIdsWithResult(matchIds)
	},

	async getUserSportStats(userId: string): Promise<SportStats[]> {
		return repositories.matchResults.getUserSportStats(userId)
	},

	async getUserStatsForSport(userId: string, sport: SportType): Promise<SportStats | null> {
		return repositories.matchResults.getUserStatsForSport(userId, sport)
	},

	async getStatsForUsers(userIds: string[], sport: SportType): Promise<Record<string, SportStats>> {
		return repositories.matchResults.getStatsForUsers(userIds, sport)
	},

	subscribe(matchId: string, callback: () => void): SubscriptionHandle {
		return repositories.matchResults.subscribe(matchId, callback)
	},
}
