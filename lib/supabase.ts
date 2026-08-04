import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import { AppState } from 'react-native'
import 'react-native-url-polyfill/auto'
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY

if (!supabaseUrl || !supabaseKey) {
	throw new Error('Faltan variables de entorno EXPO_PUBLIC_SUPABASE_URL y/o EXPO_PUBLIC_SUPABASE_KEY')
}
export const supabase = createClient(supabaseUrl, supabaseKey, {
	auth: {
		storage: AsyncStorage,
		autoRefreshToken: true,
		persistSession: true,
		detectSessionInUrl: false,
	},
})

/**
 * Refresco de token atado al ciclo de vida de la app.
 *
 * auth-js renueva el access token con un setInterval, y en móvil ese timer no es
 * confiable en background: Android lo congela y al volver puede haber pasado más
 * que la vida del token (1 h). Sin esto, el reintento salía a la red desde un
 * estado inconsistente y una renovación fallida terminaba en SIGNED_OUT — o sea,
 * minimizar la app y volver más tarde te dejaba afuera y sin notificaciones.
 *
 * El contrato que pide Supabase para React Native: parar el timer al ir a
 * background y arrancarlo al volver, que además dispara un refresh inmediato si
 * el token venció mientras la app estaba dormida.
 */
AppState.addEventListener('change', (state) => {
	if (state === 'active') {
		void supabase.auth.startAutoRefresh()
	} else {
		void supabase.auth.stopAutoRefresh()
	}
})

// La app arranca en foreground: el listener sólo corre en el próximo cambio.
if (AppState.currentState === 'active') {
	void supabase.auth.startAutoRefresh()
}

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
