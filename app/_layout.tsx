import { AuthProvider } from '@/context/AuthContext'
import { MatchProvider } from '@/context/MatchContext'
import { NotificationsProvider } from '@/context/NotificationsContext'
import { Slot } from 'expo-router'
import '../global.css'

export default function RootLayout() {
	return (
		<AuthProvider>
			<NotificationsProvider>
				<MatchProvider>
					<Slot />
				</MatchProvider>
			</NotificationsProvider>
		</AuthProvider>
	)
}
