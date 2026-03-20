import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from './useLocation'

export type LocalidadSuggestion = {
	id: string
	nombre: string
	provincia: string
	/** Coordenadas listas para Supabase POINT {x: longitud, y: latitud} */
	coords: { x: number; y: number }
}

export type VenueZoneState = {
	inputText: string
	suggestions: LocalidadSuggestion[]
	/** Coords confirmadas — solo se setean al seleccionar del dropdown o usar GPS */
	coords: { x: number; y: number } | null
	/** true mientras consulta georef */
	searching: boolean
	/** true si el texto cambió después de la última selección (coords no confirmadas) */
	isDirty: boolean
	onChangeText: (text: string) => void
	onSelect: (item: LocalidadSuggestion) => void
	onDetectGPS: () => Promise<void>
	onDismiss: () => void
}

const GEOREF_URL = 'https://apis.datos.gob.ar/georef/api'

async function searchLocalidades(query: string): Promise<LocalidadSuggestion[]> {
	if (query.trim().length < 2) return []

	const params = new URLSearchParams({
		nombre: query.trim(),
		max: '6',
		campos: 'id,nombre,centroide,provincia',
	})

	const [localRes, municipioRes] = await Promise.allSettled([fetch(`${GEOREF_URL}/localidades?${params}`).then((r) => r.json()), fetch(`${GEOREF_URL}/municipios?${params}`).then((r) => r.json())])

	const seen = new Set<string>()
	const results: LocalidadSuggestion[] = []

	if (localRes.status === 'fulfilled' && localRes.value?.localidades) {
		for (const item of localRes.value.localidades) {
			const key = `${item.nombre}-${item.provincia?.nombre}`
			if (!seen.has(key) && item.centroide?.lon && item.centroide?.lat) {
				seen.add(key)
				results.push({
					id: item.id,
					nombre: item.nombre,
					provincia: item.provincia?.nombre ?? '',
					coords: { x: item.centroide.lon, y: item.centroide.lat },
				})
			}
		}
	}

	if (municipioRes.status === 'fulfilled' && municipioRes.value?.municipios) {
		for (const item of municipioRes.value.municipios) {
			const key = `${item.nombre}-${item.provincia?.nombre}`
			if (!seen.has(key) && item.centroide?.lon && item.centroide?.lat) {
				seen.add(key)
				results.push({
					id: item.id,
					nombre: item.nombre,
					provincia: item.provincia?.nombre ?? '',
					coords: { x: item.centroide.lon, y: item.centroide.lat },
				})
			}
		}
	}

	const q = query.trim().toLowerCase()
	return results.sort((a, b) => {
		const aStarts = a.nombre.toLowerCase().startsWith(q)
		const bStarts = b.nombre.toLowerCase().startsWith(q)
		if (aStarts && !bStarts) return -1
		if (!aStarts && bStarts) return 1
		return a.nombre.localeCompare(b.nombre)
	})
}

export function useVenueZone(initialZone = '', initialCoords: { x: number; y: number } | null = null): VenueZoneState {
	const [inputText, setInputText] = useState(initialZone)
	const [coords, setCoords] = useState<{ x: number; y: number } | null>(initialCoords)
	const [suggestions, setSuggestions] = useState<LocalidadSuggestion[]>([])
	const [searching, setSearching] = useState(false)
	// isDirty: true cuando el usuario tecleó algo después de la última selección
	const [isDirty, setIsDirty] = useState(false)
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const { detect } = useLocation()

	// Sincronizar cuando los valores iniciales llegan del servidor (caso Edit)
	useEffect(() => {
		if (initialZone && initialZone !== inputText) {
			setInputText(initialZone)
			setIsDirty(false)
		}
		if (initialCoords) {
			setCoords(initialCoords)
			setIsDirty(false)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [initialZone, initialCoords])

	const onChangeText = useCallback((text: string) => {
		setInputText(text)
		setIsDirty(true) // El texto cambió → coords ya no son válidas
		setCoords(null) // Limpiar coords hasta que seleccione
		setSuggestions([])

		if (timer.current) clearTimeout(timer.current)
		if (!text.trim() || text.trim().length < 2) return

		timer.current = setTimeout(async () => {
			setSearching(true)
			try {
				const results = await searchLocalidades(text)
				setSuggestions(results)
			} catch (err) {
				console.error('[useVenueZone] search error:', err)
				setSuggestions([])
			} finally {
				setSearching(false)
			}
		}, 350)
	}, [])

	const onSelect = useCallback((item: LocalidadSuggestion) => {
		setInputText(item.nombre)
		setCoords(item.coords)
		setIsDirty(false) // Coords confirmadas
		setSuggestions([])
	}, [])

	const onDetectGPS = useCallback(async () => {
		const result = await detect()
		if (result) {
			setInputText(result.zone)
			setCoords(result.coordinates)
			setIsDirty(false)
			setSuggestions([])
		}
	}, [detect])

	const onDismiss = useCallback(() => setSuggestions([]), [])

	useEffect(
		() => () => {
			if (timer.current) clearTimeout(timer.current)
		},
		[],
	)

	return { inputText, suggestions, coords, searching, isDirty, onChangeText, onSelect, onDetectGPS, onDismiss }
}
