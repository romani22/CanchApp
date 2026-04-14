import { supabase } from '@/lib/supabase'
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
		const trimmed = email.trim().toLowerCase()
		if (trimmed.length > 254) return false
		return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i.test(trimmed)
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
	UPDATE PASSWORD
	============================ */

	async updatePassword(newPassword: string): Promise<{ error: Error | null }> {
		const { error } = await supabase.auth.updateUser({
			password: newPassword,
		})

		return { error: error ?? null }
	},
}
