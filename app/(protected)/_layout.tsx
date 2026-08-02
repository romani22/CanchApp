import { useAuth } from '@/context/AuthContext'
import { Redirect, Stack } from 'expo-router'

export default function ProtectedLayout() {
	const { isAuthenticated, isLoading, profile } = useAuth()

	if (isLoading) return null

	if (!isAuthenticated) {
		return <Redirect href='/(auth)/Login' />
	}

	// Único punto donde se intercepta el perfil incompleto: cubre login con Google,
	// registro por email y restauración de sesión, sin duplicar lógica en cada entrada.
	//
	// Sólo redirigimos con un perfil ya cargado. Si `profile` es null (todavía
	// cargando, o falló tras los reintentos de AuthContext) dejamos pasar en vez de
	// mostrar un loader: sin perfil no hay forma de cerrar sesión desde acá, y el
	// usuario quedaría encerrado. AuthContext ya avisa por Alert cuando falla.
	// Comparación estricta contra false: si la migración 016 todavía no se aplicó,
	// la columna no existe y llega `undefined`. En ese caso dejamos pasar en vez de
	// mandar a un onboarding cuyo guardado final fallaría — el feature no anda, pero
	// nadie queda encerrado.
	if (profile && profile.onboarding_completed === false) {
		return <Redirect href='/(onboarding)' />
	}

	return <Stack screenOptions={{ headerShown: false }} />
}
