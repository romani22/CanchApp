import { supabase } from '@/lib/supabase'
import { MatchPlayer, MatchPlayerWithUser, Profile, TeamSlot } from '@/types/database.types'

const normalizeSearchQuery = (query: string) => query.trim().replace(/[%_\\]/g, '\\$&')
const normalizeSearchLimit = (limit: number) => Math.max(1, Math.min(limit, 10))

export interface AddPlayerInput {
	user_id?: string | null
	player_name: string
	team_slot?: TeamSlot | null
}

export interface AddMultiplePlayersResult {
	success: boolean
	player_id: string | null
	player_name: string
	error_message: string | null
}

export const matchPlayersService = {
	/**
	 * Agregar un solo jugador a un partido
	 */
	async addPlayer(matchId: string, addedByUserId: string, player: AddPlayerInput): Promise<MatchPlayer> {
		try {
			// Verificar que el partido existe y no está lleno
			const { data: match, error: matchError } = await supabase.from('matches').select('current_players, total_players, status').eq('id', matchId).single()

			if (matchError) throw matchError

			if (match.status === 'full' || match.current_players >= match.total_players) {
				throw new Error('El partido está lleno')
			}

			// Si es un usuario registrado, verificar que no esté ya en el partido
			if (player.user_id) {
				const { data: existingPlayer } = await supabase.from('match_players').select('id').eq('match_id', matchId).eq('user_id', player.user_id).maybeSingle()

				if (existingPlayer) {
					throw new Error('Este usuario ya está en el partido')
				}

				const { data: existingParticipant } = await supabase.from('match_participants').select('id').eq('match_id', matchId).eq('user_id', player.user_id).maybeSingle()

				if (existingParticipant) {
					throw new Error('Este usuario ya es participante del partido')
				}
			}

			// Insertar jugador
			const { data, error } = await supabase
				.from('match_players')
				.insert({
					match_id: matchId,
					added_by_user_id: addedByUserId,
					user_id: player.user_id,
					player_name: player.player_name,
					team_slot: player.team_slot,
				})
				.select()
				.single()

			if (error) throw error

			return data
		} catch (error) {
			console.error('Error adding player:', error)
			throw error
		}
	},

	/**
	 * Agregar múltiples jugadores de una vez usando la función SQL
	 */
	async addMultiplePlayers(matchId: string, addedByUserId: string, players: AddPlayerInput[]): Promise<AddMultiplePlayersResult[]> {
		try {
			const { data, error } = await supabase.rpc('add_multiple_players', {
				p_match_id: matchId,
				p_added_by_user_id: addedByUserId,
				p_players: players,
			})

			if (error) throw error

			return data as AddMultiplePlayersResult[]
		} catch (error) {
			console.error('Error adding multiple players:', error)
			throw error
		}
	},

	/**
	 * Obtener todos los jugadores de un partido
	 */
	async getMatchPlayers(matchId: string): Promise<MatchPlayerWithUser[]> {
		try {
			const { data, error } = await supabase
				.from('match_players')
				.select(
					`
          *,
          user:profiles!match_players_user_id_fkey(*),
          added_by:profiles!match_players_added_by_user_id_fkey(*)
        `,
				)
				.eq('match_id', matchId)
				.order('created_at', { ascending: true })

			if (error) throw error

			return data as MatchPlayerWithUser[]
		} catch (error) {
			console.error('Error fetching match players:', error)
			throw error
		}
	},

	/**
	 * Obtener jugadores agregados por un usuario específico
	 */
	async getPlayersByUser(matchId: string, userId: string): Promise<MatchPlayerWithUser[]> {
		try {
			const { data, error } = await supabase
				.from('match_players')
				.select(
					`
          *,
          user:profiles!match_players_user_id_fkey(*),
          added_by:profiles!match_players_added_by_user_id_fkey(*)
        `,
				)
				.eq('match_id', matchId)
				.eq('added_by_user_id', userId)
				.order('created_at', { ascending: true })

			if (error) throw error

			return data as MatchPlayerWithUser[]
		} catch (error) {
			console.error('Error fetching players by user:', error)
			throw error
		}
	},

	/**
	 * Eliminar un jugador usando la función SQL que actualiza contadores
	 */
	async removePlayer(playerId: string): Promise<boolean> {
		try {
			const { data, error } = await supabase.rpc('remove_match_player', {
				p_player_id: playerId,
			})

			if (error) throw error

			return data as boolean
		} catch (error) {
			console.error('Error removing player:', error)
			throw error
		}
	},

	/**
	 * Actualizar el equipo de un jugador
	 */
	async updatePlayerTeam(playerId: string, teamSlot: TeamSlot | null): Promise<void> {
		try {
			const { error } = await supabase.from('match_players').update({ team_slot: teamSlot }).eq('id', playerId)

			if (error) throw error
		} catch (error) {
			console.error('Error updating player team:', error)
			throw error
		}
	},

	/**
	 * Verificar si un usuario puede agregar más jugadores
	 */
	async canAddMorePlayers(matchId: string): Promise<{ canAdd: boolean; remaining: number }> {
		try {
			const { data: match, error } = await supabase.from('matches').select('current_players, total_players, status').eq('id', matchId).single()

			if (error) throw error

			const remaining = match.total_players - match.current_players
			const canAdd = match.status === 'open' && remaining > 0

			return { canAdd, remaining }
		} catch (error) {
			console.error('Error checking if can add players:', error)
			return { canAdd: false, remaining: 0 }
		}
	},

	/**
	 * Buscar usuarios para agregar como jugadores
	 */
	async searchUsers(query: string, limit: number = 10): Promise<Profile[]> {
		try {
			const trimmedQuery = query.trim()
			if (trimmedQuery.length < 2) return []

			const safeQuery = normalizeSearchQuery(trimmedQuery)
			const { data, error } = await supabase.from('profiles').select('id, full_name, avatar_url, email, skill_level').or(`full_name.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%`).limit(normalizeSearchLimit(limit))

			if (error) throw error

			return (data ?? []) as Profile[]
		} catch (error) {
			console.error('Error searching users:', error)
			return []
		}
	},

	/**
	 * Obtener estadísticas de jugadores en un partido
	 */
	async getMatchPlayersStats(matchId: string): Promise<{
		total: number
		registered: number
		guests: number
		byTeam: { A: number; B: number; none: number }
	}> {
		try {
			const { data, error } = await supabase.from('match_players').select('user_id, team_slot').eq('match_id', matchId)

			if (error) throw error

			const registered = data.filter((p) => p.user_id !== null).length
			const guests = data.filter((p) => p.user_id === null).length

			const byTeam = {
				A: data.filter((p) => p.team_slot === 'A').length,
				B: data.filter((p) => p.team_slot === 'B').length,
				none: data.filter((p) => p.team_slot === null).length,
			}

			return {
				total: data.length,
				registered,
				guests,
				byTeam,
			}
		} catch (error) {
			console.error('Error getting match players stats:', error)
			return {
				total: 0,
				registered: 0,
				guests: 0,
				byTeam: { A: 0, B: 0, none: 0 },
			}
		}
	},

	/**
	 * Suscribirse a cambios en los jugadores de un partido
	 */
	subscribe(matchId: string, callback: (payload: any) => void) {
		return supabase
			.channel(`match_players:${matchId}`)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'match_players',
					filter: `match_id=eq.${matchId}`,
				},
				callback,
			)
			.subscribe()
	},
}
