import { supabase } from '@/lib/supabase'
import { Profile } from '@/types/database.types'
import { Session, User } from '@supabase/supabase-js'
import * as Google from 'expo-auth-session/providers/google'
import * as WebBrowser from 'expo-web-browser'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'

WebBrowser.maybeCompleteAuthSession()

interface AuthState {
	user: User | null
	session: Session | null
	profile: Profile | null
	isLoading: boolean
	isAuthenticated: boolean
}

interface AuthContextType extends AuthState {
	signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>
	signIn: (email: string, password: string) => Promise<{ error: Error | null }>
	signInWithGoogle: () => Promise<void>
	signOut: () => Promise<void>
	resetPassword: (email: string) => Promise<{ error: Error | null }>
	updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>
	refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [state, setState] = useState<AuthState>({
		user: null,
		session: null,
		profile: null,
		isLoading: true,
		isAuthenticated: false,
	})

	// --- Fetch profile from Supabase ---
	const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
		try {
			const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()

			if (error) {
				console.error('Error fetching profile:', error)
				return null
			}
			return data
		} catch (error) {
			console.error('Error fetching profile:', error)
			return null
		}
	}, [])

	// --- Initialize auth state ---
	useEffect(() => {
		supabase.auth.getSession().then(async ({ data: { session } }) => {
			if (session?.user) {
				const profile = await fetchProfile(session.user.id)
				setState({
					user: session.user,
					session,
					profile,
					isLoading: false,
					isAuthenticated: true,
				})
			} else {
				setState((prev) => ({ ...prev, isLoading: false }))
			}
		})

		// Listen for auth changes
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange(async (_, session) => {
			if (session?.user) {
				const profile = await fetchProfile(session.user.id)
				setState({
					user: session.user,
					session,
					profile,
					isLoading: false,
					isAuthenticated: true,
				})
			} else {
				setState({
					user: null,
					session: null,
					profile: null,
					isLoading: false,
					isAuthenticated: false,
				})
			}
		})

		return () => subscription.unsubscribe()
	}, [fetchProfile])

	// --- Sign up with email/password ---
	const signUp = async (email: string, password: string, fullName: string) => {
		try {
			const { error } = await supabase.auth.signUp({
				email,
				password,
				options: {
					data: { full_name: fullName },
				},
			})
			return { error: error || null }
		} catch (error) {
			return { error: error as Error }
		}
	}

	// --- Sign in with email/password ---
	const signIn = async (email: string, password: string) => {
		try {
			const { error } = await supabase.auth.signInWithPassword({ email, password })
			console.log(error)
			return { error: error || null }
		} catch (error) {
			return { error: error as Error }
		}
	}

	// --- Google login using Expo Auth Session ---

	const [googleRequest, , promptGoogleAsync] = Google.useAuthRequest({
		clientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
	})

	const signInWithGoogle = async () => {
		const result = await promptGoogleAsync()
		if (result.type !== 'success') {
			throw new Error('Login cancelado')
		}

		const idToken = result.params?.id_token
		if (!idToken) throw new Error('No se recibió id_token desde Google')

		const { data, error } = await supabase.auth.signInWithIdToken({
			provider: 'google',
			token: idToken,
		})

		if (error) throw error

		// Fetch profile after login
		const profile = await fetchProfile(data.user.id)
		setState({
			user: data.user,
			session: data.session,
			profile,
			isLoading: false,
			isAuthenticated: true,
		})
	}

	// --- Sign out ---
	const signOut = async () => {
		await supabase.auth.signOut()
		setState({
			user: null,
			session: null,
			profile: null,
			isLoading: false,
			isAuthenticated: false,
		})
	}

	// --- Reset password ---
	const resetPassword = async (email: string) => {
		try {
			const { error } = await supabase.auth.resetPasswordForEmail(email, {
				redirectTo: 'turnos://auth/reset-password',
			})
			return { error: error || null }
		} catch (error) {
			return { error: error as Error }
		}
	}

	// --- Update profile ---
	const updateProfile = async (updates: Partial<Profile>) => {
		if (!state.user) return { error: new Error('No user logged in') }
		try {
			const { error } = await supabase
				.from('profiles')
				.update({ ...updates, updated_at: new Date().toISOString() })
				.eq('id', state.user.id)
			if (error) throw error

			await refreshProfile()
			return { error: null }
		} catch (error) {
			return { error: error as Error }
		}
	}

	// --- Refresh profile ---
	const refreshProfile = async () => {
		if (state.user) {
			const profile = await fetchProfile(state.user.id)
			setState((prev) => ({ ...prev, profile }))
		}
	}

	return (
		<AuthContext.Provider
			value={{
				...state,
				signUp,
				signIn,
				signInWithGoogle,
				signOut,
				resetPassword,
				updateProfile,
				refreshProfile,
			}}
		>
			{children}
		</AuthContext.Provider>
	)
}

// --- useAuth hook ---
export function useAuth() {
	const context = useContext(AuthContext)
	if (!context) throw new Error('useAuth must be used within an AuthProvider')
	return context
}
