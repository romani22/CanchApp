import { buildMatchTitle, isAutoMatchTitle } from '@/constants/matches'

describe('buildMatchTitle()', () => {
	it('divide el total de jugadores en dos lados', () => {
		expect(buildMatchTitle('futbol', 10)).toBe('Futbol 5vs5')
		expect(buildMatchTitle('futbol', 16)).toBe('Futbol 8vs8')
		expect(buildMatchTitle('futbol', 6)).toBe('Futbol 3vs3')
	})

	it('redondea para abajo con totales impares', () => {
		expect(buildMatchTitle('padel', 5)).toBe('Padel 2vs2')
	})

	it('usa la etiqueta del deporte', () => {
		expect(buildMatchTitle('basquet', 10)).toBe('Basquet 5vs5')
		expect(buildMatchTitle('tenis', 4)).toBe('Tenis 2vs2')
	})
})

describe('isAutoMatchTitle()', () => {
	it('reconoce el título que genera buildMatchTitle', () => {
		expect(isAutoMatchTitle('Futbol 8vs8', 'futbol')).toBe(true)
		expect(isAutoMatchTitle('Padel 2vs2', 'padel')).toBe(true)
	})

	// Create armaba el título con un cálculo propio: "5v5" (una sola v) en cualquier
	// partido de más de 6 jugadores. Esos títulos no los eligió nadie.
	it('reconoce el formato viejo con una sola v', () => {
		expect(isAutoMatchTitle('Futbol 5v5', 'futbol')).toBe(true)
		expect(isAutoMatchTitle('Futbol 3v3', 'futbol')).toBe(true)
	})

	it('reconoce el deporte solo', () => {
		expect(isAutoMatchTitle('Futbol', 'futbol')).toBe(true)
		expect(isAutoMatchTitle('  futbol  ', 'futbol')).toBe(true)
	})

	it('respeta un nombre puesto a mano', () => {
		expect(isAutoMatchTitle('Picadito de los jueves', 'futbol')).toBe(false)
		expect(isAutoMatchTitle('Futbol con los pibes', 'futbol')).toBe(false)
		expect(isAutoMatchTitle('Futbol 5vs5 en Rabona', 'futbol')).toBe(false)
		expect(isAutoMatchTitle('', 'futbol')).toBe(false)
	})

	it('no confunde el título automático de otro deporte', () => {
		expect(isAutoMatchTitle('Futbol 5vs5', 'padel')).toBe(false)
	})
})
