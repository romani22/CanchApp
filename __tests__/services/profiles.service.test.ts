import { profilesService } from '@/services/profiles.service'

// ── Supabase query builder factory ───────────────────────────────────────────
function makeBuilder(result: { data?: unknown; error?: unknown } = {}) {
  const resolved = { data: result.data ?? null, error: result.error ?? null }
  const builder: Record<string, jest.Mock> & {
    then: (onFulfilled?: (v: typeof resolved) => unknown) => Promise<unknown>
  } = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    contains: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(resolved),
    maybeSingle: jest.fn().mockResolvedValue(resolved),
    then: (onFulfilled?: (v: typeof resolved) => unknown) =>
      Promise.resolve(resolved).then(onFulfilled),
  } as unknown as typeof builder
  return builder
}

jest.mock('@/lib/supabase', () => {
  const mockFrom = jest.fn()
  return {
    supabase: {
      from: (...args: unknown[]) => mockFrom(...args),
    },
    __mockFrom: mockFrom,
  }
})

// eslint-disable-next-line @typescript-eslint/no-require-imports
const supabaseMock = jest.requireMock('@/lib/supabase') as { __mockFrom: jest.Mock }
const mockFrom = supabaseMock.__mockFrom

// ── Fixtures ─────────────────────────────────────────────────────────────────
const profileFixture = {
  id: 'user-1',
  full_name: 'María García',
  email: 'maria@example.com',
  avatar_url: null,
  sport: 'futbol',
  favorite_sports: ['futbol', 'tenis'],
  skill_level: 'intermedio',
  zone: 'Córdoba',
  zone_coordinates: null,
  rating: 4.5,
  elo_rating: 1200,
  notifications_enabled: true,
  notification_radius: 20,
  created_at: '2026-01-01T00:00:00Z',
}

// ────────────────────────────────────────────────────────────────────────────

describe('profilesService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ── getById ────────────────────────────────────────────────────────────────
  describe('getById()', () => {
    it('retorna el perfil cuando existe', async () => {
      mockFrom.mockReturnValue(makeBuilder({ data: profileFixture }))

      const result = await profilesService.getById('user-1')

      expect(result).toEqual(profileFixture)
      expect(mockFrom).toHaveBeenCalledWith('profiles')
    })

    it('retorna null cuando el usuario no existe', async () => {
      mockFrom.mockReturnValue(makeBuilder({ data: null }))

      const result = await profilesService.getById('no-existe')

      expect(result).toBeNull()
    })

    it('lanza error cuando Supabase falla', async () => {
      mockFrom.mockReturnValue(makeBuilder({ data: null, error: new Error('DB error') }))

      await expect(profilesService.getById('user-1')).rejects.toThrow('DB error')
    })
  })

  // ── updateProfile — serializeCoords ────────────────────────────────────────
  describe('updateProfile() — serialización de coordenadas', () => {
    it('serializa zone_coordinates al formato PostgreSQL POINT "(x,y)"', async () => {
      const builder = makeBuilder({ data: profileFixture })
      mockFrom.mockReturnValue(builder)

      await profilesService.updateProfile('user-1', {
        zone: 'Córdoba',
        zone_coordinates: { x: -64.18, y: -31.41 } as unknown as null,
      })

      const updateCall = builder.update.mock.calls[0][0] as Record<string, unknown>
      expect(updateCall.zone_coordinates).toBe('(-64.18,-31.41)')
    })

    it('serializa zone_coordinates a null cuando las coordenadas son null', async () => {
      const builder = makeBuilder({ data: profileFixture })
      mockFrom.mockReturnValue(builder)

      await profilesService.updateProfile('user-1', {
        zone: 'Sin zona',
        zone_coordinates: null,
      })

      const updateCall = builder.update.mock.calls[0][0] as Record<string, unknown>
      expect(updateCall.zone_coordinates).toBeNull()
    })

    it('serializa zone_coordinates a null cuando x o y son undefined', async () => {
      const builder = makeBuilder({ data: profileFixture })
      mockFrom.mockReturnValue(builder)

      await profilesService.updateProfile('user-1', {
        zone_coordinates: { x: undefined, y: -31.41 } as unknown as null,
      })

      const updateCall = builder.update.mock.calls[0][0] as Record<string, unknown>
      expect(updateCall.zone_coordinates).toBeNull()
    })

    it('actualiza el perfil sin zone_coordinates sin modificar ese campo', async () => {
      const builder = makeBuilder({ data: profileFixture })
      mockFrom.mockReturnValue(builder)

      await profilesService.updateProfile('user-1', { full_name: 'Nuevo Nombre' })

      const updateCall = builder.update.mock.calls[0][0] as Record<string, unknown>
      expect(updateCall.full_name).toBe('Nuevo Nombre')
      expect(updateCall.zone_coordinates).toBeUndefined()
    })

    it('lanza error cuando Supabase falla', async () => {
      const builder = makeBuilder({})
      builder.single = jest.fn().mockResolvedValue({ data: null, error: new Error('Update failed') })
      mockFrom.mockReturnValue(builder)

      await expect(
        profilesService.updateProfile('user-1', { full_name: 'Test' }),
      ).rejects.toThrow('Update failed')
    })
  })

  // ── addFavoriteSport ───────────────────────────────────────────────────────
  describe('addFavoriteSport()', () => {
    it('agrega un deporte nuevo a la lista de favoritos', async () => {
      const builder = makeBuilder({ data: { ...profileFixture, favorite_sports: ['futbol', 'tenis', 'padel'] } })
      mockFrom.mockReturnValue(builder)

      await profilesService.addFavoriteSport('user-1', ['futbol', 'tenis'], 'padel')

      const updateCall = builder.update.mock.calls[0][0] as Record<string, unknown>
      expect(updateCall.favorite_sports).toContain('padel')
      expect(updateCall.favorite_sports).toContain('futbol')
      expect(updateCall.favorite_sports).toContain('tenis')
    })

    it('no agrega duplicados si el deporte ya está en la lista', async () => {
      // Si el deporte ya existe, retorna la lista actual sin hacer update
      const currentSports = ['futbol', 'tenis'] as const

      const result = await profilesService.addFavoriteSport('user-1', currentSports as unknown as Parameters<typeof profilesService.addFavoriteSport>[1], 'futbol')

      // No debe llamar a Supabase
      expect(mockFrom).not.toHaveBeenCalled()
      expect(result).toEqual(currentSports)
    })
  })

  // ── removeFavoriteSport ────────────────────────────────────────────────────
  describe('removeFavoriteSport()', () => {
    it('elimina el deporte de la lista de favoritos', async () => {
      const builder = makeBuilder({ data: { ...profileFixture, favorite_sports: ['tenis'] } })
      mockFrom.mockReturnValue(builder)

      await profilesService.removeFavoriteSport('user-1', ['futbol', 'tenis'], 'futbol')

      const updateCall = builder.update.mock.calls[0][0] as Record<string, unknown>
      expect(updateCall.favorite_sports).not.toContain('futbol')
      expect((updateCall.favorite_sports as string[]).length).toBe(1)
    })

    it('retorna lista vacía al eliminar el único deporte favorito', async () => {
      const builder = makeBuilder({ data: { ...profileFixture, favorite_sports: [] } })
      mockFrom.mockReturnValue(builder)

      await profilesService.removeFavoriteSport('user-1', ['futbol'], 'futbol')

      const updateCall = builder.update.mock.calls[0][0] as Record<string, unknown>
      expect(updateCall.favorite_sports).toEqual([])
    })
  })

  // ── getUserStats ───────────────────────────────────────────────────────────
  describe('getUserStats()', () => {
    it('retorna estadísticas del usuario desde la vista user_stats', async () => {
      const stats = {
        user_id: 'user-1',
        total_matches: 25,
        total_wins: 15,
        elo_rating: 1350,
        rating: 4.8,
        rating_count: 20,
      }
      mockFrom.mockReturnValue(makeBuilder({ data: stats }))

      const result = await profilesService.getUserStats('user-1')

      expect(result).toEqual(stats)
      expect(mockFrom).toHaveBeenCalledWith('user_stats')
    })

    it('retorna null cuando el usuario no tiene estadísticas', async () => {
      mockFrom.mockReturnValue(makeBuilder({ data: null }))

      const result = await profilesService.getUserStats('user-1')

      expect(result).toBeNull()
    })

    it('lanza error cuando Supabase falla', async () => {
      mockFrom.mockReturnValue(makeBuilder({ data: null, error: new Error('Stats error') }))

      await expect(profilesService.getUserStats('user-1')).rejects.toThrow('Stats error')
    })
  })

  // ── listBySport ────────────────────────────────────────────────────────────
  describe('listBySport()', () => {
    it('filtra perfiles que contienen el deporte en favorite_sports', async () => {
      const builder = makeBuilder({ data: [profileFixture] })
      mockFrom.mockReturnValue(builder)

      await profilesService.listBySport('futbol')

      expect(builder.contains).toHaveBeenCalledWith('favorite_sports', ['futbol'])
    })

    it('retorna lista vacía cuando no hay perfiles con ese deporte', async () => {
      mockFrom.mockReturnValue(makeBuilder({ data: [] }))

      const result = await profilesService.listBySport('voley')

      expect(result).toEqual([])
    })
  })
})
