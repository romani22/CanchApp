import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import { router } from 'expo-router'
import 'react-native-url-polyfill/auto'

export const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_KEY!, {
	auth: {
		storage: AsyncStorage,
		autoRefreshToken: true,
		persistSession: true,
		detectSessionInUrl: false,
	},
})

// Interceptor de sesión expirada:
// Supabase llama este listener cuando el token cambia o expira.
// Si el evento es SIGNED_OUT y no hay sesión activa, redirigir al login.
supabase.auth.onAuthStateChange((event, session) => {
	if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
		// Navegar al login de forma segura (puede llamarse antes de que el router esté listo)
		try {
			router.replace('/(auth)/Login')
		} catch {
			// Router aún no montado — la redirección ocurrirá cuando se monte el layout raíz
		}
	}
})

// Helper para obtener el usuario actual
export const getCurrentUser = async () => {
	const {
		data: { user },
		error,
	} = await supabase.auth.getUser()
	if (error) throw error
	return user
}

// Helper para obtener la sesión actual
export const getCurrentSession = async () => {
	const {
		data: { session },
		error,
	} = await supabase.auth.getSession()
	if (error) throw error
	return session
}
