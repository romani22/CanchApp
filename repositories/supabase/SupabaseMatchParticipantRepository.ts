import { supabase } from '@/lib/supabase'
import type { Guest, MatchParticipant, Profile, TeamSlot } from '@/types/database.types'
import type { IMatchParticipantRepository } from '../interfaces/IMatchParticipantRepository'
import type { SubscriptionHandle } from '../types'

export class SupabaseMatchParticipantRepository implements IMatchParticipantRepository {
	async join(matchId: string, userId: string, teamSlot?: TeamSlot): Promise<{ error: Error | null }> {
		const { error } = await supabase.from('match_participants').insert({
			match_id: matchId,
			user_id: userId,
			...(teamSlot ? { team_slot: teamSlot } : {}),
		})
		return { error: error ?? null }
	}

	async assignTeam(participantId: string, teamSlot: TeamSlot | null): Promise<{ error: Error | null }> {
		const { error } = await supabase.from('match_participants').update({ team_slot: teamSlot }).eq('id', participantId)
		return { error: error ?? null }
	}

	async assignTeamBulk(
		matchId: string,
		assignments: { participantId: string; teamSlot: TeamSlot | null }[],
	): Promise<PromiseSettledResult<{ error: Error | null }>[]> {
		return Promise.allSettled(
			assignments.map(({ participantId, teamSlot }) =>
				supabase
					.from('match_participants')
					.update({ team_slot: teamSlot })
					.eq('id', participantId)
					.then(({ error }) => ({ error: error ?? null })),
			),
		)
	}

	async clearAllTeamSlots(matchId: string): Promise<{ error: Error | null }> {
		const { error } = await supabase.from('match_participants').update({ team_slot: null }).eq('match_id', matchId)
		return { error: error ?? null }
	}

	async addGuest(matchId: string, guestName: Guest['name'], teamSlot?: TeamSlot): Promise<{ error: Error | null }> {
		const { error } = await supabase.from('match_participants').insert({
			match_id: matchId,
			guest_name: guestName,
			...(teamSlot ? { team_slot: teamSlot } : {}),
		} as any)
		return { error: error ?? null }
	}

	async leave(matchId: string, userId: string): Promise<{ error: Error | null }> {
		const { error } = await supabase.from('match_participants').delete().eq('match_id', matchId).eq('user_id', userId)
		return { error: error ?? null }
	}

	async removeGuest(matchId: string, guestName: Guest['name']): Promise<{ error: Error | null }> {
		const { error } = await supabase.from('match_participants').delete().eq('match_id', matchId).eq('guest_name', guestName as any)
		return { error: error ?? null }
	}

	async list(matchId: string): Promise<{
		data: (MatchParticipant & { user: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null })[] | null
		error: Error | null
	}> {
		const { data, error } = await supabase
			.from('match_participants')
			.select('id, guest_name, user_id, team_slot, user:profiles(id, full_name, avatar_url)')
			.eq('match_id', matchId)
		return { data: data as any, error: error ?? null }
	}

	subscribe(matchId: string, callback: (payload: unknown) => void): SubscriptionHandle {
		const channel = supabase
			.channel(`match_participants:${matchId}`)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'match_participants', filter: `match_id=eq.${matchId}` }, callback)
			.subscribe()

		return { unsubscribe: () => supabase.removeChannel(channel) }
	}
}
