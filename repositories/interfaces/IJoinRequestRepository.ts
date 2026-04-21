import type { JoinRequest, JoinRequestWithUser } from '@/types/database.types'
import type { SubscriptionHandle } from '../types'

export interface IJoinRequestRepository {
	create(matchId: string, userId: string, message?: string): Promise<JoinRequest | null>
	getForMatch(matchId: string): Promise<JoinRequestWithUser[]>
	getCreatorPending(userId: string): Promise<JoinRequestWithUser[]>
	getUser(userId: string): Promise<JoinRequestWithUser[]>
	accept(requestId: string): Promise<void>
	reject(requestId: string): Promise<void>
	cancel(requestId: string): Promise<void>
	leaveMatch(matchId: string, userId: string): Promise<void>
	subscribe(matchId: string, callback: (payload: { eventType: string; request: JoinRequest }) => void): SubscriptionHandle
}
