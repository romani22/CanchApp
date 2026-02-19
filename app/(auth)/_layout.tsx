import { useAuth } from '@/context/AuthContext'
import { Redirect, Stack } from 'expo-router'

export default function AuthLayout() {
	const { isAuthenticated, isLoading } = useAuth()

	if (isLoading) {
		return null // o un SplashScreen
	}

	if (isAuthenticated) {
		return <Redirect href='/(tabs)/Dashboard' />
	}

	return <Stack screenOptions={{ headerShown: false }} />
}
