import { supabase } from '@/lib/supabase'
import { createContext, ReactNode, useContext, useEffect, useState } from 'react'

interface NotificationsContextType {
	unreadCount: number
	refreshCount: () => Promise<void>
}

interface NotificationsProviderProps {
	children: ReactNode
}

const NotificationsContext = createContext<NotificationsContextType>({
	unreadCount: 0,
	refreshCount: async () => {},
})

export const NotificationsProvider = ({ children }: NotificationsProviderProps) => {
	const [unreadCount, setUnreadCount] = useState(0)

	const refreshCount = async () => {
		const {
			data: { user },
		} = await supabase.auth.getUser()
		if (!user) return

		const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false)

		setUnreadCount(count ?? 0)
	}

	useEffect(() => {
		let channel: any

		const setup = async () => {
			const {
				data: { user },
			} = await supabase.auth.getUser()
			if (!user) return

			await refreshCount()

			// 🔥 Realtime listener
			channel = supabase
				.channel('notifications-channel')
				.on(
					'postgres_changes',
					{
						event: '*',
						schema: 'public',
						table: 'notifications',
						filter: `user_id=eq.${user.id}`,
					},
					() => {
						refreshCount()
					},
				)
				.subscribe()
		}

		setup()

		return () => {
			if (channel) {
				supabase.removeChannel(channel)
			}
		}
	}, [])

	return <NotificationsContext.Provider value={{ unreadCount, refreshCount }}>{children}</NotificationsContext.Provider>
}

export const useNotifications = () => useContext(NotificationsContext)
