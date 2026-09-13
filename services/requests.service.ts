import { repositories } from '@/repositories'
import type { SubscriptionHandle } from '@/repositories/types'
import type { JoinRequest, JoinRequestWithUser, MatchInvitation, TeamSlot } from '@/types/database.types'

export const requestsService = {
	async createJoin(matchId: string, userId: string, message?: string, teamSlot?: TeamSlot) {
		return repositories.joinRequests.create(matchId, userId, message, teamSlot)
	},

	/**
	 * El creador invita a un usuario registrado: queda pendiente hasta que acepte
	 * (027). Los invitados sin cuenta no pasan por acá — a esos los agrega
	 * matchParticipantsService.addGuest, porque no hay a quién avisarle.
	 */
	async invite(matchId: string, userId: string, invitedBy: string, teamSlot?: TeamSlot) {
		return repositories.joinRequests.invite(matchId, userId, invitedBy, teamSlot)
	},

	async getMine(matchId: string, userId: string): Promise<JoinRequest | null> {
		return repositories.joinRequests.getMine(matchId, userId)
	},

	async getMatch(matchId: string): Promise<JoinRequestWithUser[]> {
		return repositories.joinRequests.getForMatch(matchId)
	},

	/** Incluye las rechazadas: el creador necesita saber quién no va. */
	async getInvitations(matchId: string): Promise<MatchInvitation[]> {
		return repositories.joinRequests.getInvitations(matchId)
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

	/** Lo responde el invitado. accept/reject son del otro lado: los usa el creador. */
	async acceptInvitation(requestId: string) {
		return repositories.joinRequests.acceptInvitation(requestId)
	},

	async rejectInvitation(requestId: string) {
		return repositories.joinRequests.rejectInvitation(requestId)
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
