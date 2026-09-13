import { uniqueTopic } from './realtimeTopic'
import { supabase } from '@/lib/supabase'
import type { JoinRequest, JoinRequestWithUser, MatchInvitation, TeamSlot } from '@/types/database.types'
import type { IJoinRequestRepository } from '../interfaces/IJoinRequestRepository'
import type { SubscriptionHandle } from '../types'

/**
 * El embed del perfil va siempre con la FK explícita. Desde la 027 la tabla tiene dos
 * claves foráneas a `profiles` (`user_id` e `invited_by`), y con dos caminos posibles
 * pedir `profiles(...)` a secas devuelve 300 PGRST201. El que se muestra es el jugador.
 */
export class SupabaseJoinRequestRepository implements IJoinRequestRepository {
	async create(matchId: string, userId: string, message?: string, teamSlot?: TeamSlot): Promise<JoinRequest | null> {
		const { data: participant } = await supabase.from('match_participants').select('id').eq('match_id', matchId).eq('user_id', userId).maybeSingle()
		if (participant) throw new Error('Ya sos parte de este partido')

		const { data: existing } = await supabase.from('join_requests').select('*').eq('match_id', matchId).eq('user_id', userId).maybeSingle()

		if (existing?.status === 'pending') throw new Error('Ya enviaste una solicitud para este partido')

		const payload = { message: message ?? null, team_slot: teamSlot ?? null }

		// join_requests tiene UNIQUE(match_id, user_id), así que volver a pedir entrar
		// no es una fila nueva: es la misma volviendo a 'pending'. Pasa al re-solicitar
		// tras un rechazo, y también cuando alguien se fue del partido y quiere volver
		// (su solicitud quedó en 'accepted' aunque ya no sea participante).
		if (existing) {
			const { data, error } = await supabase
				.from('join_requests')
				.update({ ...payload, status: 'pending', updated_at: new Date().toISOString() })
				.eq('id', existing.id)
				.select()
				.maybeSingle()
			if (error) throw error
			return data
		}

		const { data, error } = await supabase
			.from('join_requests')
			.insert({ match_id: matchId, user_id: userId, ...payload })
			.select()
			.maybeSingle()
		if (error) throw error
		return data
	}

	/**
	 * Invitación del creador a un usuario registrado (027).
	 *
	 * No se usa upsert, aunque el UNIQUE (match_id, user_id) lo pida a gritos: con
	 * una fila previa, PostgREST resuelve el conflicto con ON CONFLICT DO UPDATE, y
	 * esa rama pasa por la policy de UPDATE — que para el creador sobre la fila de
	 * otra persona es falsa. O sea que el upsert no fallaría por el conflicto sino
	 * con un error de permisos, que no dice nada de lo que pasó.
	 *
	 * Así que INSERT, y el conflicto se resuelve mirando la fila que está. Las dos
	 * situaciones son distintas y ninguna es un error del creador:
	 *
	 *   · La fila es una invitación suya (típicamente rechazada, o pendiente de un
	 *     intento anterior): se borra y se invita de nuevo. La policy de DELETE le
	 *     deja borrar sólo las filas con invited_by = él, así que esto no puede
	 *     tocar la solicitud de nadie.
	 *   · La fila es una SOLICITUD del usuario: no se toca. Esa persona ya pidió
	 *     entrar y el camino es aceptarle la solicitud, no convertirla en una
	 *     invitación. El trigger protect_join_request_identity congela invited_by
	 *     justamente para que ese atajo no exista.
	 */
	async invite(matchId: string, userId: string, invitedBy: string, teamSlot?: TeamSlot): Promise<JoinRequest | null> {
		const row = {
			match_id: matchId,
			user_id: userId,
			invited_by: invitedBy,
			status: 'pending' as const,
			team_slot: teamSlot ?? null,
		}

		const { data, error } = await supabase.from('join_requests').insert(row).select().maybeSingle()
		if (!error) return data

		// 23505 = unique_violation. Cualquier otro error se propaga tal cual.
		if (error.code !== '23505') throw error

		const { data: existing } = await supabase.from('join_requests').select('id, invited_by, status').eq('match_id', matchId).eq('user_id', userId).maybeSingle()

		if (existing && existing.invited_by === null) {
			throw new Error('Esa persona ya pidió unirse: aceptale la solicitud en vez de invitarla.')
		}

		if (existing) {
			const { error: deleteError } = await supabase.from('join_requests').delete().eq('id', existing.id)
			if (deleteError) throw deleteError
		}

		const { data: reinserted, error: retryError } = await supabase.from('join_requests').insert(row).select().maybeSingle()
		if (retryError) throw retryError
		return reinserted
	}

	async acceptInvitation(requestId: string): Promise<void> {
		const { error } = await supabase.rpc('accept_match_invitation', { request_id: requestId })
		if (error) throw error
	}

	async rejectInvitation(requestId: string): Promise<void> {
		const { error } = await supabase.rpc('reject_match_invitation', { request_id: requestId })
		if (error) throw error
	}

	async getMine(matchId: string, userId: string): Promise<JoinRequest | null> {
		const { data, error } = await supabase.from('join_requests').select('*').eq('match_id', matchId).eq('user_id', userId).maybeSingle()
		if (error) throw error
		return data
	}

	async getForMatch(matchId: string): Promise<JoinRequestWithUser[]> {
		const { data, error } = await supabase
			.from('join_requests')
			.select('*, user:profiles!join_requests_user_id_fkey(*), match:matches(*)')
			.eq('match_id', matchId)
			.eq('status', 'pending')
			.order('created_at', { ascending: false })
		if (error) throw error
		return (data as JoinRequestWithUser[]) ?? []
	}

	/**
	 * Sin filtro de status: una invitación rechazada tiene que seguir viéndose. El
	 * perfil va recortado a lo que se muestra, no el `profiles(*)` de las consultas
	 * viejas. A quien no sea el creador la RLS le devuelve vacío.
	 */
	async getInvitations(matchId: string): Promise<MatchInvitation[]> {
		const { data, error } = await supabase
			.from('join_requests')
			.select('*, user:profiles!join_requests_user_id_fkey(id, full_name, avatar_url)')
			.eq('match_id', matchId)
			.not('invited_by', 'is', null)
			.order('created_at', { ascending: true })
		if (error) throw error
		return (data as MatchInvitation[]) ?? []
	}

	async getCreatorPending(userId: string): Promise<JoinRequestWithUser[]> {
		const { data, error } = await supabase
			.from('join_requests')
			.select('*, user:profiles!join_requests_user_id_fkey(*), match:matches!inner(*)')
			.eq('match.creator_id', userId)
			.eq('status', 'pending')
			.order('created_at', { ascending: false })
		if (error) throw error
		return (data as JoinRequestWithUser[]) ?? []
	}

	async getUser(userId: string): Promise<JoinRequestWithUser[]> {
		const { data, error } = await supabase
			.from('join_requests')
			.select('*, user:profiles!join_requests_user_id_fkey(*), match:matches(*, creator:profiles!matches_creator_id_fkey(*))')
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
		// Por RPC y no por update directo: valida del lado del servidor que la
		// solicitud siga pendiente y que quien rechaza sea el creador (022).
		const { error } = await supabase.rpc('reject_join_request', { request_id: requestId })
		if (error) throw error
	}

	/**
	 * Da de baja una fila de join_requests. Sirve para los dos lados: el usuario
	 * cancela su solicitud, y el creador cancela una invitación que mandó él (la
	 * policy de DELETE de la 027 permite exactamente esas dos cosas).
	 *
	 * El `.select()` no es para usar el resultado: es para saber si borró algo. Un
	 * DELETE que RLS no deja pasar no da error — devuelve cero filas —, así que sin
	 * esto la pantalla mostraría la cancelación como exitosa y la fila seguiría ahí.
	 * Es el mismo modo de falla silencioso que tenía el re-pedido de entrada antes de
	 * la 026, y que costó encontrar justamente porque no gritaba.
	 */
	async cancel(requestId: string): Promise<void> {
		const { data, error } = await supabase.from('join_requests').delete().eq('id', requestId).select('id')
		if (error) throw error
		if (!data || data.length === 0) {
			throw new Error('No se pudo dar de baja: puede que ya no exista, o que no sea tuya.')
		}
	}

	async leaveMatch(matchId: string, userId: string): Promise<void> {
		const { data: match } = await supabase.from('matches').select('creator_id').eq('id', matchId).maybeSingle()
		if (match?.creator_id === userId) throw new Error('El creador no puede abandonar el partido')

		const { error } = await supabase.from('match_participants').delete().eq('match_id', matchId).eq('user_id', userId)
		if (error) throw error
	}

	subscribe(matchId: string, callback: (payload: { eventType: string; request: JoinRequest }) => void): SubscriptionHandle {
		const channel = supabase
			.channel(uniqueTopic(`requests:${matchId}`))
			.on('postgres_changes', { event: '*', schema: 'public', table: 'join_requests', filter: `match_id=eq.${matchId}` }, (payload) => {
				callback({ eventType: payload.eventType, request: (payload.new || payload.old) as JoinRequest })
			})
			.subscribe()

		return { unsubscribe: () => supabase.removeChannel(channel) }
	}
}
