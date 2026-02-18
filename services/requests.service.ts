import { supabase } from '@/lib/supabase'
import { JoinRequest, JoinRequestWithUser } from '@/types/database.types'

// Create join request
export const createJoinRequest = async (matchId: string, userId: string, message?: string): Promise<JoinRequest> => {
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
}

// Get pending requests for a match (for match creator)
export const getMatchRequests = async (matchId: string): Promise<JoinRequestWithUser[]> => {
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
}

// Get all pending requests for user's matches (as creator)
export const getCreatorPendingRequests = async (userId: string): Promise<JoinRequestWithUser[]> => {
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
}

// Get user's own requests
export const getUserRequests = async (userId: string): Promise<JoinRequestWithUser[]> => {
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
}

// Accept join request
export const acceptRequest = async (requestId: string): Promise<void> => {
	// Get the request details
	const { data: request, error: requestError } = await supabase.from('join_requests').select('*').eq('id', requestId).maybeSingle()

	if (requestError || !request) {
		throw new Error('Solicitud no encontrada')
	}

	// Update request status
	const { error: updateError } = await supabase.from('join_requests').update({ status: 'accepted', updated_at: new Date().toISOString() }).eq('id', requestId)

	if (updateError) {
		console.error('Error accepting request:', updateError)
		throw updateError
	}

	// Add user as participant
	const { error: participantError } = await supabase.from('match_participants').insert({
		match_id: request.match_id,
		user_id: request.user_id,
		is_creator: false,
	})

	if (participantError) {
		console.error('Error adding participant:', participantError)
		// Rollback the status update
		await supabase.from('join_requests').update({ status: 'pending' }).eq('id', requestId)
		throw participantError
	}
}

// Reject join request
export const rejectRequest = async (requestId: string): Promise<void> => {
	const { error } = await supabase.from('join_requests').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', requestId)

	if (error) {
		console.error('Error rejecting request:', error)
		throw error
	}
}

// Cancel own request
export const cancelRequest = async (requestId: string): Promise<void> => {
	const { error } = await supabase.from('join_requests').delete().eq('id', requestId)

	if (error) {
		console.error('Error cancelling request:', error)
		throw error
	}
}

// Leave match (remove self from participants)
export const leaveMatch = async (matchId: string, userId: string): Promise<void> => {
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
}

// Subscribe to requests for creator's matches
export const subscribeToRequests = (matchId: string, callback: (payload: { eventType: string; request: JoinRequest }) => void) => {
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
}
