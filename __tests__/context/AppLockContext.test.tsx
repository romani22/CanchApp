import { AppLockProvider, useAppLock } from '@/context/AppLockContext'
import { renderHook, waitFor } from '@testing-library/react-native'
import React from 'react'
import { AppState, AppStateStatus } from 'react-native'

// ── expo-local-authentication mock ────────────────────────────────────────────
jest.mock('expo-local-authentication', () => ({
	getEnrolledLevelAsync: jest.fn().mockResolvedValue(2),
	authenticateAsync: jest.fn().mockResolvedValue({ success: true }),
	SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
}))

const localAuth = jest.requireMock('expo-local-authentication') as {
	getEnrolledLevelAsync: jest.Mock
	authenticateAsync: jest.Mock
}

// ── Auth mock ─────────────────────────────────────────────────────────────────
jest.mock('@/context/AuthContext', () => {
	const mockFn = jest.fn()
	return { useAuth: () => mockFn(), __mockUseAuth: mockFn }
})

const mockUseAuth = (jest.requireMock('@/context/AuthContext') as { __mockUseAuth: jest.Mock }).__mockUseAuth

const AsyncStorage = jest.requireMock('@react-native-async-storage/async-storage') as {
	getItem: jest.Mock
	setItem: jest.Mock
	removeItem: jest.Mock
}

const LAST_ACTIVE_KEY = 'canchapp:last_active_at'
const THIRTY_ONE_MINUTES = 31 * 60 * 1000

const wrapper = ({ children }: { children: React.ReactNode }) => <AppLockProvider>{children}</AppLockProvider>

/** El timestamp guardado, o null si nunca se escribió / se borró. */
const setStoredLastActive = (value: number | null) => {
	AsyncStorage.getItem.mockImplementation(async (key: string) => (key === LAST_ACTIVE_KEY && value !== null ? String(value) : null))
}

const authState = (over: { isAuthenticated: boolean; isLoading?: boolean }) => ({
	isLoading: false,
	...over,
})

// AppState.emit no existe en el mock de jest-expo: se intercepta el registro del
// listener para poder dispararlo a mano.
let emitAppState: (state: AppStateStatus) => void = () => {}

beforeEach(() => {
	jest.clearAllMocks()
	setStoredLastActive(null)
	localAuth.getEnrolledLevelAsync.mockResolvedValue(2)
	localAuth.authenticateAsync.mockResolvedValue({ success: true })

	emitAppState = () => {}
	jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
		emitAppState = handler as (state: AppStateStatus) => void
		return { remove: jest.fn() } as never
	})
})

afterEach(() => {
	jest.restoreAllMocks()
})

describe('AppLockContext', () => {
	it('bloquea al arrancar con sesión restaurada y el reloj vencido', async () => {
		setStoredLastActive(Date.now() - THIRTY_ONE_MINUTES)
		mockUseAuth.mockReturnValue(authState({ isAuthenticated: true }))

		const { result } = renderHook(() => useAppLock(), { wrapper })

		await waitFor(() => expect(result.current.isLocked).toBe(true))
	})

	it('no bloquea si la última actividad es reciente', async () => {
		setStoredLastActive(Date.now() - 60 * 1000)
		mockUseAuth.mockReturnValue(authState({ isAuthenticated: true }))

		const { result } = renderHook(() => useAppLock(), { wrapper })

		await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalled())
		expect(result.current.isLocked).toBe(false)
	})

	// El bug que motivó el cambio: el reloj sobrevivía al logout, así que loguearse
	// después de un rato largo te dejaba en la pantalla de desbloqueo recién entrado.
	it('no pide desbloqueo después de loguearse, aunque el reloj viejo esté vencido', async () => {
		setStoredLastActive(Date.now() - THIRTY_ONE_MINUTES)
		mockUseAuth.mockReturnValue(authState({ isAuthenticated: false }))

		const { result, rerender } = renderHook(() => useAppLock(), { wrapper })

		// Sin sesión, el reloj se descarta.
		await waitFor(() => expect(AsyncStorage.removeItem).toHaveBeenCalledWith(LAST_ACTIVE_KEY))
		setStoredLastActive(null)

		// Y ahora el login.
		mockUseAuth.mockReturnValue(authState({ isAuthenticated: true }))
		rerender(undefined)

		await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalledWith(LAST_ACTIVE_KEY, expect.any(String)))
		expect(result.current.isLocked).toBe(false)
	})

	// Mientras AuthContext resuelve, isAuthenticated es false pero todavía no
	// significa "no hay sesión": borrar el reloj ahí desactivaría el bloqueo en cada
	// arranque en frío.
	it('no toca el reloj mientras la sesión se está cargando', async () => {
		setStoredLastActive(Date.now() - THIRTY_ONE_MINUTES)
		mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: true })

		const { result, rerender } = renderHook(() => useAppLock(), { wrapper })

		await waitFor(() => expect(result.current.isLocked).toBe(false))
		expect(AsyncStorage.removeItem).not.toHaveBeenCalled()

		mockUseAuth.mockReturnValue(authState({ isAuthenticated: true }))
		rerender(undefined)

		await waitFor(() => expect(result.current.isLocked).toBe(true))
	})

	it('no bloquea si el teléfono no tiene forma de validar identidad', async () => {
		localAuth.getEnrolledLevelAsync.mockResolvedValue(0)
		setStoredLastActive(Date.now() - THIRTY_ONE_MINUTES)
		mockUseAuth.mockReturnValue(authState({ isAuthenticated: true }))

		const { result } = renderHook(() => useAppLock(), { wrapper })

		await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalled())
		expect(result.current.isLocked).toBe(false)
	})

	it('no corre el reloj al minimizar sin sesión', async () => {
		mockUseAuth.mockReturnValue(authState({ isAuthenticated: false }))
		renderHook(() => useAppLock(), { wrapper })

		await waitFor(() => expect(AsyncStorage.removeItem).toHaveBeenCalled())
		AsyncStorage.setItem.mockClear()

		emitAppState('background')

		expect(AsyncStorage.setItem).not.toHaveBeenCalled()
	})

	it('marca la salida al minimizar con sesión abierta', async () => {
		mockUseAuth.mockReturnValue(authState({ isAuthenticated: true }))
		renderHook(() => useAppLock(), { wrapper })

		await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalled())
		AsyncStorage.setItem.mockClear()

		emitAppState('background')

		await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalledWith(LAST_ACTIVE_KEY, expect.any(String)))
	})

	it('bloquea al volver del background después del límite', async () => {
		mockUseAuth.mockReturnValue(authState({ isAuthenticated: true }))
		const { result } = renderHook(() => useAppLock(), { wrapper })

		await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalled())

		emitAppState('background')
		setStoredLastActive(Date.now() - THIRTY_ONE_MINUTES)
		emitAppState('active')

		await waitFor(() => expect(result.current.isLocked).toBe(true))
	})

	it('desbloquea cuando la autenticación del dispositivo sale bien', async () => {
		setStoredLastActive(Date.now() - THIRTY_ONE_MINUTES)
		mockUseAuth.mockReturnValue(authState({ isAuthenticated: true }))

		const { result } = renderHook(() => useAppLock(), { wrapper })
		await waitFor(() => expect(result.current.isLocked).toBe(true))

		await result.current.unlock()

		await waitFor(() => expect(result.current.isLocked).toBe(false))
	})

	it('sigue bloqueada si el usuario cancela la autenticación', async () => {
		localAuth.authenticateAsync.mockResolvedValue({ success: false })
		setStoredLastActive(Date.now() - THIRTY_ONE_MINUTES)
		mockUseAuth.mockReturnValue(authState({ isAuthenticated: true }))

		const { result } = renderHook(() => useAppLock(), { wrapper })
		await waitFor(() => expect(result.current.isLocked).toBe(true))

		await expect(result.current.unlock()).resolves.toBe(false)
		expect(result.current.isLocked).toBe(true)
	})
})
