import Loader from '@/components/ui/Loader'
import { useAuth } from '@/context/AuthContext'
import { Stack } from 'expo-router'

export default function AuthLayout() {
	const { isLoading } = useAuth()

	if (isLoading) {
		return <Loader />
	}

	return <Stack screenOptions={{ headerShown: false }} />
}
