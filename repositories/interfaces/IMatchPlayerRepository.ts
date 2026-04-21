import type { MatchPlayer, MatchPlayerWithUser, Profile, TeamSlot } from '@/types/database.types'
import type { SubscriptionHandle } from '../types'

export interface AddPlayerInput {
	user_id?: string | null
	player_name: string
	team_slot?: TeamSlot | null
}

export interface AddMultiplePlayersResult {
	success: boolean
	player_id: string | null
	player_name: string
	error_message: string | null
}

export interface IMatchPlayerRepository {
	add(matchId: string, addedByUserId: string, player: AddPlayerInput): Promise<MatchPlayer>
	addMultiple(matchId: string, addedByUserId: string, players: AddPlayerInput[]): Promise<AddMultiplePlayersResult[]>
	getForMatch(matchId: string): Promise<MatchPlayerWithUser[]>
	getByUser(matchId: string, userId: string): Promise<MatchPlayerWithUser[]>
	remove(playerId: string): Promise<boolean>
	updateTeam(playerId: string, teamSlot: TeamSlot | null): Promise<void>
	canAddMore(matchId: string): Promise<{ canAdd: boolean; remaining: number }>
	searchUsers(query: string, options?: { excludeUserId?: string; limit?: number }): Promise<Profile[]>
	getStats(matchId: string): Promise<{
		total: number
		registered: number
		guests: number
		byTeam: { A: number; B: number; none: number }
	}>
	subscribe(matchId: string, callback: (payload: unknown) => void): SubscriptionHandle
}
