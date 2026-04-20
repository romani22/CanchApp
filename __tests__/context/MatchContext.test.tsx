import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react-native'
import { MatchProvider, useMatches } from '@/context/MatchContext'

// ── Mocks ─────────────────────────────────────────────────────────────────────
jest.mock('@/services/matches.service', () => {
  const mockList = jest.fn()
  return {
    matchesService: { list: (...args: unknown[]) => mockList(...args) },
    __mockList: mockList,
  }
})

jest.mock('@/context/AuthContext', () => {
  const mockFn = jest.fn()
  return { useAuth: () => mockFn(), __mockUseAuth: mockFn }
})

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockMatchesList = (jest.requireMock('@/services/matches.service') as { __mockList: jest.Mock }).__mockList
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockUseAuth = (jest.requireMock('@/context/AuthContext') as { __mockUseAuth: jest.Mock }).__mockUseAuth

// ── Fixtures ──────────────────────────────────────────────────────────────────
const makeMatch = (overrides: Partial<{ id: string; starts_at: string; sport: string }> = {}) => ({
  id: overrides.id ?? 'match-1',
  title: 'Partido de prueba',
  sport: overrides.sport ?? 'futbol',
  venue_name: 'Cancha Sur',
  venue_zone: 'Córdoba',
  starts_at: overrides.starts_at ?? '2026-04-25T10:00:00.000Z',
  total_players: 10,
  current_players: 6,
  skill_level: 'intermedio',
  is_mixed: false,
  status: 'open',
  creator_id: 'creator-1',
  creator: null,
  participants: [],
})

const authenticatedAuth = {
  isAuthenticated: true,
  profile: {
    id: 'user-1',
    zone: 'Córdoba',
    zone_coordinates: { x: -64.18, y: -31.41 },
  },
}

const unauthenticatedAuth = {
  isAuthenticated: false,
  profile: null,
}

// ────────────────────────────────────────────────────────────────────────────

describe('MatchContext', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MatchProvider>{children}</MatchProvider>
  )

  // ── useMatches fuera del provider ─────────────────────────────────────────
  describe('useMatches() fuera del provider', () => {
    it('lanza error cuando se usa fuera de MatchProvider', () => {
      jest.spyOn(console, 'error').mockImplementation(() => {})
      mockUseAuth.mockReturnValue(authenticatedAuth)

      expect(() => renderHook(() => useMatches())).toThrow(
        'useMatches must be used within a MatchProvider',
      )

      jest.restoreAllMocks()
    })
  })

  // ── Estado inicial ─────────────────────────────────────────────────────────
  describe('estado inicial', () => {
    it('retorna arrays vacíos y isLoading=false cuando no está autenticado', async () => {
      mockUseAuth.mockReturnValue(unauthenticatedAuth)
      mockMatchesList.mockResolvedValue({ data: [], error: null })

      const { result } = renderHook(() => useMatches(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.matches).toEqual([])
      expect(result.current.filteredMatches).toEqual([])
    })

    it('carga partidos cuando el usuario está autenticado', async () => {
      mockUseAuth.mockReturnValue(authenticatedAuth)
      const matches = [makeMatch()]
      mockMatchesList.mockResolvedValue({ data: matches, error: null })

      const { result } = renderHook(() => useMatches(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.matches).toHaveLength(1)
    })
  })

  // ── filteredMatches — filtro por fecha ────────────────────────────────────
  describe('filteredMatches — filtro por fecha', () => {
    it('filtra por fecha cuando filters.date está definido', async () => {
      mockUseAuth.mockReturnValue(authenticatedAuth)

      const matchOn25 = makeMatch({ id: 'm1', starts_at: '2026-04-25T10:00:00.000Z' })
      const matchOn26 = makeMatch({ id: 'm2', starts_at: '2026-04-26T10:00:00.000Z' })

      mockMatchesList.mockResolvedValue({ data: [matchOn25, matchOn26], error: null })

      const { result } = renderHook(() => useMatches(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.matches).toHaveLength(2)

      act(() => {
        result.current.setFilters({ date: '2026-04-25' })
      })

      await waitFor(() => {
        expect(result.current.filteredMatches).toHaveLength(1)
      })

      expect(result.current.filteredMatches[0].starts_at).toContain('2026-04-25')
    })

    it('devuelve todos los partidos cuando no hay filtro de fecha', async () => {
      mockUseAuth.mockReturnValue(authenticatedAuth)

      const matches = [
        makeMatch({ id: 'm1', starts_at: '2026-04-25T10:00:00.000Z' }),
        makeMatch({ id: 'm2', starts_at: '2026-04-26T10:00:00.000Z' }),
      ]
      mockMatchesList.mockResolvedValue({ data: matches, error: null })

      const { result } = renderHook(() => useMatches(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.filteredMatches.length).toBe(result.current.matches.length)
    })
  })

  // ── getMatchById ───────────────────────────────────────────────────────────
  describe('getMatchById()', () => {
    it('retorna el partido correcto por id', async () => {
      mockUseAuth.mockReturnValue(authenticatedAuth)

      const match1 = makeMatch({ id: 'target-match' })
      const match2 = makeMatch({ id: 'other-match' })
      mockMatchesList.mockResolvedValue({ data: [match1, match2], error: null })

      const { result } = renderHook(() => useMatches(), { wrapper })

      await waitFor(() => {
        expect(result.current.matches).toHaveLength(2)
      })

      const found = result.current.getMatchById('target-match')
      expect(found?.id).toBe('target-match')
    })

    it('retorna undefined cuando el id no existe', async () => {
      mockUseAuth.mockReturnValue(authenticatedAuth)
      mockMatchesList.mockResolvedValue({ data: [makeMatch()], error: null })

      const { result } = renderHook(() => useMatches(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.getMatchById('id-inexistente')).toBeUndefined()
    })
  })

  // ── setZone ────────────────────────────────────────────────────────────────
  describe('setZone()', () => {
    it('actualiza la zona activa', async () => {
      mockUseAuth.mockReturnValue(unauthenticatedAuth)
      mockMatchesList.mockResolvedValue({ data: [], error: null })

      const { result } = renderHook(() => useMatches(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const newZone = { label: 'Buenos Aires', lng: -58.38, lat: -34.6, radiusKm: 15 }

      act(() => {
        result.current.setZone(newZone)
      })

      expect(result.current.activeZone).toEqual(newZone)
    })

    it('acepta null para limpiar la zona activa', async () => {
      mockUseAuth.mockReturnValue(unauthenticatedAuth)
      mockMatchesList.mockResolvedValue({ data: [], error: null })

      const { result } = renderHook(() => useMatches(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      act(() => {
        result.current.setZone({ label: 'Córdoba', lng: -64.18, lat: -31.41, radiusKm: 20 })
      })

      act(() => {
        result.current.setZone(null)
      })

      expect(result.current.activeZone).toBeNull()
    })
  })

  // ── clearFilters ───────────────────────────────────────────────────────────
  describe('clearFilters()', () => {
    it('limpia sport y date de los filtros activos', async () => {
      mockUseAuth.mockReturnValue(authenticatedAuth)
      mockMatchesList.mockResolvedValue({ data: [], error: null })

      const { result } = renderHook(() => useMatches(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      act(() => {
        result.current.setFilters({ sport: 'futbol', date: '2026-04-25' })
      })

      act(() => {
        result.current.clearFilters()
      })

      expect(result.current.filters).toEqual({})
    })
  })

  // ── error state ────────────────────────────────────────────────────────────
  describe('estado de error', () => {
    it('establece error cuando matchesService.list falla', async () => {
      mockUseAuth.mockReturnValue(authenticatedAuth)
      mockMatchesList.mockResolvedValue({ data: null, error: new Error('Network error') })

      const { result } = renderHook(() => useMatches(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBe('No se pudieron cargar los partidos')
    })
  })
})
