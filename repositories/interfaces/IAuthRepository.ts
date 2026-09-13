import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

export interface IAuthRepository {
	getSession(): Promise<{ data: { session: Session | null }; error: Error | null }>
	onAuthStateChange(
		callback: (event: AuthChangeEvent, session: Session | null) => void,
	): { data: { subscription: { unsubscribe: () => void } } }
	signUp(email: string, password: string, fullName: string): Promise<{ error: Error | null; data: { id: string } }>
	signIn(email: string, password: string): Promise<{ error: Error | null }>
	/**
	 * Reanuda la sesión a partir de un refresh token guardado. Es el camino del login
	 * con huella: reemplaza al signIn con la contraseña guardada que usaba antes.
	 */
	signInWithRefreshToken(refreshToken: string): Promise<{ error: Error | null }>
	signOut(): Promise<{ error: Error | null }>
	/**
	 * Borra la cuenta del usuario que tiene la sesión abierta (028).
	 *
	 * No recibe un id a propósito: la RPC del servidor tampoco lo recibe, y trabaja
	 * con auth.uid(). Una función de borrado que acepte un id ajeno es un arma.
	 *
	 * El avatar NO lo borra: hay que borrarlo antes con la Storage API. El orden y
	 * el motivo están en authService.deleteAccount().
	 */
	deleteAccount(): Promise<void>
	resetPassword(email: string): Promise<{ error: Error | null }>
	updatePassword(newPassword: string): Promise<{ error: Error | null }>
	signInWithGoogle(): Promise<{ error: Error | null }>
}
