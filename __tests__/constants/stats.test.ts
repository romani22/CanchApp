import { buildMetricRows, buildStatCards, buildStatHighlights, formatScore, isSetBased } from '@/constants/stats'
import type { SportStats } from '@/types/database.types'

// Base con todas las métricas en null: cada test enciende sólo lo que le importa.
const makeStats = (overrides: Partial<SportStats> = {}): SportStats => ({
	user_id: 'user-1',
	sport: 'futbol',
	matches_played: 10,
	wins: 6,
	losses: 3,
	draws: 1,
	win_rate: 60,
	goals: null,
	assists: null,
	saves: null,
	points: null,
	goals_per_match: null,
	assists_per_match: null,
	saves_per_match: null,
	points_per_match: null,
	matches_with_goals: 0,
	matches_with_assists: 0,
	matches_with_saves: 0,
	matches_with_points: 0,
	...overrides,
})

describe('buildStatCards()', () => {
	it('devuelve partidos, victorias y % de victorias', () => {
		const cards = buildStatCards(makeStats({ draws: 0 }))
		expect(cards.map((c) => c.key)).toEqual(['played', 'wins', 'win_rate'])
		expect(cards.map((c) => c.value)).toEqual(['10', '6', '60%'])
	})

	it('agrega los empates sólo si hubo alguno', () => {
		expect(buildStatCards(makeStats({ draws: 2 })).some((c) => c.key === 'draws')).toBe(true)
		expect(buildStatCards(makeStats({ draws: 0 })).some((c) => c.key === 'draws')).toBe(false)
	})

	it('singulariza la etiqueta con un solo partido', () => {
		expect(buildStatCards(makeStats({ matches_played: 1 }))[0].label).toBe('Partido')
	})

	// Sin partidos no hay nada que mostrar: la pantalla usa el largo 0 para poner
	// el mensaje de "todavía no jugaste", en vez de una grilla de ceros.
	it('devuelve vacío sin stats o sin partidos jugados', () => {
		expect(buildStatCards(null)).toEqual([])
		expect(buildStatCards(makeStats({ matches_played: 0 }))).toEqual([])
	})
})

describe('buildMetricRows()', () => {
	it('sólo devuelve las métricas del deporte', () => {
		const stats = makeStats({ goals: 12, goals_per_match: 1.2, matches_with_goals: 10, points: 99 })

		const futbol = buildMetricRows(stats, 'futbol')
		expect(futbol.map((r) => r.key)).toEqual(['goals'])

		// Un básquet nunca muestra goles, aunque la fila los tenga cargados.
		const basquet = buildMetricRows(makeStats({ sport: 'basquet', goals: 12, points: 120, points_per_match: 12 }), 'basquet')
		expect(basquet.map((r) => r.key)).toEqual(['points'])
	})

	it('trae total, promedio y en cuántos partidos se cargó', () => {
		const rows = buildMetricRows(makeStats({ goals: 12, goals_per_match: 1.2, matches_with_goals: 10 }), 'futbol')
		expect(rows[0]).toEqual({ key: 'goals', label: 'Goles', total: 12, perMatch: 1.2, matches: 10 })
	})

	// null es "no se cargó nunca", que no es lo mismo que un 0.
	it('omite las métricas que nadie cargó', () => {
		const rows = buildMetricRows(makeStats({ goals: 4, goals_per_match: 0.4, assists: null, saves: null }), 'futbol')
		expect(rows.map((r) => r.key)).toEqual(['goals'])
	})

	it('mantiene un 0 cargado a mano', () => {
		const rows = buildMetricRows(makeStats({ goals: 0, goals_per_match: 0, matches_with_goals: 3 }), 'futbol')
		expect(rows.map((r) => r.key)).toEqual(['goals'])
		expect(rows[0].total).toBe(0)
	})

	it('no devuelve métricas en los deportes que sólo tienen resultado', () => {
		expect(buildMetricRows(makeStats({ sport: 'tenis' }), 'tenis')).toEqual([])
		expect(buildMetricRows(makeStats({ sport: 'padel' }), 'padel')).toEqual([])
	})
})

describe('buildStatHighlights()', () => {
	it('arranca por partidos y % de victorias', () => {
		const highlights = buildStatHighlights(makeStats(), 'futbol')
		expect(highlights.slice(0, 2).map((h) => h.key)).toEqual(['played', 'win_rate'])
	})

	// Los promedios dicen algo del jugador; los totales dependen de cuánto jugó.
	it('agrega los promedios por partido del deporte', () => {
		const highlights = buildStatHighlights(makeStats({ goals: 12, goals_per_match: 1.2, saves: 3, saves_per_match: 0.3 }), 'futbol')
		expect(highlights.map((h) => h.key)).toEqual(['played', 'win_rate', 'goals', 'saves'])
		expect(highlights.find((h) => h.key === 'goals')?.value).toBe('1.2')
	})

	it('nunca pasa de cuatro datos', () => {
		const stats = makeStats({ goals: 1, goals_per_match: 1, assists: 1, assists_per_match: 1, saves: 1, saves_per_match: 1 })
		expect(buildStatHighlights(stats, 'futbol').length).toBeLessThanOrEqual(4)
	})

	it('devuelve vacío sin partidos jugados', () => {
		expect(buildStatHighlights(makeStats({ matches_played: 0 }), 'futbol')).toEqual([])
		expect(buildStatHighlights(null, 'futbol')).toEqual([])
	})
})

describe('formatScore()', () => {
	it('muestra el marcador simple', () => {
		expect(formatScore({ score_a: 3, score_b: 2, sets: [] })).toBe('3 - 2')
	})

	// Los sets ganan sobre el marcador numérico: en tenis score_a/score_b son los
	// sets ganados, y el detalle set por set dice más.
	it('prefiere los sets cuando hay', () => {
		expect(
			formatScore({
				score_a: 2,
				score_b: 1,
				sets: [
					{ a: 6, b: 4 },
					{ a: 3, b: 6 },
					{ a: 7, b: 5 },
				],
			}),
		).toBe('6-4  3-6  7-5')
	})

	it('devuelve null cuando sólo se cargó quién ganó', () => {
		expect(formatScore({ score_a: null, score_b: null, sets: [] })).toBeNull()
		expect(formatScore({ score_a: 3, score_b: null, sets: [] })).toBeNull()
		expect(formatScore(null)).toBeNull()
	})
})

describe('isSetBased()', () => {
	it('sólo tenis y pádel se cuentan por sets', () => {
		expect(isSetBased('tenis')).toBe(true)
		expect(isSetBased('padel')).toBe(true)
		expect(isSetBased('futbol')).toBe(false)
		expect(isSetBased('basquet')).toBe(false)
		expect(isSetBased('voley')).toBe(false)
	})
})
