import { likePattern, looksLikeEmail, normalizeSearchLimit } from '@/repositories/supabase/searchPattern'

describe('searchPattern — saneado del texto del buscador', () => {
	describe('likePattern()', () => {
		it('deja pasar un nombre común sin tocarlo', () => {
			expect(likePattern('Jose Romani')).toBe('Jose Romani')
		})

		it('recorta los espacios de los extremos', () => {
			expect(likePattern('  Ana  ')).toBe('Ana')
		})

		it('escapa los comodines de LIKE', () => {
			expect(likePattern('100%')).toBe('100\\%')
			expect(likePattern('a_b')).toBe('a\\_b')
		})

		it('escapa la barra invertida sin duplicar el escape de lo demás', () => {
			// Una sola pasada con clase de caracteres: cada especial recibe UNA barra.
			expect(likePattern('a\\%b')).toBe('a\\\\\\%b')
		})

		it('saca los asteriscos, que PostgREST traduce a % antes de llegar a Postgres', () => {
			// Es el caso que hacía que escribir "*" devolviera la tabla entera.
			expect(likePattern('*')).toBe('')
			expect(likePattern('An*a')).toBe('Ana')
		})

		it('no deja ningún comodín efectivo con la entrada más hostil', () => {
			const sucio = '*%_\\'
			const limpio = likePattern(sucio)
			expect(limpio).not.toContain('*')
			// Todo % y _ que quede tiene que venir precedido por una barra de escape.
			expect(limpio.replace(/\\./g, '')).not.toMatch(/[%_]/)
		})
	})

	describe('looksLikeEmail()', () => {
		it('reconoce un mail completo', () => {
			expect(looksLikeEmail('josealbertoromani22@gmail.com')).toBe(true)
		})

		it('no reconoce un mail a medias', () => {
			expect(looksLikeEmail('jose@')).toBe(false)
			expect(looksLikeEmail('@gmail.com')).toBe(false)
			expect(looksLikeEmail('jose@gmail')).toBe(false)
		})

		it('no reconoce un nombre ni una subcadena con arroba', () => {
			// Es el caso que importa: "%@gmail%" no debe habilitar la búsqueda por mail,
			// porque buscar mails por subcadena es cosechar direcciones.
			expect(looksLikeEmail('Jose Romani')).toBe(false)
			expect(looksLikeEmail('@gmail')).toBe(false)
		})

		it('ignora los espacios de los extremos', () => {
			expect(looksLikeEmail('  ana@test.com  ')).toBe(true)
		})

		it('rechaza lo que tenga espacios en el medio', () => {
			expect(looksLikeEmail('ana @test.com')).toBe(false)
		})
	})

	describe('normalizeSearchLimit()', () => {
		it('respeta un límite razonable', () => {
			expect(normalizeSearchLimit(5)).toBe(5)
		})

		it('pone techo en 10', () => {
			expect(normalizeSearchLimit(1000)).toBe(10)
		})

		it('pone piso en 1', () => {
			expect(normalizeSearchLimit(0)).toBe(1)
			expect(normalizeSearchLimit(-7)).toBe(1)
		})

		it('trunca los decimales', () => {
			expect(normalizeSearchLimit(3.9)).toBe(3)
		})
	})
})
