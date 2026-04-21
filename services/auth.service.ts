import { repositories } from '@/repositories'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

export const authService = {
	/* ============================
	   SESSION
	============================ */

	async getSession() {
		return repositories.auth.getSession()
	},

	onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
		return repositories.auth.onAuthStateChange(callback)
	},

	validateEmail: (email: string): boolean => {
		const trimmed = email.trim().toLowerCase()
		if (trimmed.length > 254) return false
		return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i.test(trimmed)
	},

	validatePassword: (password: string): { isValid: boolean; errors: string[] } => {
		const errors: string[] = []
		if (password.length < 8) errors.push('La contraseña debe tener al menos 8 caracteres')
		if (!/[A-Z]/.test(password)) errors.push('Debe incluir al menos una letra mayúscula')
		if (!/[a-z]/.test(password)) errors.push('Debe incluir al menos una letra minúscula')
		if (!/[0-9]/.test(password)) errors.push('Debe incluir al menos un número')
		return { isValid: errors.length === 0, errors }
	},

	/* ============================
	   AUTH
	============================ */

	async signUp(email: string, password: string, fullName: string): Promise<{ error: Error | null; data: { id: string } }> {
		return repositories.auth.signUp(email, password, fullName)
	},

	async signIn(email: string, password: string): Promise<{ error: Error | null }> {
		return repositories.auth.signIn(email, password)
	},

	async signOut(): Promise<{ error: Error | null }> {
		return repositories.auth.signOut()
	},

	async resetPassword(email: string): Promise<{ error: Error | null }> {
		return repositories.auth.resetPassword(email)
	},

	/* ============================
	   UPDATE PASSWORD
	============================ */

	async updatePassword(newPassword: string): Promise<{ error: Error | null }> {
		return repositories.auth.updatePassword(newPassword)
	},
}
