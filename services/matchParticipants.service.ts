import { repositories } from '@/repositories'
import type { SubscriptionHandle } from '@/repositories/types'
import type { Guest, TeamSlot } from '@/types/database.types'

export const matchParticipantsService = {
	async join(matchId: string, userId: string, teamSlot?: TeamSlot) {
		return repositories.matchParticipants.join(matchId, userId, teamSlot)
	},

	async assignTeam(participantId: string, teamSlot: TeamSlot | null) {
		return repositories.matchParticipants.assignTeam(participantId, teamSlot)
	},

	async assignTeamBulk(matchId: string, assignments: { participantId: string; teamSlot: TeamSlot | null }[]) {
		return repositories.matchParticipants.assignTeamBulk(matchId, assignments)
	},

	async clearAllTeamSlots(matchId: string) {
		return repositories.matchParticipants.clearAllTeamSlots(matchId)
	},

	async addGuest(matchId: string, guestName: Guest['name'], teamSlot?: TeamSlot) {
		return repositories.matchParticipants.addGuest(matchId, guestName, teamSlot)
	},

	async leave(matchId: string, userId: string) {
		return repositories.matchParticipants.leave(matchId, userId)
	},

	async removeGuest(matchId: string, guestName: Guest['name']) {
		return repositories.matchParticipants.removeGuest(matchId, guestName)
	},

	async list(matchId: string) {
		return repositories.matchParticipants.list(matchId)
	},

	subscribe(matchId: string, callback: (payload: unknown) => void): SubscriptionHandle {
		return repositories.matchParticipants.subscribe(matchId, callback)
	},
}
