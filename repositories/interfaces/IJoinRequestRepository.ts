import type { JoinRequest, JoinRequestWithUser, MatchInvitation, TeamSlot } from '@/types/database.types'
import type { SubscriptionHandle } from '../types'

export interface IJoinRequestRepository {
	/**
	 * Pide entrar a un partido. En modo equipos se pide un lado, y es el que le
	 * queda asignado si el creador acepta.
	 */
	create(matchId: string, userId: string, message?: string, teamSlot?: TeamSlot): Promise<JoinRequest | null>
	/**
	 * El creador invita a un usuario registrado (027). No lo suma al partido: crea
	 * la fila pendiente y le avisa. Entra cuando acepta.
	 *
	 * La contracara de `create`: la misma tabla, la dirección opuesta. A los
	 * invitados SIN cuenta no se los invita — no hay a quién avisarle ni quién
	 * acepte —, esos los agrega el creador directo con `addGuest`.
	 */
	invite(matchId: string, userId: string, invitedBy: string, teamSlot?: TeamSlot): Promise<JoinRequest | null>
	/** La solicitud o invitación del usuario en ese partido, en cualquier estado, o null. */
	getMine(matchId: string, userId: string): Promise<JoinRequest | null>
	getForMatch(matchId: string): Promise<JoinRequestWithUser[]>
	/**
	 * Las invitaciones del partido en cualquier estado, a diferencia de getForMatch
	 * que sólo trae pendientes. Las rechazadas le sirven al creador para buscar
	 * reemplazo.
	 */
	getInvitations(matchId: string): Promise<MatchInvitation[]>
	getCreatorPending(userId: string): Promise<JoinRequestWithUser[]>
	getUser(userId: string): Promise<JoinRequestWithUser[]>
	accept(requestId: string): Promise<void>
	reject(requestId: string): Promise<void>
	/** El invitado acepta. Sólo funciona sobre una invitación propia. */
	acceptInvitation(requestId: string): Promise<void>
	/** El invitado rechaza. Deja la fila en 'rejected' y avisa al creador. */
	rejectInvitation(requestId: string): Promise<void>
	cancel(requestId: string): Promise<void>
	leaveMatch(matchId: string, userId: string): Promise<void>
	subscribe(matchId: string, callback: (payload: { eventType: string; request: JoinRequest }) => void): SubscriptionHandle
}
