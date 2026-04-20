import { renderHook, act } from '@testing-library/react-native'
import { useMatchPlayers } from '@/hooks/useMatchplayers'

// ── Service mocks ─────────────────────────────────────────────────────────────
jest.mock('@/services/matchPlayers.service', () => ({
  matchPlayersService: {
    getMatchPlayers: jest.fn(),
    canAddMorePlayers: jest.fn(),
    addPlayer: jest.fn(),
    addMultiplePlayers: jest.fn(),
    removePlayer: jest.fn(),
    updatePlayerTeam: jest.fn(),
    subscribe: jest.fn(),
  },
}))

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'organizer-1' } }),
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockMatchPlayersService = (jest.requireMock('@/services/matchPlayers.service') as { matchPlayersService: Record<string, jest.Mock> }).matchPlayersService

// ── Fixtures ──────────────────────────────────────────────────────────────────
const makePlayer = (overrides: Partial<{
  id: string
  user_id: string | null
  team_slot: 'A' | 'B' | null
  added_by_user_id: string
}> = {}) => ({
  id: overrides.id ?? 'player-1',
  match_id: 'match-1',
  user_id: overrides.user_id !== undefined ? overrides.user_id : 'user-1',
  player_name: 'Carlos',
  team_slot: overrides.team_slot !== undefined ? overrides.team_slot : ('A' as 'A' | 'B' | null),
  added_by_user_id: overrides.added_by_user_id ?? 'organizer-1',
  created_at: '2026-04-20T10:00:00Z',
  user: null,
  added_by: null,
})

// ────────────────────────────────────────────────────────────────────────────

describe('useMatchPlayers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Default mock de subscribe que retorna un objeto con unsubscribe
    mockMatchPlayersService.subscribe.mockReturnValue({ unsubscribe: jest.fn() })
    mockMatchPlayersService.getMatchPlayers.mockResolvedValue([])
    mockMatchPlayersService.canAddMorePlayers.mockResolvedValue({ canAdd: true, remaining: 5 })
  })

  // ── Estado inicial ─────────────────────────────────────────────────────────
  describe('estado inicial', () => {
    it('inicia con players vacío y canAddMore=true', async () => {
      const { result } = renderHook(() => useMatchPlayers('match-1'))

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      expect(result.current.players).toEqual([])
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('no carga cuando matchId es undefined', async () => {
      const { result } = renderHook(() => useMatchPlayers(undefined))

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      expect(mockMatchPlayersService.getMatchPlayers).not.toHaveBeenCalled()
      expect(result.current.players).toEqual([])
    })

    it('carga jugadores al montar', async () => {
      const players = [makePlayer()]
      mockMatchPlayersService.getMatchPlayers.mockResolvedValue(players)
      mockMatchPlayersService.canAddMorePlayers.mockResolvedValue({ canAdd: true, remaining: 4 })

      const { result } = renderHook(() => useMatchPlayers('match-1'))

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      expect(result.current.players).toHaveLength(1)
      expect(result.current.canAddMore).toBe(true)
      expect(result.current.remainingSlots).toBe(4)
    })

    it('establece canAddMore=false cuando el partido está lleno', async () => {
      mockMatchPlayersService.canAddMorePlayers.mockResolvedValue({ canAdd: false, remaining: 0 })

      const { result } = renderHook(() => useMatchPlayers('match-1'))

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      expect(result.current.canAddMore).toBe(false)
      expect(result.current.remainingSlots).toBe(0)
    })
  })

  // ── getStats ───────────────────────────────────────────────────────────────
  describe('getStats()', () => {
    it('retorna todo en cero cuando players está vacío', async () => {
      const { result } = renderHook(() => useMatchPlayers('match-1'))

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      const stats = result.current.getStats()

      expect(stats).toEqual({
        total: 0,
        registered: 0,
        guests: 0,
        byTeam: { A: 0, B: 0, none: 0 },
      })
    })

    it('calcula correctamente registered vs guests', async () => {
      const players = [
        makePlayer({ id: 'p1', user_id: 'user-1', team_slot: 'A' }),
        makePlayer({ id: 'p2', user_id: 'user-2', team_slot: 'B' }),
        makePlayer({ id: 'p3', user_id: null, team_slot: 'A' }), // guest
        makePlayer({ id: 'p4', user_id: null, team_slot: null }), // guest sin equipo
      ]
      mockMatchPlayersService.getMatchPlayers.mockResolvedValue(players)

      const { result } = renderHook(() => useMatchPlayers('match-1'))

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      const stats = result.current.getStats()

      expect(stats.total).toBe(4)
      expect(stats.registered).toBe(2)
      expect(stats.guests).toBe(2)
      expect(stats.byTeam.A).toBe(2)
      expect(stats.byTeam.B).toBe(1)
      expect(stats.byTeam.none).toBe(1)
    })

    it('cuenta correctamente jugadores sin equipo asignado', async () => {
      const players = [
        makePlayer({ id: 'p1', user_id: 'user-1', team_slot: null }),
        makePlayer({ id: 'p2', user_id: null, team_slot: null }),
      ]
      mockMatchPlayersService.getMatchPlayers.mockResolvedValue(players)

      const { result } = renderHook(() => useMatchPlayers('match-1'))

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      const stats = result.current.getStats()

      expect(stats.byTeam.A).toBe(0)
      expect(stats.byTeam.B).toBe(0)
      expect(stats.byTeam.none).toBe(2)
    })
  })

  // ── getMyAddedPlayers ──────────────────────────────────────────────────────
  describe('getMyAddedPlayers()', () => {
    it('retorna solo los jugadores agregados por el usuario actual', async () => {
      const players = [
        makePlayer({ id: 'p1', added_by_user_id: 'organizer-1' }),
        makePlayer({ id: 'p2', added_by_user_id: 'otro-usuario' }),
        makePlayer({ id: 'p3', added_by_user_id: 'organizer-1' }),
      ]
      mockMatchPlayersService.getMatchPlayers.mockResolvedValue(players)

      const { result } = renderHook(() => useMatchPlayers('match-1'))

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      const myPlayers = result.current.getMyAddedPlayers()

      expect(myPlayers).toHaveLength(2)
      expect(myPlayers.every((p) => p.added_by_user_id === 'organizer-1')).toBe(true)
    })

    it('retorna array vacío cuando ningún jugador fue agregado por el usuario actual', async () => {
      const players = [
        makePlayer({ id: 'p1', added_by_user_id: 'otro-usuario' }),
      ]
      mockMatchPlayersService.getMatchPlayers.mockResolvedValue(players)

      const { result } = renderHook(() => useMatchPlayers('match-1'))

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      expect(result.current.getMyAddedPlayers()).toEqual([])
    })
  })

  // ── addPlayer ──────────────────────────────────────────────────────────────
  describe('addPlayer()', () => {
    it('llama al servicio y recarga la lista', async () => {
      const newPlayer = makePlayer({ id: 'new-player' })
      mockMatchPlayersService.addPlayer.mockResolvedValue(newPlayer)
      const updatedList = [newPlayer]
      mockMatchPlayersService.getMatchPlayers
        .mockResolvedValueOnce([]) // carga inicial
        .mockResolvedValueOnce(updatedList) // recarga tras addPlayer

      const { result } = renderHook(() => useMatchPlayers('match-1'))

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      await act(async () => {
        await result.current.addPlayer({ player_name: 'Nuevo Jugador', team_slot: 'A' })
      })

      expect(mockMatchPlayersService.addPlayer).toHaveBeenCalledWith(
        'match-1',
        'organizer-1',
        { player_name: 'Nuevo Jugador', team_slot: 'A' },
      )
      expect(result.current.players).toHaveLength(1)
    })

    it('establece error cuando el servicio lanza excepción', async () => {
      mockMatchPlayersService.addPlayer.mockRejectedValue(new Error('El partido está lleno'))

      const { result } = renderHook(() => useMatchPlayers('match-1'))

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      await act(async () => {
        await result.current.addPlayer({ player_name: 'Nuevo', team_slot: null })
      })

      expect(result.current.error).toBe('El partido está lleno')
    })
  })

  // ── removePlayer ───────────────────────────────────────────────────────────
  describe('removePlayer()', () => {
    it('elimina el jugador y recarga la lista', async () => {
      const player = makePlayer()
      mockMatchPlayersService.getMatchPlayers
        .mockResolvedValueOnce([player])
        .mockResolvedValueOnce([]) // tras eliminar

      mockMatchPlayersService.removePlayer.mockResolvedValue(true)

      const { result } = renderHook(() => useMatchPlayers('match-1'))

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      await act(async () => {
        await result.current.removePlayer('player-1')
      })

      expect(mockMatchPlayersService.removePlayer).toHaveBeenCalledWith('player-1')
    })
  })

  // ── updatePlayerTeam ───────────────────────────────────────────────────────
  describe('updatePlayerTeam()', () => {
    it('actualiza el equipo del jugador y retorna true', async () => {
      mockMatchPlayersService.updatePlayerTeam.mockResolvedValue(undefined)
      mockMatchPlayersService.getMatchPlayers
        .mockResolvedValueOnce([makePlayer()])
        .mockResolvedValueOnce([makePlayer({ team_slot: 'B' })])

      const { result } = renderHook(() => useMatchPlayers('match-1'))

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      let updateResult: boolean
      await act(async () => {
        updateResult = await result.current.updatePlayerTeam('player-1', 'B')
      })

      expect(updateResult!).toBe(true)
      expect(mockMatchPlayersService.updatePlayerTeam).toHaveBeenCalledWith('player-1', 'B')
    })

    it('retorna false cuando el servicio lanza excepción', async () => {
      mockMatchPlayersService.updatePlayerTeam.mockRejectedValue(new Error('Update failed'))

      const { result } = renderHook(() => useMatchPlayers('match-1'))

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      let updateResult: boolean
      await act(async () => {
        updateResult = await result.current.updatePlayerTeam('player-1', 'A')
      })

      expect(updateResult!).toBe(false)
    })
  })

  // ── Suscripción en tiempo real ─────────────────────────────────────────────
  describe('suscripción en tiempo real', () => {
    it('suscribe a cambios del partido al montar', async () => {
      const unsubscribe = jest.fn()
      mockMatchPlayersService.subscribe.mockReturnValue({ unsubscribe })

      renderHook(() => useMatchPlayers('match-1'))

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      expect(mockMatchPlayersService.subscribe).toHaveBeenCalledWith('match-1', expect.any(Function))
    })

    it('llama a unsubscribe al desmontar', async () => {
      const unsubscribe = jest.fn()
      mockMatchPlayersService.subscribe.mockReturnValue({ unsubscribe })

      const { unmount } = renderHook(() => useMatchPlayers('match-1'))

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      unmount()

      expect(unsubscribe).toHaveBeenCalled()
    })
  })
})
