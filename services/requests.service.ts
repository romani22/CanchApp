import { repositories } from '@/repositories'
import type { SubscriptionHandle } from '@/repositories/types'
import type { JoinRequest, JoinRequestWithUser, TeamSlot } from '@/types/database.types'

export const requestsService = {
	async createJoin(matchId: string, userId: string, message?: string, teamSlot?: TeamSlot) {
		return repositories.joinRequests.create(matchId, userId, message, teamSlot)
	},

	async getMine(matchId: string, userId: string): Promise<JoinRequest | null> {
		return repositories.joinRequests.getMine(matchId, userId)
	},

	async getMatch(matchId: string): Promise<JoinRequestWithUser[]> {
		return repositories.joinRequests.getForMatch(matchId)
	},

	async getCreatorPending(userId: string): Promise<JoinRequestWithUser[]> {
		return repositories.joinRequests.getCreatorPending(userId)
	},

	async getUser(userId: string): Promise<JoinRequestWithUser[]> {
		return repositories.joinRequests.getUser(userId)
	},

	async accept(requestId: string) {
		return repositories.joinRequests.accept(requestId)
	},

	async reject(requestId: string) {
		return repositories.joinRequests.reject(requestId)
	},

	async cancel(requestId: string) {
		return repositories.joinRequests.cancel(requestId)
	},

	async leaveMatch(matchId: string, userId: string) {
		return repositories.joinRequests.leaveMatch(matchId, userId)
	},

	subscribe(matchId: string, callback: (payload: { eventType: string; request: JoinRequest }) => void): SubscriptionHandle {
		return repositories.joinRequests.subscribe(matchId, callback)
	},
}
