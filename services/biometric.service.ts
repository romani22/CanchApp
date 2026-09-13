import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'

/**
 * Acceso con huella. Guarda el refresh token de la sesión, nunca la contraseña.
 *
 * No se usa `requireAuthentication` de SecureStore porque en Android exige
 * autenticación también para escribir, y el token rota cada hora. El gate queda
 * entonces en JS y es salteable en un dispositivo rooteado: por eso importa que lo
 * guardado sea revocable.
 */

const ENABLED_KEY = 'biometric_enabled'
const REFRESH_TOKEN_KEY = 'biometric_refresh_token'

/** Clave de la versión que guardaba la contraseña en claro. Ver purgeLegacyCredentials(). */
const LEGACY_CREDENTIALS_KEY = 'biometric_credentials'

export const biometricService = {
	async isAvailable(): Promise<boolean> {
		try {
			const [hasHardware, isEnrolled] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()])
			return hasHardware && isEnrolled
		} catch (err) {
			console.warn('[Biometric] no se pudo consultar el hardware:', err)
			return false
		}
	},

	/** La preferencia del usuario. Distinta de hasStoredToken(). */
	async isEnabled(): Promise<boolean> {
		try {
			return (await SecureStore.getItemAsync(ENABLED_KEY)) === 'true'
		} catch (err) {
			console.warn('[Biometric] no se pudo leer la preferencia:', err)
			return false
		}
	},

	/** Activar sin guardar el token dejaría un botón de huella que no deja entrar. */
	async enable(refreshToken?: string | null): Promise<void> {
		// Primero la preferencia: storeRefreshToken() no escribe sin ella.
		await SecureStore.setItemAsync(ENABLED_KEY, 'true')
		await this.storeRefreshToken(refreshToken)
	},

	async disable(): Promise<void> {
		await Promise.all([SecureStore.deleteItemAsync(ENABLED_KEY), SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY), SecureStore.deleteItemAsync(LEGACY_CREDENTIALS_KEY)])
	},

	/** Decide si se muestra el botón: la preferencia sola mostraría uno que falla. */
	async hasStoredToken(): Promise<boolean> {
		try {
			return (await SecureStore.getItemAsync(REFRESH_TOKEN_KEY)) !== null
		} catch (err) {
			console.warn('[Biometric] no se pudo consultar el token guardado:', err)
			return false
		}
	},

	/**
	 * Al cerrar sesión el servidor revoca el token. La preferencia queda, así que el
	 * próximo ingreso con contraseña lo rearma solo.
	 */
	async clearRefreshToken(): Promise<void> {
		try {
			await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY)
		} catch (err) {
			console.warn('[Biometric] no se pudo borrar el token guardado:', err)
		}
	},

	/** Lo llama AuthContext en cada evento de sesión: el token rota. */
	async storeRefreshToken(refreshToken: string | null | undefined): Promise<void> {
		if (!refreshToken) return
		try {
			if (!(await this.isEnabled())) return
			await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken)
		} catch (err) {
			// No puede romper el login: el peor caso es entrar con contraseña.
			console.warn('[Biometric] no se pudo guardar el refresh token:', err)
		}
	},

	/** Devuelve el token guardado, o null si el usuario canceló o no hay token. */
	async authenticate(): Promise<string | null> {
		const result = await LocalAuthentication.authenticateAsync({
			promptMessage: 'Ingresá a CanchApp',
			fallbackLabel: 'Usar contraseña',
			cancelLabel: 'Cancelar',
		})

		if (!result.success) return null

		return SecureStore.getItemAsync(REFRESH_TOKEN_KEY)
	},

	/**
	 * Borra la contraseña que dejó la versión anterior y desactiva la huella, porque
	 * el token nuevo todavía no existe. Cambiar el código no la saca del teléfono.
	 */
	async purgeLegacyCredentials(): Promise<void> {
		try {
			const legacy = await SecureStore.getItemAsync(LEGACY_CREDENTIALS_KEY)
			if (legacy === null) return

			await SecureStore.deleteItemAsync(LEGACY_CREDENTIALS_KEY)
			await SecureStore.deleteItemAsync(ENABLED_KEY)
			console.log('[Biometric] se borraron las credenciales guardadas por la versión anterior')
		} catch (err) {
			console.warn('[Biometric] no se pudieron borrar las credenciales viejas:', err)
		}
	},
}
