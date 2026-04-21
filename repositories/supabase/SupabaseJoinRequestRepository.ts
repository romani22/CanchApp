import { supabase } from '@/lib/supabase'
import type { JoinRequest, JoinRequestWithUser } from '@/types/database.types'
import type { IJoinRequestRepository } from '../interfaces/IJoinRequestRepository'
import type { SubscriptionHandle } from '../types'

export class SupabaseJoinRequestRepository implements IJoinRequestRepository {
	async create(matchId: string, userId: string, message?: string): Promise<JoinRequest | null> {
		const { data: existing } = await supabase.from('join_requests').select('*').eq('match_id', matchId).eq('user_id', userId).maybeSingle()
		if (existing) throw new Error('Ya has solicitado unirte a este partido')

		const { data: participant } = await supabase.from('match_participants').select('*').eq('match_id', matchId).eq('user_id', userId).maybeSingle()
		if (participant) throw new Error('Ya eres parte de este partido')

		const { data, error } = await supabase.from('join_requests').insert({ match_id: matchId, user_id: userId, message }).select().maybeSingle()
		if (error) throw error
		return data
	}

	async getForMatch(matchId: string): Promise<JoinRequestWithUser[]> {
		const { data, error } = await supabase
			.from('join_requests')
			.select('*, user:profiles(*), match:matches(*)')
			.eq('match_id', matchId)
			.eq('status', 'pending')
			.order('created_at', { ascending: false })
		if (error) throw error
		return (data as JoinRequestWithUser[]) ?? []
	}

	async getCreatorPending(userId: string): Promise<JoinRequestWithUser[]> {
		const { data, error } = await supabase
			.from('join_requests')
			.select('*, user:profiles(*), match:matches!inner(*)')
			.eq('match.creator_id', userId)
			.eq('status', 'pending')
			.order('created_at', { ascending: false })
		if (error) throw error
		return (data as JoinRequestWithUser[]) ?? []
	}

	async getUser(userId: string): Promise<JoinRequestWithUser[]> {
		const { data, error } = await supabase
			.from('join_requests')
			.select('*, user:profiles(*), match:matches(*, creator:profiles!matches_creator_id_fkey(*))')
			.eq('user_id', userId)
			.order('created_at', { ascending: false })
		if (error) throw error
		return (data as JoinRequestWithUser[]) ?? []
	}

	async accept(requestId: string): Promise<void> {
		const { error } = await supabase.rpc('accept_join_request', { request_id: requestId })
		if (error) throw error
	}

	async reject(requestId: string): Promise<void> {
		const { error } = await supabase.from('join_requests').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', requestId)
		if (error) throw error
	}

	async cancel(requestId: string): Promise<void> {
		const { error } = await supabase.from('join_requests').delete().eq('id', requestId)
		if (error) throw error
	}

	async leaveMatch(matchId: string, userId: string): Promise<void> {
		const { data: match } = await supabase.from('matches').select('creator_id').eq('id', matchId).maybeSingle()
		if (match?.creator_id === userId) throw new Error('El creador no puede abandonar el partido')

		const { error } = await supabase.from('match_participants').delete().eq('match_id', matchId).eq('user_id', userId)
		if (error) throw error
	}

	subscribe(matchId: string, callback: (payload: { eventType: string; request: JoinRequest }) => void): SubscriptionHandle {
		const channel = supabase
			.channel(`requests:${matchId}`)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'join_requests', filter: `match_id=eq.${matchId}` }, (payload) => {
				callback({ eventType: payload.eventType, request: (payload.new || payload.old) as JoinRequest })
			})
			.subscribe()

		return { unsubscribe: () => supabase.removeChannel(channel) }
	}
}
