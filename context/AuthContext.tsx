import { authService } from '@/services/auth.service'
import { profilesService } from '@/services/profiles.service'
import { pushNotificationService } from '@/services/pushnotifications.service'
import { Profile } from '@/types/database.types'
import { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react'
import { Alert } from 'react-native'

const getErrorMessage = (error: unknown): string => {
	if (error instanceof Error) return error.message
	if (typeof error === 'string') return error
	return 'Ocurrió un error inesperado'
}

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
	signInWithGoogle: () => Promise<{ error: Error | null }>
	updatePassword: (newPassword: string) => Promise<{ error: Error | null }>
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
	const userIdRef = useRef<string | null>(null)
	// Último usuario para el que ya se registró el push token (ver setupPushNotifications).
	const pushSetupForUserRef = useRef<string | null>(null)

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
	   PUSH NOTIFICATIONS SETUP
	============================ */

	/**
	 * Registra el dispositivo una sola vez por usuario.
	 *
	 * Antes se llamaba desde initialize() y desde el handler de SIGNED_IN. Parecen
	 * caminos excluyentes, pero no lo son: cuando auth-js recupera una sesión guardada
	 * que necesita refresh, _recoverAndRefresh() emite SIGNED_IN, así que al abrir la
	 * app con sesión activa corrían las dos y se duplicaban las 3 queries del registro.
	 */
	const setupPushNotifications = async (userId: string) => {
		if (pushSetupForUserRef.current === userId) return
		pushSetupForUserRef.current = userId

		try {
			// Registrar el dispositivo para notificaciones
			const token = await pushNotificationService.registerForPushNotifications()

			if (token) {
				// Guardar el token en la base de datos
				await pushNotificationService.savePushToken(userId, token)
			}
		} catch (error) {
			console.error('❌ Error setting up push notifications:', error)
		}
	}

	const cleanupPushNotifications = async (userId: string) => {
		// Sin esto, volver a entrar con el mismo usuario no re-registraría el token.
		pushSetupForUserRef.current = null

		try {
			// Remover el token al cerrar sesión
			await pushNotificationService.removePushToken(userId)
		} catch (error) {
			console.error('❌ Error removing push token:', error)
		}
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
					try {
						const fullProfile = await loadFullProfile(currentSession.user.id)
						if (!isMounted) return
						setProfile(fullProfile)
					} catch (err) {
						// El perfil no cargó pero la sesión sigue siendo válida
						console.error('[Auth] no se pudo cargar el perfil al inicializar:', err)
					}
					await setupPushNotifications(currentSession.user.id)
				}
			} catch {
				if (!isMounted) return
				// Solo limpiar si falló la carga de sesión (no de perfil)
				setUser(null)
				setSession(null)
				setProfile(null)
			} finally {
				if (isMounted) setIsLoading(false)
			}
		}

		initialize()

		/**
		 * Trabajo asíncrono posterior a un cambio de sesión.
		 *
		 * Se ejecuta FUERA del callback de onAuthStateChange a propósito (ver abajo).
		 */
		const handleAuthChange = async (event: AuthChangeEvent, session: Session | null, previousUserId: string | null) => {
			if (!isMounted) return

			// Si no hay sesión, limpiar profile y salir
			if (!session?.user) {
				if (previousUserId) {
					await cleanupPushNotifications(previousUserId)
				}
				if (isMounted) setProfile(null)
				return
			}

			// El perfil lo crea el trigger handle_new_user() al insertarse el usuario.
			// En un alta recién hecha puede no estar visible todavía, así que reintentamos.
			let fullProfile = null
			const retryDelays = [0, 300, 600, 1200]

			for (let i = 0; i < retryDelays.length; i++) {
				if (retryDelays[i] > 0) {
					await new Promise<void>((resolve) => setTimeout(resolve, retryDelays[i]))
				}
				if (!isMounted) return

				try {
					fullProfile = await loadFullProfile(session.user.id)
					if (fullProfile !== null) break
				} catch (error: unknown) {
					console.error(`[Auth] loadFullProfile attempt ${i + 1} failed:`, error)
				}
			}

			if (!isMounted) return

			if (fullProfile !== null) {
				setProfile(fullProfile)
			} else if (event === 'SIGNED_IN') {
				Alert.alert(
					'Error al cargar perfil',
					'No pudimos cargar tu perfil. Por favor, cerrá sesión e intentá nuevamente.',
				)
			}

			if (event === 'SIGNED_IN') {
				await setupPushNotifications(session.user.id)
			}
		}

		// OJO: este callback es SINCRÓNICO a propósito. No agregar async/await acá.
		//
		// auth-js espera los callbacks (`await x.callback(...)` en _notifyAllSubscribers)
		// desde adentro de su lock interno. Si llamamos a Supabase acá, el _acquireLock
		// reentrante encola nuestra llamada detrás de la operación que nos invocó
		// (_callRefreshToken, _setSession...), y esa operación está esperando que este
		// callback termine: espera circular, sin error ni timeout.
		//
		// Síntoma: el login se cuelga en silencio, sin error ni timeout, porque
		// loadFullProfile() nunca resuelve.
		//
		// Diferir con setTimeout(0) hace que el trabajo corra recién cuando auth-js
		// soltó el lock.
		const { data: listener } = authService.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
			if (!isMounted) return

			const previousUserId = userIdRef.current

			// setState de React es seguro acá: no toca Supabase.
			setSession(session)
			setUser(session?.user ?? null)

			setTimeout(() => {
				void handleAuthChange(event, session, previousUserId)
			}, 0)
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
		const [profileResult, statsResult] = await Promise.allSettled([
			profilesService.getById(userId),
			profilesService.getUserStats(userId),
		])

		if (profileResult.status === 'rejected') {
			console.error('[Profile] getById falló:', profileResult.reason)
		}

		const profileData = profileResult.status === 'fulfilled' ? profileResult.value : null
		if (!profileData) {
			console.warn('[Profile] no se encontró perfil para el usuario')
			return null
		}

		const stats = statsResult.status === 'fulfilled' ? statsResult.value : null
		return { ...profileData, ...(stats ?? {}) }
	}

	const refreshProfile = async () => {
		if (!user) return

		const fullProfile = await loadFullProfile(user.id)
		setProfile(fullProfile)
	}

	useEffect(() => {
		userIdRef.current = user?.id ?? null
	}, [user])

	const updateProfile = async (updates: Partial<Profile>) => {
		if (!user) return { error: new Error('No user logged in') }

		try {
			await profilesService.updateProfile(user.id, updates)
			await refreshProfile()
			return { error: null }
		} catch (error: unknown) {
			return { error: new Error(getErrorMessage(error)) }
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
		signInWithGoogle: authService.signInWithGoogle,
		updatePassword: authService.updatePassword,
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
