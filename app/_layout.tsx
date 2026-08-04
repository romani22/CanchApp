import Loader from '@/components/ui/Loader'
import { AppLockProvider } from '@/context/AppLockContext'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { MatchProvider } from '@/context/MatchContext'
import { NotificationsProvider } from '@/context/NotificationsContext'
import { Slot } from 'expo-router'
import '../global.css'

function RootNavigation() {
	const { isLoading } = useAuth()

	if (isLoading) {
		return <Loader title='Cargando...' />
	}

	return <Slot />
}

export default function RootLayout() {
	return (
		<AuthProvider>
			<AppLockProvider>
				<NotificationsProvider>
					<MatchProvider>
						<RootNavigation />
					</MatchProvider>
				</NotificationsProvider>
			</AppLockProvider>
		</AuthProvider>
	)
}
