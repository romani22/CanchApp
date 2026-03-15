import * as Location from 'expo-location'
import { useCallback, useState } from 'react'

export type LocationResult = {
	zone: string
	coordinates: { x: number; y: number }
}

export type UseLocationReturn = {
	loading: boolean
	permissionGranted: boolean | null
	detect: () => Promise<LocationResult | null>
	requestPermission: () => Promise<boolean>
}

/**
 * Hook reutilizable para obtener la ubicación actual del usuario
 * con reverse geocoding para obtener el nombre del barrio/zona.
 *
 * Uso:
 *   const { detect, loading } = useLocation()
 *   const result = await detect()
 *   // result => { zone: "Palermo", coordinates: { x: -58.43, y: -34.58 } }
 */
export function useLocation(): UseLocationReturn {
	const [loading, setLoading] = useState(false)
	const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null)

	const requestPermission = useCallback(async (): Promise<boolean> => {
		const { status } = await Location.requestForegroundPermissionsAsync()
		const granted = status === Location.PermissionStatus.GRANTED
		setPermissionGranted(granted)
		return granted
	}, [])

	const detect = useCallback(async (): Promise<LocationResult | null> => {
		try {
			setLoading(true)

			// Verificar permiso existente primero
			const { status } = await Location.getForegroundPermissionsAsync()

			if (status !== Location.PermissionStatus.GRANTED) {
				const granted = await requestPermission()
				if (!granted) return null
			} else {
				setPermissionGranted(true)
			}

			const location = await Location.getCurrentPositionAsync({
				accuracy: Location.Accuracy.Balanced,
			})

			const { latitude, longitude } = location.coords

			// Reverse geocoding
			const [address] = await Location.reverseGeocodeAsync({ latitude, longitude })

			const zone =
				address.district ||
				address.subregion ||
				address.city ||
				address.region ||
				`${latitude.toFixed(3)}, ${longitude.toFixed(3)}`

			return {
				zone,
				coordinates: { x: longitude, y: latitude },
			}
		} catch (err) {
			console.error('[useLocation] Error:', err)
			return null
		} finally {
			setLoading(false)
		}
	}, [requestPermission])

	return { loading, permissionGranted, detect, requestPermission }
}
