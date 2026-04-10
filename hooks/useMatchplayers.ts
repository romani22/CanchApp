import { useAuth } from '@/context/AuthContext'
import { AddMultiplePlayersResult, AddPlayerInput, matchPlayersService } from '@/services/matchPlayers.service'
import { MatchPlayerWithUser, TeamSlot } from '@/types/database.types'
import { useEffect, useState } from 'react'

export function useMatchPlayers(matchId: string | undefined) {
	const [players, setPlayers] = useState<MatchPlayerWithUser[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [canAddMore, setCanAddMore] = useState(true)
	const [remainingSlots, setRemainingSlots] = useState(0)
	const { user } = useAuth()

	// Cargar jugadores
	const loadPlayers = async () => {
		if (!matchId) return

		try {
			setIsLoading(true)
			setError(null)
			const data = await matchPlayersService.getMatchPlayers(matchId)
			setPlayers(data)

			// Verificar si se pueden agregar más
			const capacity = await matchPlayersService.canAddMorePlayers(matchId)
			setCanAddMore(capacity.canAdd)
			setRemainingSlots(capacity.remaining)
		} catch (err: any) {
			setError(err.message || 'Error al cargar jugadores')
			console.error('Error loading players:', err)
		} finally {
			setIsLoading(false)
		}
	}

	// Agregar un solo jugador
	const addPlayer = async (player: AddPlayerInput) => {
		if (!matchId || !user?.id) {
			setError('Información faltante')
			return null
		}

		try {
			setIsLoading(true)
			setError(null)
			const newPlayer = await matchPlayersService.addPlayer(matchId, user.id, player)
			await loadPlayers() // Recargar lista
			return newPlayer
		} catch (err: any) {
			setError(err.message || 'Error al agregar jugador')
			console.error('Error adding player:', err)
			return null
		} finally {
			setIsLoading(false)
		}
	}

	// Agregar múltiples jugadores
	const addMultiplePlayers = async (playersList: AddPlayerInput[]): Promise<AddMultiplePlayersResult[]> => {
		if (!matchId || !user?.id) {
			setError('Información faltante')
			return []
		}

		try {
			setIsLoading(true)
			setError(null)
			const results = await matchPlayersService.addMultiplePlayers(matchId, user.id, playersList)
			await loadPlayers() // Recargar lista
			return results
		} catch (err: any) {
			setError(err.message || 'Error al agregar jugadores')
			console.error('Error adding multiple players:', err)
			return []
		} finally {
			setIsLoading(false)
		}
	}

	// Eliminar jugador
	const removePlayer = async (playerId: string) => {
		try {
			setIsLoading(true)
			setError(null)
			const success = await matchPlayersService.removePlayer(playerId)
			if (success) {
				await loadPlayers() // Recargar lista
			}
			return success
		} catch (err: any) {
			setError(err.message || 'Error al eliminar jugador')
			console.error('Error removing player:', err)
			return false
		} finally {
			setIsLoading(false)
		}
	}

	// Cambiar equipo de un jugador
	const updatePlayerTeam = async (playerId: string, teamSlot: TeamSlot | null) => {
		try {
			setIsLoading(true)
			setError(null)
			await matchPlayersService.updatePlayerTeam(playerId, teamSlot)
			await loadPlayers() // Recargar lista
			return true
		} catch (err: any) {
			setError(err.message || 'Error al actualizar equipo')
			console.error('Error updating player team:', err)
			return false
		} finally {
			setIsLoading(false)
		}
	}

	// Obtener jugadores agregados por el usuario actual
	const getMyAddedPlayers = () => {
		if (!user?.id) return []
		return players.filter((p) => p.added_by_user_id === user.id)
	}

	// Obtener estadísticas
	const getStats = () => {
		const registered = players.filter((p) => p.user_id !== null).length
		const guests = players.filter((p) => p.user_id === null).length
		const byTeam = {
			A: players.filter((p) => p.team_slot === 'A').length,
			B: players.filter((p) => p.team_slot === 'B').length,
			none: players.filter((p) => p.team_slot === null).length,
		}

		return {
			total: players.length,
			registered,
			guests,
			byTeam,
		}
	}

	// Cargar al montar y suscribirse a cambios
	useEffect(() => {
		if (!matchId) return

		loadPlayers()

		// Suscribirse a cambios en tiempo real
		const subscription = matchPlayersService.subscribe(matchId, (payload: any) => {
			console.log('Player change detected:', payload)
			loadPlayers()
		})

		return () => {
			subscription.unsubscribe()
		}
	}, [matchId])

	return {
		players,
		isLoading,
		error,
		canAddMore,
		remainingSlots,
		addPlayer,
		addMultiplePlayers,
		removePlayer,
		updatePlayerTeam,
		getMyAddedPlayers,
		getStats,
		reload: loadPlayers,
	}
}
