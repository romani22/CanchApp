import { authService } from '@/services/auth.service'
import { profilesService } from '@/services/profiles.service'
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

	/* ============================
	   TIMEOUT HELPER
	============================ */

	const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> => {
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error('Timeout')), ms)

			promise
				.then((value) => {
					clearTimeout(timer)
					resolve(value)
				})
				.catch((err) => {
					clearTimeout(timer)
					reject(err)
				})
		})
	}

	/* ============================
	   INITIALIZE
	============================ */

	useEffect(() => {
		let isMounted = true

		const initialize = async () => {
			try {
				const { data } = await withTimeout(authService.getSession(), 10000)
				const currentSession = data.session

				if (!isMounted) return

				setSession(currentSession)
				setUser(currentSession?.user ?? null)

				if (currentSession?.user) {
					const fullProfile = await withTimeout(loadFullProfile(currentSession.user.id), 10000)

					if (!isMounted) return
					setProfile(fullProfile)
				}
			} catch (error) {
				console.log('Auth error:', error)

				if (!isMounted) return

				// SOLO limpiar estado (no navegar)
				setUser(null)
				setSession(null)
				setProfile(null)
			} finally {
				if (isMounted) setIsLoading(false)
			}
		}

		initialize()

		const { data: listener } = authService.onAuthStateChange(async (_event: AuthChangeEvent, session: Session | null) => {
			if (!isMounted) return

			setSession(session)
			setUser(session?.user ?? null)

			// Si no hay sesión, limpiar profile y salir
			if (!session?.user) {
				setProfile(null)
				return
			}

			try {
				const fullProfile = await withTimeout(loadFullProfile(session.user.id), 10000)

				if (!isMounted) return
				setProfile(fullProfile)
			} catch (error) {
				console.log('Profile load error:', error)

				// Solo limpiar estado
				setUser(null)
				setSession(null)
				setProfile(null)
			}
		})

		return () => {
			isMounted = false
			listener.subscription.unsubscribe()
		}
	}, [])

	/* ============================
	   PROFILE
	============================ */

	const loadFullProfile = async (userId: string) => {
		const profileData = await profilesService.getById(userId)
		if (!profileData) return null

		const stats = await profilesService.getUserStats(userId)

		return {
			...profileData,
			...stats,
		}
	}

	const refreshProfile = async () => {
		if (!user) return

		const fullProfile = await loadFullProfile(user.id)
		setProfile(fullProfile)
	}

	const updateProfile = async (updates: Partial<Profile>) => {
		if (!user) return { error: new Error('No user logged in') }

		try {
			await profilesService.updateProfile(user.id, updates)
			await refreshProfile()
			return { error: null }
		} catch (error: any) {
			return { error }
		}
	}

	/* ============================
	   CONTEXT VALUE
	============================ */

	const value: AuthContextType = {
		user,
		session,
		profile,
		isLoading,
		isAuthenticated: !!user, // importante
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
	if (!context) throw new Error('useAuth must be used within an AuthProvider')
	return context
}
