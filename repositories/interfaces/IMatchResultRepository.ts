import type { MatchResultInput, MatchResultVote, MatchResultWithPlayers, SportStats, SportType } from '@/types/database.types'
import type { SubscriptionHandle } from '../types'

export interface IMatchResultRepository {
	/** Resultado de un partido con sus votos, o null si todavía no se cargó. */
	getByMatchId(matchId: string): Promise<MatchResultWithPlayers | null>
	/**
	 * Carga o corrige el resultado. El servidor valida quién puede: el creador
	 * siempre, el autor puede corregir el suyo, y cualquier jugador puede cargarlo
	 * si a las 24 h del partido nadie lo hizo.
	 */
	save(matchId: string, input: MatchResultInput): Promise<string>
	/** Borra el resultado y devuelve el partido a open/full. */
	remove(matchId: string): Promise<void>
	/**
	 * Confirma u objeta el resultado. Sin objeciones el resultado vale; una objeción
	 * lo saca de las estadísticas hasta que su autor lo corrija.
	 */
	vote(matchId: string, vote: MatchResultVote, comment?: string): Promise<void>
	/** Retira el voto propio. */
	clearVote(matchId: string): Promise<void>
	/**
	 * De una lista de partidos, cuáles ya tienen resultado cargado. Una consulta
	 * para toda la lista: es para marcar en Mis Turnos los que le faltan resultado
	 * al creador, y pedirlo de a uno sería un query por tarjeta.
	 */
	getMatchIdsWithResult(matchIds: string[]): Promise<Set<string>>
	/** Estadísticas del usuario en cada deporte que jugó. */
	getUserSportStats(userId: string): Promise<SportStats[]>
	/** Estadísticas del usuario en un deporte, o null si no jugó ninguno. */
	getUserStatsForSport(userId: string, sport: SportType): Promise<SportStats | null>
	/** Las de varios usuarios en un deporte, para no pedirlas de a una. */
	getStatsForUsers(userIds: string[], sport: SportType): Promise<Record<string, SportStats>>
	subscribe(matchId: string, callback: () => void): SubscriptionHandle
}
