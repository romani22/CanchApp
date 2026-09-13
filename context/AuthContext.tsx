import { authService } from '@/services/auth.service'
import { biometricService } from '@/services/biometric.service'
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
	/** Login con huella: reanuda la sesión desde el refresh token guardado. */
	signInWithRefreshToken: (refreshToken: string) => Promise<{ error: Error | null }>
	signOut: () => Promise<{ error: Error | null }>
	/** Borra la cuenta para siempre y deja la sesión cerrada (028). */
	deleteAccount: () => Promise<void>
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

/**
 * Recupera la sesión guardada, con reintentos.
 *
 * getSession() no es sólo leer el storage: si el access token venció, auth-js sale
 * a la red a renovarlo. Con mala señal eso puede tardar o fallar, y eso NO significa
 * "no hay sesión" sino "todavía no sabemos". Antes ese timeout limpiaba el estado y
 * mandaba al login con la sesión guardada perfectamente válida — uno de los motivos
 * del "se cierra sola la sesión".
 *
 * Si después de los reintentos sigue sin resolver, lanza y quien llama deja el
 * estado como está: el ticker de auto-refresh de auth-js va a seguir intentando y el
 * listener de onAuthStateChange avisa cuando lo logre.
 */
const loadSessionWithRetry = async (): Promise<Session | null> => {
	const retryDelays = [0, 700, 1500]
	let lastError: unknown = null

	for (let i = 0; i < retryDelays.length; i++) {
		if (retryDelays[i] > 0) {
			await new Promise<void>((resolve) => setTimeout(resolve, retryDelays[i]))
		}
		try {
			const { data } = await withTimeout(authService.getSession(), 10000)
			return data.session ?? null
		} catch (err) {
			lastError = err
			console.error(`[Auth] getSession intento ${i + 1} falló:`, err)
		}
	}

	throw lastError instanceof Error ? lastError : new Error('No se pudo recuperar la sesión')
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

		// Sin await y sin depender de que haya sesión: la contraseña que dejó la versión
		// anterior está en el teléfono ahora mismo.
		void biometricService.purgeLegacyCredentials()

		const initialize = async () => {
			try {
				const currentSession = await loadSessionWithRetry()

				void biometricService.storeRefreshToken(currentSession?.refresh_token)

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
			} catch (err) {
				if (!isMounted) return
				// A propósito NO se limpia el estado: la sesión guardada puede seguir
				// siendo válida y borrarla acá obligaba a loguearse de nuevo por un
				// problema de red. Queda como no autenticado hasta que auth-js avise.
				console.error('[Auth] no se pudo recuperar la sesión al inicializar:', err)
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

			// Único lugar que ve TODAS las renovaciones, y el token rota.
			void biometricService.storeRefreshToken(session.refresh_token)

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

	/**
	 * El logout revoca el refresh token del lado del servidor, así que el guardado
	 * para la huella deja de servir y se borra: si no, el login mostraría un botón que
	 * falla al apoyar el dedo. `{ scope: 'local' }` no ayudaría, revoca el mismo token.
	 *
	 * La preferencia queda, así que el próximo ingreso con contraseña la rearma sola.
	 */
	const signOutAndForgetBiometricToken = async (): Promise<{ error: Error | null }> => {
		const result = await authService.signOut()
		// Después del logout y pase lo que pase: supabase-js limpia la sesión local
		// aunque la llamada al servidor falle, así que el usuario queda afuera y el
		// token guardado no se puede dar por bueno.
		await biometricService.clearRefreshToken()
		return result
	}

	/**
	 * Al volver de la RPC el usuario ya no existe, así que el signOut falla con 401 y
	 * ese error se ignora: supabase-js limpia la sesión local igual y de ahí sale el
	 * SIGNED_OUT que lleva al login.
	 *
	 * Un error de la RPC sí se propaga: la cuenta sigue viva y hay que decirlo.
	 */
	const deleteAccount = async (): Promise<void> => {
		if (!user) throw new Error('No hay sesión')

		await authService.deleteAccount(user.id)

		// El token de la huella apunta a una cuenta que ya no existe.
		await biometricService.disable()
		await authService.signOut().catch(() => undefined)
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
		signInWithRefreshToken: authService.signInWithRefreshToken,
		signUp: authService.signUp,
		signOut: signOutAndForgetBiometricToken,
		deleteAccount,
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
