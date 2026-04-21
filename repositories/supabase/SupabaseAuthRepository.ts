import { supabase } from '@/lib/supabase'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import type { IAuthRepository } from '../interfaces/IAuthRepository'

export class SupabaseAuthRepository implements IAuthRepository {
	async getSession(): Promise<{ data: { session: Session | null }; error: Error | null }> {
		return supabase.auth.getSession()
	}

	onAuthStateChange(
		callback: (event: AuthChangeEvent, session: Session | null) => void,
	): { data: { subscription: { unsubscribe: () => void } } } {
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
}
