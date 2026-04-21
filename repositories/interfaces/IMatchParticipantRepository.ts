import type { Guest, MatchParticipant, Profile, TeamSlot } from '@/types/database.types'
import type { SubscriptionHandle } from '../types'

export interface IMatchParticipantRepository {
	join(matchId: string, userId: string, teamSlot?: TeamSlot): Promise<{ error: Error | null }>
	assignTeam(participantId: string, teamSlot: TeamSlot | null): Promise<{ error: Error | null }>
	assignTeamBulk(matchId: string, assignments: { participantId: string; teamSlot: TeamSlot | null }[]): Promise<PromiseSettledResult<{ error: Error | null }>[]>
	clearAllTeamSlots(matchId: string): Promise<{ error: Error | null }>
	addGuest(matchId: string, guestName: Guest['name'], teamSlot?: TeamSlot): Promise<{ error: Error | null }>
	leave(matchId: string, userId: string): Promise<{ error: Error | null }>
	removeGuest(matchId: string, guestName: Guest['name']): Promise<{ error: Error | null }>
	list(matchId: string): Promise<{ data: (MatchParticipant & { user: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null })[] | null; error: Error | null }>
	subscribe(matchId: string, callback: (payload: unknown) => void): SubscriptionHandle
}
