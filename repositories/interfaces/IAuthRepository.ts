import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

export interface IAuthRepository {
	getSession(): Promise<{ data: { session: Session | null }; error: Error | null }>
	onAuthStateChange(
		callback: (event: AuthChangeEvent, session: Session | null) => void,
	): { data: { subscription: { unsubscribe: () => void } } }
	signUp(email: string, password: string, fullName: string): Promise<{ error: Error | null; data: { id: string } }>
	signIn(email: string, password: string): Promise<{ error: Error | null }>
	signOut(): Promise<{ error: Error | null }>
	resetPassword(email: string): Promise<{ error: Error | null }>
	updatePassword(newPassword: string): Promise<{ error: Error | null }>
}
