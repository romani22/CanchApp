import type { MatchOutcome, SportStats, SportType } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'

/**
 * Qué se puede cargar y mostrar por deporte.
 *
 * Es la única lista que hay que tocar para sumar una métrica nueva: la pantalla
 * de resultado arma sus campos con esto y el perfil arma sus cards con esto. Las
 * métricas de acá viven en columnas de match_player_stats; para algo más
 * experimental está la columna `extra` (jsonb) y no hace falta migrar.
 */
export type MetricKey = 'goals' | 'assists' | 'saves' | 'points'

export const METRICS: Record<MetricKey, { label: string; short: string; perMatch: string; icon: keyof typeof Ionicons.glyphMap }> = {
	goals: { label: 'Goles', short: 'Goles', perMatch: 'Goles/partido', icon: 'football-outline' },
	assists: { label: 'Asistencias', short: 'Asist.', perMatch: 'Asist./partido', icon: 'share-social-outline' },
	saves: { label: 'Atajadas', short: 'Atajadas', perMatch: 'Atajadas/partido', icon: 'hand-left-outline' },
	points: { label: 'Puntos', short: 'Puntos', perMatch: 'Puntos/partido', icon: 'basketball-outline' },
}

/** Métricas individuales que se cargan en cada deporte. Vacío = sólo el resultado. */
export const SPORT_METRICS: Record<SportType, MetricKey[]> = {
	futbol: ['goals', 'assists', 'saves'],
	basquet: ['points'],
	voley: ['points'],
	// Tenis y pádel: sólo quién ganó y el marcador por sets.
	tenis: [],
	padel: [],
}

/** Deportes cuyo marcador se carga por sets en vez de goles/puntos. */
export const SET_BASED_SPORTS: SportType[] = ['tenis', 'padel']

export const isSetBased = (sport: SportType): boolean => SET_BASED_SPORTS.includes(sport)

export const OUTCOME_LABELS: Record<MatchOutcome, string> = {
	win: 'Ganó',
	loss: 'Perdió',
	draw: 'Empató',
}

/** Los campos `${metric}_per_match` de la vista, tipados. */
const PER_MATCH_KEY: Record<MetricKey, keyof SportStats> = {
	goals: 'goals_per_match',
	assists: 'assists_per_match',
	saves: 'saves_per_match',
	points: 'points_per_match',
}

export type StatCard = { key: string; value: string; label: string }

/**
 * Las cards principales de un deporte: partidos, victorias y % de victorias.
 *
 * Las métricas individuales NO van acá. Un fútbol con goles, asistencias y
 * atajadas —cada una con su total y su promedio— daría diez cards de números
 * sueltos; van en buildMetricRows, que las muestra como filas legibles.
 */
export const buildStatCards = (stats: SportStats | null): StatCard[] => {
	if (!stats || stats.matches_played === 0) return []

	const cards: StatCard[] = [
		{ key: 'played', value: String(stats.matches_played), label: stats.matches_played === 1 ? 'Partido' : 'Partidos' },
		{ key: 'wins', value: String(stats.wins), label: 'Victorias' },
		{ key: 'win_rate', value: `${stats.win_rate}%`, label: '% Victorias' },
	]

	if (stats.draws > 0) cards.push({ key: 'draws', value: String(stats.draws), label: 'Empates' })

	return cards
}

export type MetricRow = { key: MetricKey; label: string; total: number; perMatch: number | null; matches: number }

/**
 * Métricas individuales del deporte, con total y promedio por partido.
 *
 * Una métrica que nadie cargó nunca se omite en vez de mostrar 0: un 0 se lee
 * como "no metiste ningún gol", que es un dato, y acá el dato es que no hay dato.
 */
export const buildMetricRows = (stats: SportStats | null, sport: SportType): MetricRow[] => {
	if (!stats || stats.matches_played === 0) return []

	const matchesWith: Record<MetricKey, keyof SportStats> = {
		goals: 'matches_with_goals',
		assists: 'matches_with_assists',
		saves: 'matches_with_saves',
		points: 'matches_with_points',
	}

	return SPORT_METRICS[sport].flatMap((metric) => {
		const total = stats[metric]
		if (total == null) return []

		const perMatch = stats[PER_MATCH_KEY[metric]]
		const matches = stats[matchesWith[metric]]

		return [
			{
				key: metric,
				label: METRICS[metric].label,
				total,
				perMatch: typeof perMatch === 'number' ? perMatch : null,
				matches: typeof matches === 'number' ? matches : 0,
			},
		]
	})
}

/**
 * Resumen corto para el modal de participante: dos o tres datos y nada más.
 * Prioriza el rendimiento por partido, que es lo que dice algo del jugador, sobre
 * los totales, que dependen de cuánto jugó.
 */
export const buildStatHighlights = (stats: SportStats | null, sport: SportType): StatCard[] => {
	if (!stats || stats.matches_played === 0) return []

	const highlights: StatCard[] = [
		{ key: 'played', value: String(stats.matches_played), label: stats.matches_played === 1 ? 'Partido' : 'Partidos' },
		{ key: 'win_rate', value: `${stats.win_rate}%`, label: 'Victorias' },
	]

	for (const metric of SPORT_METRICS[sport]) {
		const perMatch = stats[PER_MATCH_KEY[metric]]
		if (typeof perMatch !== 'number') continue
		highlights.push({ key: metric, value: perMatch.toFixed(1), label: METRICS[metric].perMatch })
		if (highlights.length >= 4) break
	}

	return highlights
}

/**
 * Marcador legible. Los deportes por sets muestran "6-4 3-6 7-5"; el resto,
 * "3 - 2". Devuelve null cuando el creador cargó sólo quién ganó.
 */
export const formatScore = (score: { score_a: number | null; score_b: number | null; sets: { a: number; b: number }[] } | null): string | null => {
	if (!score) return null
	if (score.sets.length > 0) return score.sets.map((s) => `${s.a}-${s.b}`).join('  ')
	if (score.score_a == null || score.score_b == null) return null
	return `${score.score_a} - ${score.score_b}`
}
