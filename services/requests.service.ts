import { supabase } from '@/lib/supabase'
import { JoinRequest, JoinRequestWithUser } from '@/types/database.types'

export const requestsService = {
	// Create join request
	async createJoin(matchId: string, userId: string, message?: string) {
		// Check if request already exists
		const { data: existing } = await supabase.from('join_requests').select('*').eq('match_id', matchId).eq('user_id', userId).maybeSingle()

		if (existing) {
			throw new Error('Ya has solicitado unirte a este partido')
		}

		// Check if already a participant
		const { data: participant } = await supabase.from('match_participants').select('*').eq('match_id', matchId).eq('user_id', userId).maybeSingle()

		if (participant) {
			throw new Error('Ya eres parte de este partido')
		}

		const { data, error } = await supabase
			.from('join_requests')
			.insert({
				match_id: matchId,
				user_id: userId,
				message,
			})
			.select()
			.maybeSingle()

		if (error) {
			console.error('Error creating join request:', error)
			throw error
		}

		return data
	},

	// Get pending requests for a match (for match creator)
	async getMatch(matchId: string) {
		const { data, error } = await supabase
			.from('join_requests')
			.select(
				`
      *,
      user:profiles(*),
      match:matches(*)
    `,
			)
			.eq('match_id', matchId)
			.eq('status', 'pending')
			.order('created_at', { ascending: false })

		if (error) {
			console.error('Error fetching match requests:', error)
			throw error
		}

		return data as JoinRequestWithUser[]
	},

	// Get all pending requests for user's matches (as creator)
	async getCreatorPending(userId: string) {
		const { data, error } = await supabase
			.from('join_requests')
			.select(
				`
					*,
					user:profiles(*),
					match:matches!inner(*)
				`,
			)
			.eq('match.creator_id', userId)
			.eq('status', 'pending')
			.order('created_at', { ascending: false })

		if (error) {
			console.error('Error fetching creator requests:', error)
			throw error
		}

		return data as JoinRequestWithUser[]
	},

	// Get user's own requests
	async getUser(userId: string) {
		const { data, error } = await supabase
			.from('join_requests')
			.select(
				`
					*,
					user:profiles(*),
					match:matches(
						*,
						creator:profiles!matches_creator_id_fkey(*)
					)
				`,
			)
			.eq('user_id', userId)
			.order('created_at', { ascending: false })

		if (error) {
			console.error('Error fetching user requests:', error)
			throw error
		}

		return data as JoinRequestWithUser[]
	},

	async accept(requestId: string) {
		const { error } = await supabase.rpc('accept_join_request', {
			request_id: requestId,
		})
		if (error) throw error
	},

	// Reject join request
	async reject(requestId: string) {
		const { error } = await supabase.from('join_requests').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', requestId)

		if (error) {
			console.error('Error rejecting request:', error)
			throw error
		}
	},

	// Cancel own request
	async cancel(requestId: string) {
		const { error } = await supabase.from('join_requests').delete().eq('id', requestId)

		if (error) {
			console.error('Error cancelling request:', error)
			throw error
		}
	},

	// Leave match (remove self from participants)
	async leaveMatch(matchId: string, userId: string) {
		// Check if user is the creator
		const { data: match } = await supabase.from('matches').select('creator_id').eq('id', matchId).maybeSingle()

		if (match?.creator_id === userId) {
			throw new Error('El creador no puede abandonar el partido')
		}

		const { error } = await supabase.from('match_participants').delete().eq('match_id', matchId).eq('user_id', userId)

		if (error) {
			console.error('Error leaving match:', error)
			throw error
		}
	},

	// Subscribe to requests for creator's matches
	subscribe(matchId: string, callback: (payload: { eventType: string; request: JoinRequest }) => void) {
		return supabase
			.channel(`requests:${matchId}`)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'join_requests',
					filter: `match_id=eq.${matchId}`,
				},
				(payload) => {
					callback({
						eventType: payload.eventType,
						request: (payload.new || payload.old) as JoinRequest,
					})
				},
			)
			.subscribe()
	},
}
