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

	/** Login con huella: reanuda la sesión desde el refresh token guardado. */
	async signInWithRefreshToken(refreshToken: string): Promise<{ error: Error | null }> {
		return repositories.auth.signInWithRefreshToken(refreshToken)
	},

	async signOut(): Promise<{ error: Error | null }> {
		return repositories.auth.signOut()
	},

	/**
	 * Borra la cuenta de forma definitiva (028). No tiene vuelta atrás.
	 *
	 * Dos pasos, y el orden importa:
	 *
	 *   1. El avatar, por la Storage API. Tiene que ser ACÁ y no en el servidor:
	 *      Supabase protege storage.objects con un trigger que aborta cualquier
	 *      DELETE directo, y al dispararse dentro de la transacción de la RPC se
	 *      llevaría puesto el borrado entero. Es lo que le pasó a la migración 018,
	 *      y por eso la 019 la revirtió. Y tiene que ser ANTES: después del paso 2
	 *      ya no hay sesión con la que autorizar el borrado del archivo.
	 *
	 *   2. La RPC, que borra auth.users y deja el perfil como lápida anonimizada.
	 *
	 * Si el paso 1 falla, el paso 2 va igual. Es deliberado: el borrado de la cuenta
	 * es un derecho del usuario y no puede quedar bloqueado porque el storage tuvo
	 * un mal momento. El costo es una foto huérfana en el bucket — queda el aviso en
	 * consola, y la limpieza es un barrido de archivos sin perfil vivo detrás.
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
