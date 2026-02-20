import { supabase } from '@/lib/supabase'
import { Profile } from '@/types/database.types'
import { AuthChangeEvent, Session } from '@supabase/supabase-js'

export const authService = {
	/* ============================
	   SESSION
	============================ */

	async getSession() {
		return await supabase.auth.getSession()
	},

	onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
		return supabase.auth.onAuthStateChange(callback)
	},

	validateEmail: (email: string): boolean => {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
		return emailRegex.test(email)
	},

	validatePassword: (password: string): { isValid: boolean; errors: string[] } => {
		const errors: string[] = []

		if (password.length < 8) {
			errors.push('La contraseña debe tener al menos 8 caracteres')
		}
		if (!/[A-Z]/.test(password)) {
			errors.push('Debe incluir al menos una letra mayúscula')
		}
		if (!/[a-z]/.test(password)) {
			errors.push('Debe incluir al menos una letra minúscula')
		}
		if (!/[0-9]/.test(password)) {
			errors.push('Debe incluir al menos un número')
		}

		return {
			isValid: errors.length === 0,
			errors,
		}
	},

	/* ============================
	   AUTH
	============================ */

	async signUp(email: string, password: string, fullName: string): Promise<{ error: Error | null; data: { id: string } }> {
		const response = await supabase.auth.signUp({
			email,
			password,
			options: {
				data: { full_name: fullName },
			},
		})

		return { error: response.error ?? null, data: { id: response.data.user?.id ?? '' } }
	},

	async signIn(email: string, password: string): Promise<{ error: Error | null }> {
		const { error } = await supabase.auth.signInWithPassword({
			email,
			password,
		})

		return { error: error ?? null }
	},

	async signOut(): Promise<{ error: Error | null }> {
		const { error } = await supabase.auth.signOut()
		return { error: error ?? null }
	},

	async resetPassword(email: string): Promise<{ error: Error | null }> {
		const { error } = await supabase.auth.resetPasswordForEmail(email, {
			redirectTo: 'canchapp://auth/reset-password',
		})

		return { error: error ?? null }
	},

	/* ============================
	   PROFILE
	============================ */

	async getProfile(userId: string): Promise<Profile | null> {
		const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()

		if (error) {
			console.error('Error fetching profile:', error)
			return null
		}

		return data
	},

	async updateProfile(userId: string, updates: Partial<Profile>): Promise<{ error: Error | null }> {
		const { error } = await supabase
			.from('profiles')
			.update({
				...updates,
				updated_at: new Date().toISOString(),
			})
			.eq('id', userId)

		return { error: error ?? null }
	},
}
