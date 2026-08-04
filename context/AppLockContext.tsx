import { useAuth } from '@/context/AuthContext'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as LocalAuthentication from 'expo-local-authentication'
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { AppState, AppStateStatus } from 'react-native'

/**
 * Bloqueo por inactividad.
 *
 * Antes, cualquier vuelta a la app podía terminar en la pantalla de login: había
 * que loguearse todo el tiempo y, como signOut borra el push token del
 * dispositivo, tampoco llegaban las notificaciones.
 *
 * El criterio ahora:
 *
 *   · minimizar y volver enseguida  → no pasa nada, la sesión sigue viva
 *   · más de 15 minutos sin usar la app (minimizada o cerrada) → se pide
 *     autenticación del dispositivo (huella / Face ID / PIN) para volver a entrar
 *
 * Clave: bloquear NO es cerrar sesión. La sesión de Supabase y el push token
 * quedan intactos, así que las notificaciones siguen llegando y desbloquear es un
 * toque en vez de tipear mail y contraseña. Desde la pantalla de bloqueo se puede
 * cerrar sesión a mano.
 *
 * Se mide el tiempo de ausencia, no el tiempo total: con la app abierta adelante
 * el usuario la está usando, y no tiene sentido bloquearlo mientras mira.
 *
 * El mismo timestamp cubre "se cerró la app": al arrancar en frío se compara
 * contra la última actividad guardada. Cerrar y volver a abrir enseguida no
 * molesta; volver al otro día pide autenticación. No se distingue el cierre a mano
 * de que Android mate el proceso en background — desde el código son
 * indistinguibles, y esa confusión era justamente el origen del "se cierra sola la
 * sesión".
 */

const LAST_ACTIVE_KEY = 'canchapp:last_active_at'
const INACTIVITY_LIMIT_MS = 15 * 60 * 1000

interface AppLockContextType {
	/** true cuando hay sesión pero hace falta autenticarse para seguir. */
	isLocked: boolean
	/** Pide autenticación al dispositivo. Devuelve true si desbloqueó. */
	unlock: () => Promise<boolean>
}

const AppLockContext = createContext<AppLockContextType | undefined>(undefined)

const now = () => Date.now()

const readLastActive = async (): Promise<number | null> => {
	try {
		const raw = await AsyncStorage.getItem(LAST_ACTIVE_KEY)
		if (!raw) return null
		const parsed = Number(raw)
		return Number.isFinite(parsed) ? parsed : null
	} catch (err) {
		console.warn('[AppLock] no se pudo leer la última actividad:', err)
		return null
	}
}

const writeLastActive = async () => {
	try {
		await AsyncStorage.setItem(LAST_ACTIVE_KEY, String(now()))
	} catch (err) {
		console.warn('[AppLock] no se pudo guardar la última actividad:', err)
	}
}

/** El dispositivo puede validar identidad (huella, cara o PIN/patrón). */
const deviceCanAuthenticate = async (): Promise<boolean> => {
	try {
		const level = await LocalAuthentication.getEnrolledLevelAsync()
		return level !== LocalAuthentication.SecurityLevel.NONE
	} catch (err) {
		console.warn('[AppLock] no se pudo consultar el nivel de seguridad:', err)
		return false
	}
}

export function AppLockProvider({ children }: { children: ReactNode }) {
	const { isAuthenticated } = useAuth()
	const [locked, setLocked] = useState(false)
	const appState = useRef<AppStateStatus>(AppState.currentState)
	// Sin forma de validar identidad no se bloquea: dejaríamos al usuario con una
	// pantalla que no puede pasar, y en un teléfono sin bloqueo tampoco hay nada
	// que proteger.
	const canAuthenticate = useRef(false)

	useEffect(() => {
		let cancelled = false

		const bootstrap = async () => {
			const [available, lastActive] = await Promise.all([deviceCanAuthenticate(), readLastActive()])
			if (cancelled) return

			canAuthenticate.current = available

			// Arranque en frío: si la última actividad quedó vieja, se pide autenticación.
			if (available && lastActive !== null && now() - lastActive > INACTIVITY_LIMIT_MS) {
				setLocked(true)
			} else {
				await writeLastActive()
			}
		}

		void bootstrap()

		const subscription = AppState.addEventListener('change', (next) => {
			const previous = appState.current
			appState.current = next

			// 'inactive' en iOS es transitorio (centro de notificaciones, llamada
			// entrante): se marca la salida igual, y si vuelve enseguida no alcanza el
			// límite.
			if (next === 'background' || next === 'inactive') {
				void writeLastActive()
				return
			}

			if (next === 'active' && previous !== 'active') {
				void (async () => {
					const lastActive = await readLastActive()
					if (canAuthenticate.current && lastActive !== null && now() - lastActive > INACTIVITY_LIMIT_MS) {
						setLocked(true)
					} else {
						await writeLastActive()
					}
				})()
			}
		})

		return () => {
			cancelled = true
			subscription.remove()
		}
	}, [])

	// Al cerrar sesión no queda nada que bloquear.
	useEffect(() => {
		if (!isAuthenticated) setLocked(false)
	}, [isAuthenticated])

	const unlock = useCallback(async (): Promise<boolean> => {
		try {
			const result = await LocalAuthentication.authenticateAsync({
				promptMessage: 'Desbloqueá CanchApp',
				// Sin esto, un dispositivo con PIN pero sin huella no tendría con qué
				// desbloquear.
				fallbackLabel: 'Usar PIN del dispositivo',
				cancelLabel: 'Cancelar',
			})

			if (!result.success) return false

			await writeLastActive()
			setLocked(false)
			return true
		} catch (err) {
			console.error('[AppLock] error autenticando:', err)
			return false
		}
	}, [])

	return <AppLockContext.Provider value={{ isLocked: locked && isAuthenticated, unlock }}>{children}</AppLockContext.Provider>
}

export function useAppLock(): AppLockContextType {
	const context = useContext(AppLockContext)
	if (!context) throw new Error('useAppLock must be used within an AppLockProvider')
	return context
}
