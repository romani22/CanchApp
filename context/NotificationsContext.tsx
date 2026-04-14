import { supabase } from '@/lib/supabase'
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

		const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false)

		setUnreadCount(count ?? 0)
	}

	useEffect(() => {
		let channel: ReturnType<typeof supabase.channel> | null = null
		let isMounted = true

		const setup = async () => {
			if (!user?.id || !isMounted) return

			const fetchCount = async (uid: string) => {
				const { count, error } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', uid).eq('is_read', false)

				if (error) {
					console.error('Error fetching notification count:', error)
					return
				}

				if (isMounted) {
					setUnreadCount(count ?? 0)
				}
			}

			setUserId(user.id)
			await fetchCount(user.id)

			channel = supabase
				.channel(`notifications-${user.id}`)
				.on(
					'postgres_changes',
					{
						event: 'INSERT',
						schema: 'public',
						table: 'notifications',
						filter: `user_id=eq.${user.id}`,
					},
					() => {
						if (isMounted) setUnreadCount((prev) => prev + 1)
					},
				)
				.on(
					'postgres_changes',
					{
						event: 'UPDATE',
						schema: 'public',
						table: 'notifications',
						filter: `user_id=eq.${user.id}`,
					},
					(payload) => {
						if (!isMounted) return
						if (payload.old?.is_read === false && payload.new?.is_read === true) {
							setUnreadCount((prev) => Math.max(prev - 1, 0))
						}
					},
				)
				.subscribe()
		}

		setup()

		return () => {
			isMounted = false
			if (channel) {
				supabase.removeChannel(channel)
			}
		}
	}, [user?.id])

	return <NotificationsContext.Provider value={{ unreadCount, refreshCount }}>{children}</NotificationsContext.Provider>
}

export const useNotifications = () => useContext(NotificationsContext)
