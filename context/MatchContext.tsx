import { ZoneListFilter, matchesService } from '@/services/matches.service'
import { MatchWithCreator, SportType } from '@/types/database.types'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './AuthContext'

export interface ZoneFilter {
	label: string
	lng: number
	lat: number
	radiusKm: number
}

interface MatchFilters {
	sport?: SportType
	date?: string
}

interface MatchContextType {
	matches: MatchWithCreator[]
	filteredMatches: MatchWithCreator[]
	isLoading: boolean
	error: string | null
	filters: MatchFilters
	activeZone: ZoneFilter | null
	setFilters: (filters: MatchFilters) => void
	setZone: (zone: ZoneFilter | null) => void
	clearFilters: () => void
	refreshMatches: () => Promise<void>
	getMatchById: (id: string) => MatchWithCreator | undefined
}

const MatchContext = createContext<MatchContextType | undefined>(undefined)

export function MatchProvider({ children }: { children: React.ReactNode }) {
	const { isAuthenticated, profile } = useAuth()
	const [matches, setMatches] = useState<MatchWithCreator[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [filters, setFilters] = useState<MatchFilters>({})
	const [activeZone, setActiveZone] = useState<ZoneFilter | null>(null)

	// Refs para que fetchMatches siempre lea los valores más actuales
	// sin necesitarlos como dependencias del useCallback
	const filtersRef = useRef(filters)
	const activeZoneRef = useRef(activeZone)
	const isAuthenticatedRef = useRef(isAuthenticated)

	// Mantener los refs sincronizados con el estado
	useEffect(() => {
		filtersRef.current = filters
	}, [filters])
	useEffect(() => {
		activeZoneRef.current = activeZone
	}, [activeZone])
	useEffect(() => {
		isAuthenticatedRef.current = isAuthenticated
	}, [isAuthenticated])

	// Cargar la zona del perfil al autenticarse
	useEffect(() => {
		if (!profile) return
		const coords = profile.zone_coordinates as { x: number; y: number } | null
		if (coords && profile.zone) {
			setActiveZone({
				label: profile.zone,
				lng: coords.x,
				lat: coords.y,
				radiusKm: 20,
			})
		}
	}, [profile?.id])

	// fetchMatches no tiene dependencias variables — siempre lee desde los refs
	// Esto garantiza que refreshMatches() (capturado en cualquier closure)
	// siempre use la zona y los filtros actuales al momento de ejecutarse
	const fetchMatches = useCallback(async () => {
		if (!isAuthenticatedRef.current) {
			setIsLoading(false)
			return
		}
		setIsLoading(true)
		setError(null)
		try {
			const currentZone = activeZoneRef.current
			const currentFilters = filtersRef.current

			let zoneFilter: ZoneListFilter | undefined
			if (currentZone) {
				if (currentZone.radiusKm > 0 && (currentZone.lng !== 0 || currentZone.lat !== 0)) {
					zoneFilter = { type: 'coordinates', lng: currentZone.lng, lat: currentZone.lat, radiusKm: currentZone.radiusKm }
				} else {
					zoneFilter = { type: 'name', zoneName: currentZone.label }
				}
			}

			const { data, error } = await matchesService.list({
				sport: currentFilters.sport,
				zone: zoneFilter,
			})
			if (error) throw error
			setMatches(data ?? [])
		} catch (err) {
			console.error('Error fetching matches:', err)
			setError('No se pudieron cargar los partidos')
		} finally {
			setIsLoading(false)
		}
	}, []) // Sin dependencias — lee todo desde refs

	// Re-fetch automático cuando cambian zona o filtros
	useEffect(() => {
		fetchMatches()
	}, [activeZone, filters]) // eslint-disable-line react-hooks/exhaustive-deps

	// Primer fetch al autenticarse
	useEffect(() => {
		if (isAuthenticated) fetchMatches()
		else setIsLoading(false)
	}, [isAuthenticated]) // eslint-disable-line react-hooks/exhaustive-deps

	const filteredMatches = useMemo(() => {
		let result = matches
		if (filters.date) result = result.filter((m) => m.starts_at.startsWith(filters.date!))
		return result
	}, [matches, filters])

	const setZone = useCallback((zone: ZoneFilter | null) => {
		setActiveZone(zone)
	}, [])

	const clearFilters = useCallback(() => setFilters({}), [])
	const getMatchById = useCallback((id: string) => matches.find((m) => m.id === id), [matches])

	return <MatchContext.Provider value={{ matches, filteredMatches, isLoading, error, filters, activeZone, setFilters, setZone, clearFilters, refreshMatches: fetchMatches, getMatchById }}>{children}</MatchContext.Provider>
}

export function useMatches() {
	const context = useContext(MatchContext)
	if (context === undefined) throw new Error('useMatches must be used within a MatchProvider')
	return context
}
