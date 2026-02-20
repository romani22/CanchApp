import { AuthProvider, useAuth } from '@/context/AuthContext'
import { MatchProvider } from '@/context/MatchContext'
import { NotificationsProvider } from '@/context/NotificationsContext'
import { Slot } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import '../global.css'

function RootNavigation() {
	const { isLoading } = useAuth()

	if (isLoading) {
		return (
			<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
				<ActivityIndicator size='large' />
			</View>
		)
	}

	return <Slot />
}

export default function RootLayout() {
	return (
		<AuthProvider>
			<NotificationsProvider>
				<MatchProvider>
					<RootNavigation />
				</MatchProvider>
			</NotificationsProvider>
		</AuthProvider>
	)
}
