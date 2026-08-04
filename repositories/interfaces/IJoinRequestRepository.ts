import type { JoinRequest, JoinRequestWithUser, TeamSlot } from '@/types/database.types'
import type { SubscriptionHandle } from '../types'

export interface IJoinRequestRepository {
	/**
	 * Pide entrar a un partido. En modo equipos se pide un lado, y es el que le
	 * queda asignado si el creador acepta.
	 */
	create(matchId: string, userId: string, message?: string, teamSlot?: TeamSlot): Promise<JoinRequest | null>
	/** La solicitud del usuario en ese partido, en cualquier estado, o null. */
	getMine(matchId: string, userId: string): Promise<JoinRequest | null>
	getForMatch(matchId: string): Promise<JoinRequestWithUser[]>
	getCreatorPending(userId: string): Promise<JoinRequestWithUser[]>
	getUser(userId: string): Promise<JoinRequestWithUser[]>
	accept(requestId: string): Promise<void>
	reject(requestId: string): Promise<void>
	cancel(requestId: string): Promise<void>
	leaveMatch(matchId: string, userId: string): Promise<void>
	subscribe(matchId: string, callback: (payload: { eventType: string; request: JoinRequest }) => void): SubscriptionHandle
}
