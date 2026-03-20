import * as Location from 'expo-location'
import { useCallback, useRef, useState } from 'react'

export type LocationResult = {
	/** Nombre de la localidad, ej: "Morteros", "Córdoba" */
	zone: string
	/** Coordenadas {x: longitud, y: latitud} para Supabase POINT */
	coordinates: { x: number; y: number }
}

export type UseLocationReturn = {
	loading: boolean
	geocoding: boolean
	permissionGranted: boolean | null
	/** Detecta la ubicación actual del dispositivo (GPS + reverse geocoding) */
	detect: () => Promise<LocationResult | null>
	/** Geocodifica un texto de localidad a coordenadas. Retorna null si no encuentra. */
	geocodeZone: (zoneName: string) => Promise<{ x: number; y: number } | null>
	requestPermission: () => Promise<boolean>
}

export function useLocation(): UseLocationReturn {
	const [loading, setLoading] = useState(false)
	const [geocoding, setGeocoding] = useState(false)
	const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null)
	const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

	const requestPermission = useCallback(async (): Promise<boolean> => {
		const { status } = await Location.requestForegroundPermissionsAsync()
		const granted = status === Location.PermissionStatus.GRANTED
		setPermissionGranted(granted)
		return granted
	}, [])

	/** GPS → reverse geocoding → nombre de localidad + coords */
	const detect = useCallback(async (): Promise<LocationResult | null> => {
		try {
			setLoading(true)
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
			const [address] = await Location.reverseGeocodeAsync({ latitude, longitude })

			const zone = address.city || address.subregion || address.region || `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`

			return { zone, coordinates: { x: longitude, y: latitude } }
		} catch (err) {
			console.error('[useLocation] detect error:', err)
			return null
		} finally {
			setLoading(false)
		}
	}, [requestPermission])

	/**
	 * Forward geocoding: convierte un texto ("Morteros", "Córdoba capital") a coordenadas.
	 * Usa expo-location.geocodeAsync internamente — no requiere permiso de GPS.
	 * Retorna { x: longitud, y: latitud } o null si no encontró resultados.
	 */
	const geocodeZone = useCallback(async (zoneName: string): Promise<{ x: number; y: number } | null> => {
		if (!zoneName.trim() || zoneName.trim().length < 3) return null
		try {
			setGeocoding(true)
			// Agregar "Argentina" para mejorar la precisión de localidades pequeñas
			const query = `${zoneName.trim()}, Argentina`
			const results = await Location.geocodeAsync(query)
			if (!results || results.length === 0) return null
			const { longitude, latitude } = results[0]
			return { x: longitude, y: latitude }
		} catch (err) {
			console.error('[useLocation] geocodeZone error:', err)
			return null
		} finally {
			setGeocoding(false)
		}
	}, [])

	return { loading, geocoding, permissionGranted, detect, geocodeZone, requestPermission }
}
