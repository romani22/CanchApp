import { supabase } from '@/lib/supabase'
import { createContext, ReactNode, useContext, useEffect, useState } from 'react'

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

	const refreshCount = async () => {
		if (!userId) return

		const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false)

		setUnreadCount(count ?? 0)
	}

	useEffect(() => {
		let channel: any

		const setup = async () => {
			const {
				data: { user },
			} = await supabase.auth.getUser()

			if (!user) return
			const fetchCount = async (uid: string) => {
				const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', uid).eq('is_read', false)
				setUnreadCount(count ?? 0)
			}

			setUserId(user.id)
			await fetchCount(user.id)

			channel = supabase
				.channel('notifications-channel')
				.on(
					'postgres_changes',
					{
						event: 'INSERT',
						schema: 'public',
						table: 'notifications',
						filter: `user_id=eq.${user.id}`,
					},
					() => {
						setUnreadCount((prev) => prev + 1)
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
						if (payload.old.is_read === false && payload.new.is_read === true) {
							setUnreadCount((prev) => Math.max(prev - 1, 0))
						}
					},
				)
				.subscribe()
		}

		setup()

		return () => {
			if (channel) supabase.removeChannel(channel)
		}
	}, [])

	return <NotificationsContext.Provider value={{ unreadCount, refreshCount }}>{children}</NotificationsContext.Provider>
}

export const useNotifications = () => useContext(NotificationsContext)
