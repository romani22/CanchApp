import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'
import { useCallback } from 'react'

const CREDENTIALS_KEY = 'biometric_credentials'
const ENABLED_KEY = 'biometric_enabled'

export function useBiometricAuth() {
	const isAvailable = useCallback(async (): Promise<boolean> => {
		const hasHardware = await LocalAuthentication.hasHardwareAsync()
		const isEnrolled = await LocalAuthentication.isEnrolledAsync()
		return hasHardware && isEnrolled
	}, [])

	const isEnabled = useCallback(async (): Promise<boolean> => {
		const value = await SecureStore.getItemAsync(ENABLED_KEY)
		return value === 'true'
	}, [])

	const enable = useCallback(async (email: string, password: string): Promise<void> => {
		await SecureStore.setItemAsync(CREDENTIALS_KEY, JSON.stringify({ email, password }))
		await SecureStore.setItemAsync(ENABLED_KEY, 'true')
	}, [])

	const disable = useCallback(async (): Promise<void> => {
		await SecureStore.deleteItemAsync(CREDENTIALS_KEY)
		await SecureStore.deleteItemAsync(ENABLED_KEY)
	}, [])

	const authenticate = useCallback(async (): Promise<{ email: string; password: string } | null> => {
		const result = await LocalAuthentication.authenticateAsync({
			promptMessage: 'Ingresá a CanchApp',
			fallbackLabel: 'Usar contraseña',
			cancelLabel: 'Cancelar',
		})

		if (!result.success) return null

		const stored = await SecureStore.getItemAsync(CREDENTIALS_KEY)
		if (!stored) return null

		return JSON.parse(stored)
	}, [])

	return { isAvailable, isEnabled, enable, disable, authenticate }
}
