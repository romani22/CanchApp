import { biometricService } from '@/services/biometric.service'
import { useCallback } from 'react'

/**
 * Envoltorio del servicio de biometría para las pantallas.
 *
 * La lógica y el porqué de cada decisión están en services/biometric.service.ts —
 * sobre todo el motivo de que acá ya no se guarde la contraseña. Este hook existe para
 * que las pantallas no importen el servicio directamente y para tener las callbacks
 * estables como dependencias de efectos.
 */
export function useBiometricAuth() {
	const isAvailable = useCallback(() => biometricService.isAvailable(), [])
	const isEnabled = useCallback(() => biometricService.isEnabled(), [])
	/** Activa la huella guardando el refresh token de la sesión abierta. */
	const enable = useCallback((refreshToken?: string | null) => biometricService.enable(refreshToken), [])
	const disable = useCallback(() => biometricService.disable(), [])
	/** ¿Hay un token con el que entrar ahora? Es lo que decide si se muestra el botón. */
	const hasStoredToken = useCallback(() => biometricService.hasStoredToken(), [])
	/** Borra el token dejando la preferencia: se rearma sola en el próximo ingreso. */
	const clearRefreshToken = useCallback(() => biometricService.clearRefreshToken(), [])
	/** Pide la huella y devuelve el refresh token guardado, o null. */
	const authenticate = useCallback(() => biometricService.authenticate(), [])

	return { isAvailable, isEnabled, enable, disable, hasStoredToken, clearRefreshToken, authenticate }
}
