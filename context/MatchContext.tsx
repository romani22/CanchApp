import { matchesService } from '@/services/matches.service'
import { MatchWithCreator, SportType } from '@/types/database.types'
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'

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
	setFilters: (filters: MatchFilters) => void
	refreshMatches: () => Promise<void>
	getMatchById: (id: string) => MatchWithCreator | undefined
}

const MatchContext = createContext<MatchContextType | undefined>(undefined)

export function MatchProvider({ children }: { children: React.ReactNode }) {
	const { isAuthenticated } = useAuth()
	const [matches, setMatches] = useState<MatchWithCreator[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [filters, setFilters] = useState<MatchFilters>({})

	const fetchMatches = useCallback(async () => {
		if (!isAuthenticated) {
			setIsLoading(false)
			return
		}

		setIsLoading(true)
		setError(null)

		try {
			const { data } = await matchesService.list()
			setMatches(data ?? [])
		} catch (err) {
			console.error('Error fetching matches:', err)
			setError('No se pudieron cargar los partidos')
		} finally {
			setIsLoading(false)
		}
	}, [isAuthenticated])

	// Initial fetch
	useEffect(() => {
		fetchMatches()
	}, [fetchMatches])

	// Subscribe to realtime updates
	useEffect(() => {
		if (!isAuthenticated) return

		// const subscription = matchesService.subscribeToOpenMatches(({ eventType, match }) => {
		// 	if (eventType === 'INSERT') {
		// 		// Fetch the full match with relations
		// 		fetchMatches()
		// 	} else if (eventType === 'UPDATE') {
		// 		setMatches((prev) => prev.map((m) => (m.id === match.id ? { ...m, ...match } : m)))
		// 	} else if (eventType === 'DELETE') {
		// 		setMatches((prev) => prev.filter((m) => m.id !== match.id))
		// 	}
		// })

		// return () => {
		// 	subscription.unsubscribe()
		// }
	}, [isAuthenticated, fetchMatches])

	// Filter matches based on current filters
	const filteredMatches = matches.filter((match) => {
		if (filters.sport && match.sport !== filters.sport) return false
		if (filters.date && match.date !== filters.date) return false
		return true
	})

	const getMatchById = (id: string) => matches.find((m) => m.id === id)

	return (
		<MatchContext.Provider
			value={{
				matches,
				filteredMatches,
				isLoading,
				error,
				filters,
				setFilters,
				refreshMatches: fetchMatches,
				getMatchById,
			}}
		>
			{children}
		</MatchContext.Provider>
	)
}

export function useMatches() {
	const context = useContext(MatchContext)
	if (context === undefined) {
		throw new Error('useMatches must be used within a MatchProvider')
	}
	return context
}
