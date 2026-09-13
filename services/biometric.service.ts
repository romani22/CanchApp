import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'

/**
 * Acceso con huella / Face ID, sin guardar la contraseña.
 *
 * QUÉ CAMBIÓ Y POR QUÉ
 *
 * La primera versión guardaba `{ email, password }` en SecureStore y en el login con
 * huella volvía a llamar a signInWithPassword con esos datos. Funcionaba, pero el
 * secreto guardado era la contraseña real de la persona, y eso es lo peor que se
 * puede elegir para guardar:
 *
 *   · No se puede revocar. Si se filtra, no hay nada que apagar del lado del
 *     servidor: sigue siendo válida hasta que el usuario la cambie, y no se va a
 *     enterar de que tiene que cambiarla.
 *   · El daño sale de CanchApp. La gente reusa contraseñas, así que la de acá
 *     probablemente abra el mail de esa persona.
 *
 * Ahora se guarda el REFRESH TOKEN de la sesión. Mismo comportamiento para el
 * usuario —apoya el dedo y entra— con un secreto que sí se puede revocar (cerrar
 * sesión lo invalida), que sólo sirve para esta app, y que no revela la contraseña.
 *
 * SOBRE requireAuthentication
 *
 * SecureStore permite atar un ítem a la biometría con `requireAuthentication: true`,
 * y sería criptográficamente más fuerte que el chequeo que hacemos en JS. No se usa,
 * y el motivo es concreto: en Android esa opción exige autenticación del usuario para
 * USAR la clave, y eso incluye escribir. El refresh token rota en cada renovación
 * (`enable_refresh_token_rotation` está activo), así que habría que reescribirlo cada
 * hora — y cada reescritura le pediría la huella al usuario, en medio de cualquier
 * cosa que estuviera haciendo. Inusable.
 *
 * La consecuencia hay que tenerla clara: el gate biométrico de acá es una decisión de
 * la app, no una propiedad de la clave, así que en un dispositivo rooteado se puede
 * saltear y leer el token. Por eso importa TANTO qué se guarda: un token revocable y
 * acotado a esta app en vez de una contraseña reusable.
 */

const ENABLED_KEY = 'biometric_enabled'
const REFRESH_TOKEN_KEY = 'biometric_refresh_token'

/**
 * La clave de la versión vieja, la que tenía la contraseña en claro.
 *
 * Se borra en cada arranque, no sólo cuando el usuario desactiva la huella: quien ya
 * la tenía activada tiene su contraseña guardada en el teléfono AHORA, y cambiar el
 * código no la saca de ahí. Sin este borrado, el arreglo sólo valdría para las
 * instalaciones nuevas.
 */
const LEGACY_CREDENTIALS_KEY = 'biometric_credentials'

export const biometricService = {
	/** El dispositivo tiene hardware y al menos una huella o cara registrada. */
	async isAvailable(): Promise<boolean> {
		try {
			const [hasHardware, isEnrolled] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()])
			return hasHardware && isEnrolled
		} catch (err) {
			console.warn('[Biometric] no se pudo consultar el hardware:', err)
			return false
		}
	},

	async isEnabled(): Promise<boolean> {
		try {
			return (await SecureStore.getItemAsync(ENABLED_KEY)) === 'true'
		} catch (err) {
			console.warn('[Biometric] no se pudo leer la preferencia:', err)
			return false
		}
	},

	/**
	 * Activa el acceso con huella. Nunca recibe la contraseña: se le pasa el refresh
	 * token de la sesión que está abierta en este momento.
	 *
	 * El token es un argumento y no algo que este servicio busque solo, porque quien
	 * activa la huella es una pantalla y la sesión la tiene el AuthContext. Pero SÍ hay
	 * que pasárselo: activar sin guardar deja la preferencia prendida y el almacén
	 * vacío, y el usuario se encuentra un botón de huella que no lo deja entrar.
	 *
	 * Ese era el agujero de la primera versión. Se apoyaba en que AuthContext guardara
	 * el token "en el próximo evento de sesión", pero el orden real es al revés: el
	 * SIGNED_IN del login ya pasó cuando el usuario toca "Activar", y en ese momento
	 * storeRefreshToken() se había ido de largo porque la huella todavía no estaba
	 * activada. El token recién aparecía en el siguiente arranque en frío o en la
	 * renovación de la hora siguiente.
	 *
	 * De acá en adelante AuthContext lo sigue manteniendo al día en cada renovación
	 * (el token rota); esto sólo cubre el primer guardado.
	 */
	async enable(refreshToken?: string | null): Promise<void> {
		await SecureStore.setItemAsync(ENABLED_KEY, 'true')
		// Después de marcar la preferencia, no antes: storeRefreshToken() no escribe
		// nada si la huella no figura como activada.
		await this.storeRefreshToken(refreshToken)
	},

	async disable(): Promise<void> {
		await Promise.all([SecureStore.deleteItemAsync(ENABLED_KEY), SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY), SecureStore.deleteItemAsync(LEGACY_CREDENTIALS_KEY)])
	},

	/**
	 * ¿Hay un token guardado con el que se pueda entrar ahora mismo?
	 *
	 * Es lo que decide si el botón de huella se muestra en el login, y es distinto de
	 * isEnabled(): la preferencia dice qué quiere el usuario, esto dice si además hay
	 * con qué cumplirlo. Separarlos es lo que evita el peor caso — un botón visible que
	 * al apoyar el dedo termina en un error y manda a escribir la contraseña igual.
	 */
	async hasStoredToken(): Promise<boolean> {
		try {
			return (await SecureStore.getItemAsync(REFRESH_TOKEN_KEY)) !== null
		} catch (err) {
			console.warn('[Biometric] no se pudo consultar el token guardado:', err)
			return false
		}
	},

	/**
	 * Borra el token guardado y deja la preferencia intacta.
	 *
	 * Se llama cuando el token dejó de servir, y el caso principal es cerrar sesión:
	 * el logout de Supabase lo revoca del lado del servidor, así que desde ese instante
	 * el que quedó en el teléfono es basura que sólo sirve para mostrar un botón que
	 * falla. Con `{ scope: 'local' }` pasa lo mismo — no hay forma de desloguearse y
	 * conservarlo.
	 *
	 * La preferencia NO se toca a propósito: el usuario ya dijo que quiere entrar con
	 * huella, y no hay que volver a preguntárselo. Como AuthContext guarda el token en
	 * cada evento de sesión mientras la preferencia esté activa, el próximo ingreso con
	 * contraseña la vuelve a armar solo, sin que el usuario haga nada.
	 */
	async clearRefreshToken(): Promise<void> {
		try {
			await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY)
		} catch (err) {
			console.warn('[Biometric] no se pudo borrar el token guardado:', err)
		}
	},

	/**
	 * Guarda el refresh token vigente. Silencioso y idempotente: lo llama AuthContext
	 * en cada evento de sesión, incluido TOKEN_REFRESHED, que es lo que evita que el
	 * token guardado quede viejo y el login con huella falle al mes.
	 *
	 * No hace nada si la huella no está activada: no se guarda un secreto que nadie
	 * pidió.
	 */
	async storeRefreshToken(refreshToken: string | null | undefined): Promise<void> {
		if (!refreshToken) return
		try {
			if (!(await this.isEnabled())) return
			await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken)
		} catch (err) {
			// Que falle no puede romper el login: el peor caso es que la próxima vez haya
			// que entrar con mail y contraseña.
			console.warn('[Biometric] no se pudo guardar el refresh token:', err)
		}
	},

	/**
	 * Pide la huella y devuelve el refresh token guardado, o null si el usuario
	 * canceló, no hay token, o la autenticación falló.
	 */
	async authenticate(): Promise<string | null> {
		const result = await LocalAuthentication.authenticateAsync({
			promptMessage: 'Ingresá a CanchApp',
			// Sin esto, un dispositivo con PIN pero sin huella no tendría con qué entrar.
			fallbackLabel: 'Usar contraseña',
			cancelLabel: 'Cancelar',
		})

		if (!result.success) return null

		return SecureStore.getItemAsync(REFRESH_TOKEN_KEY)
	},

	/**
	 * Borra los restos de la versión que guardaba la contraseña. Se llama al arrancar
	 * la app, siempre, sin importar si hay sesión.
	 *
	 * Y desactiva la huella si había credenciales viejas: el token nuevo todavía no
	 * existe, así que dejarla activada mostraría el botón de huella y no funcionaría.
	 * Mejor que el usuario entre una vez con contraseña y la vuelva a activar.
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
