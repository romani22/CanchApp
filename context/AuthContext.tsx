import { authService } from '@/services/auth.service'
import { Profile } from '@/types/database.types'
import { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { createContext, ReactNode, useContext, useEffect, useState } from 'react'

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
	signOut: () => Promise<{ error: Error | null }>
	resetPassword: (email: string) => Promise<{ error: Error | null }>
	updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>
	refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
	children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
	const [user, setUser] = useState<User | null>(null)
	const [session, setSession] = useState<Session | null>(null)
	const [profile, setProfile] = useState<Profile | null>(null)
	const [isLoading, setIsLoading] = useState<boolean>(true)

	useEffect(() => {
		const initialize = async () => {
			const { data } = await authService.getSession()
			const currentSession = data.session

			setSession(currentSession)
			setUser(currentSession?.user ?? null)

			if (currentSession?.user) {
				const profile = await authService.getProfile(currentSession.user.id)
				setProfile(profile)
			}

			setIsLoading(false)
		}

		initialize()

		const { data: listener } = authService.onAuthStateChange(async (_event: AuthChangeEvent, session: Session | null) => {
			setSession(session)
			setUser(session?.user ?? null)

			if (session?.user) {
				const profile = await authService.getProfile(session.user.id)
				setProfile(profile)
			} else {
				setProfile(null)
			}
		})

		return () => {
			listener.subscription.unsubscribe()
		}
	}, [])

	const refreshProfile = async () => {
		if (!user) return
		const updatedProfile = await authService.getProfile(user.id)
		setProfile(updatedProfile)
	}

	const updateProfile = async (updates: Partial<Profile>) => {
		if (!user) return { error: new Error('No user logged in') }

		const { error } = await authService.updateProfile(user.id, updates)

		if (!error) {
			await refreshProfile()
		}

		return { error }
	}

	/* ============================
	   CONTEXT VALUE
	============================ */

	const value: AuthContextType = {
		user,
		session,
		profile,
		isLoading,
		isAuthenticated: !!session,
		signIn: authService.signIn,
		signUp: authService.signUp,
		signOut: authService.signOut,
		resetPassword: authService.resetPassword,
		updateProfile,
		refreshProfile,
	}

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextType {
	const context = useContext(AuthContext)

	if (!context) {
		throw new Error('useAuth must be used within an AuthProvider')
	}

	return context
}
