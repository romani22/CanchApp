import { notificationsService } from '@/services/notifications.service'
import type { SubscriptionHandle } from '@/repositories/types'
import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'

interface NotificationsContextType {
	unreadCount: number
	refreshCount: () => Promise<void>
}

const NotificationsContext = createContext<NotificationsContextType>({
	unreadCount: 0,
	refreshCount: async () => {},
})

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
	const [unreadCount, setUnreadCount] = useState(0)
	const [userId, setUserId] = useState<string | null>(null)
	const { user } = useAuth()

	const refreshCount = async () => {
		if (!userId) return
		try {
			const count = await notificationsService.getUnreadCount(userId)
			setUnreadCount(count)
		} catch (error) {
			console.error('Error refreshing notification count:', error)
		}
	}

	useEffect(() => {
		let isMounted = true
		let subscription: SubscriptionHandle | null = null

		const setup = async () => {
			if (!user?.id || !isMounted) return

			setUserId(user.id)

			try {
				const count = await notificationsService.getUnreadCount(user.id)
				if (isMounted) setUnreadCount(count)
			} catch (error) {
				console.error('Error fetching notification count:', error)
			}

			if (!isMounted) return

			subscription = notificationsService.subscribeToChanges(
				user.id,
				// onInsert: nueva notificación
				() => {
					if (isMounted) setUnreadCount((prev) => prev + 1)
				},
				// onUpdate: notificación marcada como leída
				(payload: any) => {
					if (!isMounted) return
					if (payload.old?.is_read === false && payload.new?.is_read === true) {
						setUnreadCount((prev) => Math.max(prev - 1, 0))
					}
				},
			)
		}

		setup()

		return () => {
			isMounted = false
			subscription?.unsubscribe()
		}
	}, [user?.id])

	return <NotificationsContext.Provider value={{ unreadCount, refreshCount }}>{children}</NotificationsContext.Provider>
}

export const useNotifications = () => useContext(NotificationsContext)
