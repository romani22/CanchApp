import { parsePoint, parseRowPoints, parseRowsPoints, serializePoint } from '@/repositories/coords'

describe('coords — traducción de columnas POINT', () => {
	describe('parsePoint()', () => {
		it('convierte el string "(x,y)" que devuelve Postgres', () => {
			expect(parsePoint('(-64.18,-31.41)')).toEqual({ x: -64.18, y: -31.41 })
		})

		it('soporta coordenadas positivas', () => {
			expect(parsePoint('(2.35,48.85)')).toEqual({ x: 2.35, y: 48.85 })
		})

		it('es idempotente: si ya es objeto lo devuelve igual', () => {
			const coords = { x: 1, y: 2 }
			expect(parsePoint(coords)).toBe(coords)
		})

		it('devuelve null para null, undefined y string vacío', () => {
			expect(parsePoint(null)).toBeNull()
			expect(parsePoint(undefined)).toBeNull()
			expect(parsePoint('')).toBeNull()
		})

		it('devuelve null si el string no tiene forma de punto', () => {
			expect(parsePoint('Córdoba')).toBeNull()
		})
	})

	describe('serializePoint()', () => {
		it('convierte { x, y } al formato que espera Postgres', () => {
			expect(serializePoint({ x: -64.18, y: -31.41 })).toBe('(-64.18,-31.41)')
		})

		it('devuelve null cuando falta alguna componente', () => {
			expect(serializePoint({ x: 1 })).toBeNull()
			expect(serializePoint({ y: 1 })).toBeNull()
			expect(serializePoint(null)).toBeNull()
			expect(serializePoint(undefined)).toBeNull()
		})

		/**
		 * El bug que originó este módulo: al reenviar un string crudo leído de la DB,
		 * serializePoint no encontraba .x/.y y escribía NULL, borrando las coordenadas.
		 * Parsear antes de serializar preserva el valor.
		 */
		it('un string crudo se pierde, pero parsear antes lo preserva', () => {
			const desdeLaDb = '(-64.18,-31.41)'
			expect(serializePoint(desdeLaDb)).toBeNull()
			expect(serializePoint(parsePoint(desdeLaDb))).toBe('(-64.18,-31.41)')
		})

		it('el ida y vuelta completo conserva el valor', () => {
			const original = { x: -58.38, y: -34.6 }
			expect(parsePoint(serializePoint(original))).toEqual(original)
		})
	})

	describe('parseRowPoints()', () => {
		it('normaliza sólo las columnas indicadas', () => {
			const row = { id: 'p1', zone: 'Córdoba', zone_coordinates: '(-64.18,-31.41)' }

			expect(parseRowPoints(row, 'zone_coordinates')).toEqual({
				id: 'p1',
				zone: 'Córdoba',
				zone_coordinates: { x: -64.18, y: -31.41 },
			})
		})

		it('no muta la fila original', () => {
			const row = { zone_coordinates: '(1,2)' }
			parseRowPoints(row, 'zone_coordinates')
			expect(row.zone_coordinates).toBe('(1,2)')
		})

		it('propaga null', () => {
			expect(parseRowPoints(null, 'zone_coordinates')).toBeNull()
		})

		it('deja la columna en null si venía null', () => {
			const row = { id: 'p1', zone_coordinates: null }
			expect(parseRowPoints(row, 'zone_coordinates')?.zone_coordinates).toBeNull()
		})
	})

	describe('parseRowsPoints()', () => {
		it('normaliza cada fila de la lista', () => {
			const rows = [{ venue_coordinates: '(1,2)' }, { venue_coordinates: '(3,4)' }]

			expect(parseRowsPoints(rows, 'venue_coordinates')).toEqual([{ venue_coordinates: { x: 1, y: 2 } }, { venue_coordinates: { x: 3, y: 4 } }])
		})

		it('devuelve lista vacía para null o undefined', () => {
			expect(parseRowsPoints(null, 'venue_coordinates')).toEqual([])
			expect(parseRowsPoints(undefined, 'venue_coordinates')).toEqual([])
		})
	})
})
