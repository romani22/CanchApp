import { useAuth } from '@/context/AuthContext'
import { Redirect, Stack } from 'expo-router'

export default function ProtectedLayout() {
	const { isAuthenticated, isLoading } = useAuth()

	if (isLoading) return null

	if (!isAuthenticated) {
		return <Redirect href='/(auth)/Login' />
	}

	return <Stack screenOptions={{ headerShown: false }} />
}
