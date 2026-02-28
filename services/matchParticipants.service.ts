import { supabase } from '@/lib/supabase'

export const matchParticipantsService = {
	async join(matchId: string, userId: string) {
		return await supabase.from('match_participants').insert({
			match_id: matchId,
			user_id: userId,
		})
	},

	async addGuest(matchId: string, guestName: string) {
		return await supabase.from('match_participants').insert({
			match_id: matchId,
			guest_name: guestName,
		})
	},

	async leave(matchId: string, userId: string) {
		return await supabase.from('match_participants').delete().eq('match_id', matchId).eq('user_id', userId)
	},

	async removeGuest(matchId: string, guestName: string) {
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
