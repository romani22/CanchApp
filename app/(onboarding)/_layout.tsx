import Loader from '@/components/ui/Loader'
import { useAuth } from '@/context/AuthContext'
import { Redirect, Stack } from 'expo-router'

export default function OnboardingLayout() {
	const { isAuthenticated, isLoading, profile } = useAuth()

	if (isLoading) return <Loader title='Cargando...' />

	if (!isAuthenticated) return <Redirect href='/(auth)/Login' />

	// El perfil llega un instante después de la sesión. Esperamos a tenerlo
	// antes de decidir, si no rebotaríamos al Dashboard y de vuelta acá.
	if (!profile) return <Loader title='Cargando tu perfil...' />

	// Espejo del guard de (protected): sólo nos quedamos acá si la bandera es
	// explícitamente false. Con la migración sin aplicar llega `undefined` y salimos.
	if (profile.onboarding_completed !== false) {
		return <Redirect href='/(protected)/(tabs)/Dashboard' />
	}

	// gestureEnabled: false — el onboarding es obligatorio, no se sale con swipe.
	return <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />
}
