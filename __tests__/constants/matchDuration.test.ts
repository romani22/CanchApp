import { SPORT_DURATION_MINUTES, estimateMatchEnd } from '@/constants/matches'
import { sports } from '@/constants/matches'

describe('estimateMatchEnd()', () => {
	// matches.end_time es un TIME que nadie escribe, así que el final del partido se
	// estima a partir del deporte. Sólo se usa para avisarle al creador que cargue
	// el resultado.
	it('suma la duración del deporte al horario de inicio', () => {
		const start = new Date('2026-04-20T20:00:00.000Z')

		expect(estimateMatchEnd('futbol', start).toISOString()).toBe('2026-04-20T21:30:00.000Z')
		expect(estimateMatchEnd('basquet', start).toISOString()).toBe('2026-04-20T21:00:00.000Z')
		expect(estimateMatchEnd('voley', start).toISOString()).toBe('2026-04-20T21:15:00.000Z')
	})

	it('no muta la fecha que recibe', () => {
		const start = new Date('2026-04-20T20:00:00.000Z')
		estimateMatchEnd('futbol', start)

		expect(start.toISOString()).toBe('2026-04-20T20:00:00.000Z')
	})

	it('tiene duración para todos los deportes', () => {
		for (const sport of sports) {
			expect(SPORT_DURATION_MINUTES[sport.key]).toBeGreaterThan(0)
		}
	})
})
