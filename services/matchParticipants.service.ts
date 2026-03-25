import { supabase } from '@/lib/supabase'
import { Guest, TeamSlot } from '@/types/database.types'

export const matchParticipantsService = {
	async join(matchId: string, userId: string, teamSlot?: TeamSlot) {
		return await supabase.from('match_participants').insert({
			match_id: matchId,
			user_id: userId,
			...(teamSlot ? { team_slot: teamSlot } : {}),
		})
	},

	async assignTeam(participantId: string, teamSlot: TeamSlot | null) {
		return await supabase.from('match_participants').update({ team_slot: teamSlot }).eq('id', participantId)
	},

	async assignTeamBulk(matchId: string, assignments: { participantId: string; teamSlot: TeamSlot | null }[]) {
		return Promise.all(assignments.map(({ participantId, teamSlot }) => supabase.from('match_participants').update({ team_slot: teamSlot }).eq('id', participantId)))
	},

	async clearAllTeamSlots(matchId: string) {
		return await supabase.from('match_participants').update({ team_slot: null }).eq('match_id', matchId)
	},

	async addGuest(matchId: string, guestName: Guest['name'], teamSlot?: TeamSlot) {
		return await supabase.from('match_participants').insert({
			match_id: matchId,
			guest_name: guestName,
			...(teamSlot ? { team_slot: teamSlot } : {}),
		})
	},

	async leave(matchId: string, userId: string) {
		return await supabase.from('match_participants').delete().eq('match_id', matchId).eq('user_id', userId)
	},

	async removeGuest(matchId: string, guestName: Guest['name']) {
		return await supabase.from('match_participants').delete().eq('match_id', matchId).eq('guest_name', guestName)
	},

	async list(matchId: string) {
		return await supabase
			.from('match_participants')
			.select(
				`
				id,
				guest_name,
				user_id,
				team_slot,
				user:profiles (
					id,
					full_name,
					avatar_url
				)
			`,
			)
			.eq('match_id', matchId)
	},
}
