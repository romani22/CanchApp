import { repositories } from '@/repositories'
import { storageService } from '@/services/storage.service'
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

	/** Login con huella. */
	async signInWithRefreshToken(refreshToken: string): Promise<{ error: Error | null }> {
		return repositories.auth.signInWithRefreshToken(refreshToken)
	},

	async signOut(): Promise<{ error: Error | null }> {
		return repositories.auth.signOut()
	},

	/**
	 * Borra la cuenta definitivamente. No tiene vuelta atrás.
	 *
	 * El avatar va primero y desde el cliente: Supabase aborta cualquier DELETE
	 * directo sobre storage.objects, así que hacerlo dentro de la RPC voltearía la
	 * transacción entera (es lo que revirtió la 019), y después de la RPC ya no hay
	 * sesión con la que autorizarlo.
	 *
	 * Si el avatar falla se borra la cuenta igual: es un derecho del usuario y no
	 * puede quedar bloqueado por el storage. Deja una foto huérfana en el bucket.
	 */
	async deleteAccount(userId: string): Promise<void> {
		try {
			await storageService.deleteAvatar(userId)
		} catch (err) {
			console.warn('[Auth] no se pudo borrar el avatar; la cuenta se borra igual:', err)
		}

		await repositories.auth.deleteAccount()
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

	async signInWithGoogle(): Promise<{ error: Error | null }> {
		return repositories.auth.signInWithGoogle()
	},
}
