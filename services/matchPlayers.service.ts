import { repositories } from '@/repositories'
import type { AddMultiplePlayersResult, AddPlayerInput } from '@/repositories/interfaces/IMatchPlayerRepository'
import type { SubscriptionHandle } from '@/repositories/types'
import type { MatchPlayer, MatchPlayerWithUser, Profile, TeamSlot } from '@/types/database.types'

export type { AddPlayerInput, AddMultiplePlayersResult }

export const matchPlayersService = {
	async addPlayer(matchId: string, addedByUserId: string, player: AddPlayerInput): Promise<MatchPlayer> {
		return repositories.matchPlayers.add(matchId, addedByUserId, player)
	},

	async addMultiplePlayers(matchId: string, addedByUserId: string, players: AddPlayerInput[]): Promise<AddMultiplePlayersResult[]> {
		return repositories.matchPlayers.addMultiple(matchId, addedByUserId, players)
	},

	async getMatchPlayers(matchId: string): Promise<MatchPlayerWithUser[]> {
		return repositories.matchPlayers.getForMatch(matchId)
	},

	async getPlayersByUser(matchId: string, userId: string): Promise<MatchPlayerWithUser[]> {
		return repositories.matchPlayers.getByUser(matchId, userId)
	},

	async removePlayer(playerId: string): Promise<boolean> {
		return repositories.matchPlayers.remove(playerId)
	},

	async updatePlayerTeam(playerId: string, teamSlot: TeamSlot | null): Promise<void> {
		return repositories.matchPlayers.updateTeam(playerId, teamSlot)
	},

	async canAddMorePlayers(matchId: string): Promise<{ canAdd: boolean; remaining: number }> {
		return repositories.matchPlayers.canAddMore(matchId)
	},

	async searchUsers(query: string, limit = 10): Promise<Profile[]> {
		return repositories.matchPlayers.searchUsers(query, { limit })
	},

	async getMatchPlayersStats(matchId: string) {
		return repositories.matchPlayers.getStats(matchId)
	},

	subscribe(matchId: string, callback: (payload: any) => void): SubscriptionHandle {
		return repositories.matchPlayers.subscribe(matchId, callback)
	},
}
