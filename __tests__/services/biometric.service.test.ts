import { biometricService } from '@/services/biometric.service'
import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'

// expo-secure-store ya está mockeado en __tests__/setup.ts; expo-local-authentication
// no, así que se mockea acá. Va en el archivo y no en el setup para no cambiarle el
// entorno a los tests de AppLockContext, que también lo usan y traen el suyo.
jest.mock('expo-local-authentication', () => ({
	authenticateAsync: jest.fn(),
	hasHardwareAsync: jest.fn(),
	isEnrolledAsync: jest.fn(),
	getEnrolledLevelAsync: jest.fn(),
	SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
}))

const secureStore = SecureStore as jest.Mocked<typeof SecureStore>
const localAuth = LocalAuthentication as jest.Mocked<typeof LocalAuthentication>

const ENABLED_KEY = 'biometric_enabled'
const REFRESH_TOKEN_KEY = 'biometric_refresh_token'
const LEGACY_KEY = 'biometric_credentials'

/** Simula el almacén: devuelve lo que haya en el mapa para cada clave. */
const stubStore = (contents: Record<string, string | null>) => {
	secureStore.getItemAsync.mockImplementation(async (key: string) => contents[key] ?? null)
}

/**
 * Almacén con estado: lo que se escribe se puede volver a leer, como el de verdad.
 *
 * Hace falta para enable(), que escribe la preferencia y enseguida la lee —
 * storeRefreshToken() consulta isEnabled() antes de guardar. Con el stub de sólo
 * lectura ese encadenado no se puede observar, que es justo lo que hay que verificar.
 */
const statefulStore = (initial: Record<string, string> = {}) => {
	const contents: Record<string, string> = { ...initial }
	secureStore.getItemAsync.mockImplementation(async (key: string) => contents[key] ?? null)
	secureStore.setItemAsync.mockImplementation(async (key: string, value: string) => {
		contents[key] = value
	})
	secureStore.deleteItemAsync.mockImplementation(async (key: string) => {
		delete contents[key]
	})
	return contents
}

describe('biometricService — acceso con huella sin guardar la contraseña', () => {
	beforeEach(() => {
		jest.clearAllMocks()
		secureStore.setItemAsync.mockResolvedValue(undefined)
		secureStore.deleteItemAsync.mockResolvedValue(undefined)
	})

	describe('purgeLegacyCredentials()', () => {
		it('borra las credenciales que la versión vieja dejó en el dispositivo', async () => {
			// El caso real: alguien que ya tenía la huella activada tiene su contraseña
			// guardada AHORA. Cambiar el código no la saca del teléfono.
			stubStore({ [LEGACY_KEY]: JSON.stringify({ email: 'a@b.com', password: 'Secreta123' }) })

			await biometricService.purgeLegacyCredentials()

			expect(secureStore.deleteItemAsync).toHaveBeenCalledWith(LEGACY_KEY)
		})

		it('además desactiva la huella, para no dejar un botón que no funciona', async () => {
			// El token nuevo todavía no existe: si quedara activada, el botón de huella
			// aparecería y fallaría.
			stubStore({ [LEGACY_KEY]: '{"email":"a@b.com","password":"x"}' })

			await biometricService.purgeLegacyCredentials()

			expect(secureStore.deleteItemAsync).toHaveBeenCalledWith(ENABLED_KEY)
		})

		it('no toca nada si no hay credenciales viejas', async () => {
			stubStore({})

			await biometricService.purgeLegacyCredentials()

			expect(secureStore.deleteItemAsync).not.toHaveBeenCalled()
		})

		it('no explota si el almacén falla', async () => {
			// Corre en el arranque de la app: un error acá no puede impedir que abra.
			secureStore.getItemAsync.mockRejectedValue(new Error('keystore no disponible'))

			await expect(biometricService.purgeLegacyCredentials()).resolves.toBeUndefined()
		})
	})

	describe('storeRefreshToken()', () => {
		it('guarda el token cuando la huella está activada', async () => {
			stubStore({ [ENABLED_KEY]: 'true' })

			await biometricService.storeRefreshToken('refresh-abc')

			expect(secureStore.setItemAsync).toHaveBeenCalledWith(REFRESH_TOKEN_KEY, 'refresh-abc')
		})

		it('NO guarda nada si la huella no está activada', async () => {
			// No se guarda un secreto que nadie pidió: se llama en cada evento de sesión.
			stubStore({ [ENABLED_KEY]: null })

			await biometricService.storeRefreshToken('refresh-abc')

			expect(secureStore.setItemAsync).not.toHaveBeenCalled()
		})

		it('ignora un token vacío o ausente', async () => {
			stubStore({ [ENABLED_KEY]: 'true' })

			await biometricService.storeRefreshToken(null)
			await biometricService.storeRefreshToken(undefined)
			await biometricService.storeRefreshToken('')

			expect(secureStore.setItemAsync).not.toHaveBeenCalled()
		})

		it('no propaga errores del almacén', async () => {
			// El peor caso aceptable es tener que entrar con contraseña la próxima vez;
			// romper el login no lo es.
			stubStore({ [ENABLED_KEY]: 'true' })
			secureStore.setItemAsync.mockRejectedValue(new Error('sin espacio'))

			await expect(biometricService.storeRefreshToken('refresh-abc')).resolves.toBeUndefined()
		})
	})

	describe('authenticate()', () => {
		it('devuelve el refresh token después de una huella válida', async () => {
			localAuth.authenticateAsync.mockResolvedValue({ success: true } as any)
			stubStore({ [REFRESH_TOKEN_KEY]: 'refresh-abc' })

			await expect(biometricService.authenticate()).resolves.toBe('refresh-abc')
		})

		it('no lee el token si la huella falla o el usuario cancela', async () => {
			localAuth.authenticateAsync.mockResolvedValue({ success: false, error: 'user_cancel' } as any)
			stubStore({ [REFRESH_TOKEN_KEY]: 'refresh-abc' })

			await expect(biometricService.authenticate()).resolves.toBeNull()
			expect(secureStore.getItemAsync).not.toHaveBeenCalledWith(REFRESH_TOKEN_KEY)
		})

		it('devuelve null si no hay token guardado', async () => {
			localAuth.authenticateAsync.mockResolvedValue({ success: true } as any)
			stubStore({})

			await expect(biometricService.authenticate()).resolves.toBeNull()
		})
	})

	describe('enable() / disable()', () => {
		it('activar guarda la preferencia y el refresh token, nunca la contraseña', async () => {
			const almacen = statefulStore()

			await biometricService.enable('refresh-abc')

			expect(almacen[ENABLED_KEY]).toBe('true')
			expect(almacen[REFRESH_TOKEN_KEY]).toBe('refresh-abc')
		})

		it('el token se guarda DESPUÉS de la preferencia', async () => {
			// storeRefreshToken() no escribe nada si la huella no figura como activada, así
			// que al revés dejaría la preferencia prendida y el almacén vacío: un botón de
			// huella que después no deja entrar.
			statefulStore()

			await biometricService.enable('refresh-abc')

			const claves = secureStore.setItemAsync.mock.calls.map(([clave]) => clave)
			expect(claves).toEqual([ENABLED_KEY, REFRESH_TOKEN_KEY])
		})

		it('activar sin token no inventa nada: queda la preferencia sola', async () => {
			const almacen = statefulStore()

			await biometricService.enable()

			expect(almacen[ENABLED_KEY]).toBe('true')
			expect(almacen[REFRESH_TOKEN_KEY]).toBeUndefined()
		})

		it('desactivar borra la preferencia, el token y los restos de la versión vieja', async () => {
			await biometricService.disable()

			expect(secureStore.deleteItemAsync).toHaveBeenCalledWith(ENABLED_KEY)
			expect(secureStore.deleteItemAsync).toHaveBeenCalledWith(REFRESH_TOKEN_KEY)
			expect(secureStore.deleteItemAsync).toHaveBeenCalledWith(LEGACY_KEY)
		})
	})

	describe('hasStoredToken() / clearRefreshToken()', () => {
		it('hay token cuando el almacén lo tiene', async () => {
			stubStore({ [REFRESH_TOKEN_KEY]: 'refresh-abc' })

			await expect(biometricService.hasStoredToken()).resolves.toBe(true)
		})

		it('no hay token cuando el almacén está vacío', async () => {
			// Es lo que hace que el login muestre mail y contraseña en vez de un botón
			// de huella que no entra.
			stubStore({})

			await expect(biometricService.hasStoredToken()).resolves.toBe(false)
		})

		it('si el almacén falla, se asume que no hay token', async () => {
			secureStore.getItemAsync.mockRejectedValue(new Error('keystore no disponible'))

			await expect(biometricService.hasStoredToken()).resolves.toBe(false)
		})

		it('borrar el token deja la preferencia intacta', async () => {
			// El usuario ya dijo que quiere huella; no hay que volver a preguntárselo.
			// AuthContext rearma el token en el próximo ingreso con contraseña.
			const almacen = statefulStore({ [ENABLED_KEY]: 'true', [REFRESH_TOKEN_KEY]: 'refresh-abc' })

			await biometricService.clearRefreshToken()

			expect(almacen[REFRESH_TOKEN_KEY]).toBeUndefined()
			expect(almacen[ENABLED_KEY]).toBe('true')
		})

		it('cerrar sesión y volver a ingresar rearma la huella sola', async () => {
			// El ciclo completo: activar → cerrar sesión (el logout revoca el token) →
			// ingresar con contraseña. La preferencia sobrevive, así que el evento de
			// sesión vuelve a guardar el token y el botón reaparece sin intervención.
			const almacen = statefulStore()

			await biometricService.enable('refresh-1')
			await biometricService.clearRefreshToken()
			expect(await biometricService.hasStoredToken()).toBe(false)

			await biometricService.storeRefreshToken('refresh-2')

			expect(almacen[REFRESH_TOKEN_KEY]).toBe('refresh-2')
			expect(await biometricService.hasStoredToken()).toBe(true)
		})
	})

	it('en ningún camino se escribe una contraseña', async () => {
		// La red de seguridad del cambio entero: si alguien vuelve a meter la contraseña
		// en el almacén, esto lo tiene que ver.
		stubStore({ [ENABLED_KEY]: 'true' })
		localAuth.authenticateAsync.mockResolvedValue({ success: true } as any)

		await biometricService.enable('refresh-abc')
		await biometricService.storeRefreshToken('refresh-abc')
		await biometricService.authenticate()

		const escrituras = secureStore.setItemAsync.mock.calls
		for (const [clave, valor] of escrituras) {
			expect(clave).not.toBe(LEGACY_KEY)
			expect(String(valor)).not.toMatch(/password/i)
		}
	})
})
