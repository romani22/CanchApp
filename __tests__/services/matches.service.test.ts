import { matchesService } from '@/services/matches.service'

// ── Supabase query builder factory ───────────────────────────────────────────
function makeBuilder(result: { data?: unknown; error?: unknown; count?: number } = {}) {
  const resolved = {
    data: result.data ?? null,
    error: result.error ?? null,
    count: result.count,
  }
  const builder: Record<string, jest.Mock> & {
    then: (onFulfilled?: (v: typeof resolved) => unknown, onRejected?: (r: unknown) => unknown) => Promise<unknown>
  } = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(resolved),
    maybeSingle: jest.fn().mockResolvedValue(resolved),
    then: (
      onFulfilled?: (v: typeof resolved) => unknown,
      onRejected?: (r: unknown) => unknown,
    ) => Promise.resolve(resolved).then(onFulfilled, onRejected),
  } as unknown as typeof builder
  return builder
}

// jest.mock() es hoisted — los mocks deben definirse dentro de la factory
// y accederse via jest.requireMock() o usando closures de módulo
jest.mock('@/lib/supabase', () => {
  const mockFrom = jest.fn()
  const mockRpc = jest.fn()
  return {
    supabase: {
      from: (...args: unknown[]) => mockFrom(...args),
      rpc: (...args: unknown[]) => mockRpc(...args),
    },
    __mockFrom: mockFrom,
    __mockRpc: mockRpc,
  }
})

// eslint-disable-next-line @typescript-eslint/no-require-imports
const supabaseMock = jest.requireMock('@/lib/supabase') as { __mockFrom: jest.Mock; __mockRpc: jest.Mock }
const mockFrom = supabaseMock.__mockFrom
const mockRpc = supabaseMock.__mockRpc

// ── Fixtures ─────────────────────────────────────────────────────────────────
const matchFixture = {
  id: 'match-1',
  title: 'Fútbol domingo',
  sport: 'futbol' as const,
  venue_name: 'Cancha Norte',
  venue_zone: 'Córdoba',
  starts_at: '2026-04-25T10:00:00.000Z',
  total_players: 10,
  current_players: 7,
  skill_level: 'intermedio',
  is_mixed: false,
  status: 'open',
  creator_id: 'creator-1',
  created_at: '2026-04-20T08:00:00.000Z',
  venue_coordinates: null,
}

// ────────────────────────────────────────────────────────────────────────────

describe('matchesService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ── list — sin filtros ─────────────────────────────────────────────────────
  describe('list()', () => {
    it('retorna partidos cuando no hay filtros', async () => {
      const matches = [matchFixture]
      mockFrom.mockReturnValue(makeBuilder({ data: matches }))

      const { data, error } = await matchesService.list()

      expect(error).toBeNull()
      expect(data).toEqual(matches)
      expect(mockFrom).toHaveBeenCalledWith('matches')
    })

    it('retorna array vacío cuando no hay partidos', async () => {
      mockFrom.mockReturnValue(makeBuilder({ data: [] }))

      const { data } = await matchesService.list()

      expect(data).toEqual([])
    })

    it('filtra por deporte cuando se pasa sport en los filtros', async () => {
      const builder = makeBuilder({ data: [matchFixture] })
      mockFrom.mockReturnValue(builder)

      await matchesService.list({ sport: 'futbol' })

      expect(builder.eq).toHaveBeenCalledWith('sport', 'futbol')
    })

    it('usa búsqueda por nombre de zona cuando zone.type es "name"', async () => {
      const builder = makeBuilder({ data: [matchFixture] })
      mockFrom.mockReturnValue(builder)

      await matchesService.list({ zone: { type: 'name', zoneName: 'Córdoba' } })

      expect(builder.ilike).toHaveBeenCalledWith('venue_zone', '%Córdoba%')
    })

    it('usa RPC cuando zone.type es "coordinates" y retorna vacío si no hay IDs cercanos', async () => {
      mockRpc.mockResolvedValue({ data: [], error: null })

      const { data } = await matchesService.list({
        zone: { type: 'coordinates', lng: -64.18, lat: -31.41, radiusKm: 20 },
      })

      expect(mockRpc).toHaveBeenCalledWith('matches_near_location', {
        lng: -64.18,
        lat: -31.41,
        radius_meters: 20000,
      })
      expect(data).toEqual([])
    })

    it('llama a RPC con radius_meters = radiusKm * 1000', async () => {
      mockRpc.mockResolvedValue({ data: [], error: null })

      await matchesService.list({
        zone: { type: 'coordinates', lng: -64.18, lat: -31.41, radiusKm: 50 },
      })

      expect(mockRpc).toHaveBeenCalledWith('matches_near_location', expect.objectContaining({
        radius_meters: 50000,
      }))
    })

    it('propaga el error de RPC cuando falla', async () => {
      const rpcError = new Error('RPC failed')
      mockRpc.mockResolvedValue({ data: null, error: rpcError })

      const { data, error } = await matchesService.list({
        zone: { type: 'coordinates', lng: 0, lat: 0, radiusKm: 10 },
      })

      expect(data).toBeNull()
      expect(error).toBe(rpcError)
    })
  })

  // ── getRecommendedMatches ──────────────────────────────────────────────────
  describe('getRecommendedMatches()', () => {
    it('mapea los partidos al formato MatchCard', async () => {
      mockFrom.mockReturnValue(makeBuilder({ data: [matchFixture] }))

      const cards = await matchesService.getRecommendedMatches()

      expect(cards).toHaveLength(1)
      const card = cards[0]
      expect(card.id).toBe('match-1')
      expect(card.title).toBe('Fútbol domingo')
      expect(card.sport).toBe('futbol')
      expect(card.location).toBe('Cancha Norte')
      expect(card.spotsLeft).toBe(3) // total 10 - current 7
      expect(card.level).toBe('intermedio')
      expect(card.isMixed).toBe(false)
      expect(card.dateTime).toMatch(/\d{2}\/\d{2}\/\d{4}/)
    })

    it('calcula spotsLeft correctamente', async () => {
      const matchFull = { ...matchFixture, total_players: 12, current_players: 12 }
      mockFrom.mockReturnValue(makeBuilder({ data: [matchFull] }))

      const [card] = await matchesService.getRecommendedMatches()

      expect(card.spotsLeft).toBe(0)
    })

    it('lanza error cuando Supabase devuelve error', async () => {
      const builder = makeBuilder({ data: null })
      builder.then = (_: unknown, onRejected: unknown) =>
        Promise.resolve({ data: null, error: new Error('DB error') }).then(_ as Parameters<typeof Promise.prototype.then>[0], onRejected as Parameters<typeof Promise.prototype.then>[1])
      mockFrom.mockReturnValue(builder)

      await expect(matchesService.getRecommendedMatches()).rejects.toThrow()
    })

    it('respeta el límite pasado como parámetro', async () => {
      const builder = makeBuilder({ data: [] })
      mockFrom.mockReturnValue(builder)

      await matchesService.getRecommendedMatches(3)

      expect(builder.limit).toHaveBeenCalledWith(3)
    })
  })

  // ── create ─────────────────────────────────────────────────────────────────
  describe('create()', () => {
    it('serializa venue_coordinates al formato PostgreSQL POINT', async () => {
      const builder = makeBuilder({ data: matchFixture })
      mockFrom.mockReturnValue(builder)

      await matchesService.create({
        ...matchFixture,
        venue_coordinates: { x: -64.18, y: -31.41 } as unknown as null,
      } as Parameters<typeof matchesService.create>[0])

      // Verifica que insert fue llamado con el string de coords
      const insertCall = builder.insert.mock.calls[0][0] as Record<string, unknown>
      expect(insertCall.venue_coordinates).toBe('(-64.18,-31.41)')
    })

    it('serializa venue_coordinates a null cuando no tiene coordenadas', async () => {
      const builder = makeBuilder({ data: matchFixture })
      mockFrom.mockReturnValue(builder)

      await matchesService.create({
        ...matchFixture,
        venue_coordinates: null,
      } as Parameters<typeof matchesService.create>[0])

      const insertCall = builder.insert.mock.calls[0][0] as Record<string, unknown>
      expect(insertCall.venue_coordinates).toBeNull()
    })

    it('lanza error cuando Supabase falla al insertar', async () => {
      const builder = makeBuilder({})
      builder.single = jest.fn().mockResolvedValue({ data: null, error: new Error('Insert failed') })
      mockFrom.mockReturnValue(builder)

      await expect(
        matchesService.create(matchFixture as Parameters<typeof matchesService.create>[0]),
      ).rejects.toThrow('Insert failed')
    })
  })

  // ── cancel ─────────────────────────────────────────────────────────────────
  describe('cancel()', () => {
    it('actualiza el status a "cancelled"', async () => {
      const builder = makeBuilder({ data: null, error: null })
      mockFrom.mockReturnValue(builder)

      await matchesService.cancel('match-1')

      expect(builder.update).toHaveBeenCalledWith({ status: 'cancelled' })
      expect(builder.eq).toHaveBeenCalledWith('id', 'match-1')
    })

    it('lanza error cuando Supabase devuelve error', async () => {
      const builder = makeBuilder({})
      builder.then = (_: unknown, onRejected: unknown) =>
        Promise.resolve({ data: null, error: new Error('Cancel failed') }).then(_ as Parameters<typeof Promise.prototype.then>[0], onRejected as Parameters<typeof Promise.prototype.then>[1])
      mockFrom.mockReturnValue(builder)

      await expect(matchesService.cancel('match-1')).rejects.toThrow('Cancel failed')
    })
  })

  // ── getNextMatchForUser ────────────────────────────────────────────────────
  describe('getNextMatchForUser()', () => {
    it('retorna null cuando el usuario no tiene partidos', async () => {
      mockFrom.mockReturnValue(makeBuilder({ data: [] }))

      const { data } = await matchesService.getNextMatchForUser('user-1')

      expect(data).toBeNull()
    })

    it('retorna el próximo partido sin duplicar cuando el usuario creó y también es participante', async () => {
      const future = new Date(Date.now() + 86400000).toISOString()
      const sameMatch = { ...matchFixture, id: 'dupe-match', starts_at: future }

      // Primera llamada: partidos creados; segunda: partidos joined
      let callCount = 0
      mockFrom.mockImplementation(() => {
        callCount++
        return makeBuilder({ data: [sameMatch] })
      })

      const { data } = await matchesService.getNextMatchForUser('user-1')

      // Aunque el partido aparece en ambas listas, solo debe retornar uno
      expect(data).not.toBeNull()
      expect(data!.id).toBe('dupe-match')
    })

    it('ignora partidos cancelados', async () => {
      const future = new Date(Date.now() + 86400000).toISOString()
      const cancelledMatch = { ...matchFixture, id: 'cancelled-match', starts_at: future, status: 'cancelled' }
      const openMatch = { ...matchFixture, id: 'open-match', starts_at: future, status: 'open' }

      let callCount = 0
      mockFrom.mockImplementation(() => {
        callCount++
        return makeBuilder({ data: callCount === 1 ? [cancelledMatch] : [openMatch] })
      })

      const { data } = await matchesService.getNextMatchForUser('user-1')

      expect(data!.id).toBe('open-match')
    })

    it('ignora partidos pasados', async () => {
      const past = new Date(Date.now() - 86400000).toISOString()
      const pastMatch = { ...matchFixture, id: 'past-match', starts_at: past }

      mockFrom.mockReturnValue(makeBuilder({ data: [pastMatch] }))

      const { data } = await matchesService.getNextMatchForUser('user-1')

      expect(data).toBeNull()
    })
  })

  // ── getById ────────────────────────────────────────────────────────────────
  describe('getById()', () => {
    it('llama a from("matches") con el id correcto', () => {
      const builder = makeBuilder({ data: matchFixture })
      mockFrom.mockReturnValue(builder)

      matchesService.getById('match-1')

      expect(mockFrom).toHaveBeenCalledWith('matches')
      expect(builder.eq).toHaveBeenCalledWith('id', 'match-1')
      expect(builder.single).toHaveBeenCalled()
    })
  })
})
