import { supabase } from '@/lib/supabase'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import * as AuthSession from 'expo-auth-session'
import Constants from 'expo-constants'
import * as WebBrowser from 'expo-web-browser'
import type { IAuthRepository } from '../interfaces/IAuthRepository'

const isExpoGo = Constants.executionEnvironment === 'storeClient'

export class SupabaseAuthRepository implements IAuthRepository {
	async getSession(): Promise<{ data: { session: Session | null }; error: Error | null }> {
		return supabase.auth.getSession()
	}

	onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void): { data: { subscription: { unsubscribe: () => void } } } {
		return supabase.auth.onAuthStateChange(callback)
	}

	async signUp(email: string, password: string, fullName: string): Promise<{ error: Error | null; data: { id: string } }> {
		const response = await supabase.auth.signUp({
			email,
			password,
			options: { data: { full_name: fullName } },
		})
		return { error: response.error ?? null, data: { id: response.data.user?.id ?? '' } }
	}

	async signIn(email: string, password: string): Promise<{ error: Error | null }> {
		const { error } = await supabase.auth.signInWithPassword({ email, password })
		return { error: error ?? null }
	}

	async signOut(): Promise<{ error: Error | null }> {
		const { error } = await supabase.auth.signOut()
		return { error: error ?? null }
	}

	async resetPassword(email: string): Promise<{ error: Error | null }> {
		const { error } = await supabase.auth.resetPasswordForEmail(email, {
			redirectTo: 'canchapp://auth/reset-password',
		})
		return { error: error ?? null }
	}

	async updatePassword(newPassword: string): Promise<{ error: Error | null }> {
		const { error } = await supabase.auth.updateUser({ password: newPassword })
		return { error: error ?? null }
	}

	async signInWithGoogle(): Promise<{ error: Error | null }> {
		// En Expo Go preferLocalhost genera siempre exp://localhost:8081/--/auth/callback (URL fija)
		// En dev build genera canchapp://auth/callback
		const redirectTo = AuthSession.makeRedirectUri({
			scheme: 'canchapp',
			path: 'auth/callback',
			preferLocalhost: isExpoGo,
		})

		const { data, error } = await supabase.auth.signInWithOAuth({
			provider: 'google',
			options: { redirectTo, skipBrowserRedirect: true },
		})

		if (error) return { error }

		const result = await WebBrowser.openAuthSessionAsync(data.url ?? '', redirectTo)

		if (result.type !== 'success') {
			return { error: null }
		}

		// Evitar new URL() con esquemas custom (exp://) que puede fallar en React Native
		const [withoutHash, hashPart = ''] = result.url.split('#')
		const queryPart = withoutHash.split('?')[1] ?? ''

		const hashParams = new URLSearchParams(hashPart)
		const queryParams = new URLSearchParams(queryPart)

		const accessToken = hashParams.get('access_token') ?? queryParams.get('access_token')
		const refreshToken = hashParams.get('refresh_token') ?? queryParams.get('refresh_token')

		// Flujo implícito: tokens en la URL
		if (accessToken && refreshToken) {
			const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
			return { error: sessionError ?? null }
		}

		// Flujo PKCE (default en Supabase JS v2): código en query params
		const code = queryParams.get('code')
		if (code) {
			const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
			return { error: exchangeError ?? null }
		}

		// Se loguean sólo los nombres de los parámetros, nunca sus valores: la URL
		// del callback puede traer provider_token u otras credenciales.
		console.error('[Google OAuth] Callback sin tokens ni code. Parámetros recibidos:', [...hashParams.keys(), ...queryParams.keys()].join(', ') || '(ninguno)')
		return { error: new Error('No se obtuvieron los tokens de autenticación') }
	}
}
