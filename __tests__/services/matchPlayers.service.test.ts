import { matchPlayersService } from '@/services/matchPlayers.service'

// ── Supabase query builder factory ───────────────────────────────────────────
function makeBuilder(result: { data?: unknown; error?: unknown } = {}) {
  const resolved = { data: result.data ?? null, error: result.error ?? null }
  const builder: Record<string, jest.Mock> & {
    then: (onFulfilled?: (v: typeof resolved) => unknown) => Promise<unknown>
  } = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(resolved),
    maybeSingle: jest.fn().mockResolvedValue(resolved),
    then: (onFulfilled?: (v: typeof resolved) => unknown) =>
      Promise.resolve(resolved).then(onFulfilled),
  } as unknown as typeof builder
  return builder
}

jest.mock('@/lib/supabase', () => {
  const mockFrom = jest.fn()
  const mockRpc = jest.fn()
  const mockChannel = jest.fn()
  return {
    supabase: {
      from: (...args: unknown[]) => mockFrom(...args),
      rpc: (...args: unknown[]) => mockRpc(...args),
      channel: (...args: unknown[]) => mockChannel(...args),
    },
    __mockFrom: mockFrom,
    __mockRpc: mockRpc,
    __mockChannel: mockChannel,
  }
})

// eslint-disable-next-line @typescript-eslint/no-require-imports
const supabaseMock = jest.requireMock('@/lib/supabase') as { __mockFrom: jest.Mock; __mockRpc: jest.Mock; __mockChannel: jest.Mock }
const mockFrom = supabaseMock.__mockFrom
const mockRpc = supabaseMock.__mockRpc
const mockChannel = supabaseMock.__mockChannel

// ── Fixtures ─────────────────────────────────────────────────────────────────
const playerWithUser = {
  id: 'player-1',
  match_id: 'match-1',
  user_id: 'user-1',
  player_name: 'Carlos',
  team_slot: 'A' as const,
  added_by_user_id: 'organizer-1',
  created_at: '2026-04-20T10:00:00Z',
  user: { id: 'user-1', full_name: 'Carlos Rodríguez', avatar_url: null },
  added_by: null,
}

const guestPlayer = {
  id: 'player-2',
  match_id: 'match-1',
  user_id: null,
  player_name: 'Invitado A',
  team_slot: 'B' as const,
  added_by_user_id: 'organizer-1',
  created_at: '2026-04-20T10:01:00Z',
  user: null,
  added_by: null,
}

// ────────────────────────────────────────────────────────────────────────────

describe('matchPlayersService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ── canAddMorePlayers ──────────────────────────────────────────────────────
  describe('canAddMorePlayers()', () => {
    it('retorna canAdd=true y remaining correcto cuando hay lugares disponibles', async () => {
      mockFrom.mockReturnValue(
        makeBuilder({ data: { current_players: 4, total_players: 10, status: 'open' } }),
      )

      const result = await matchPlayersService.canAddMorePlayers('match-1')

      expect(result.canAdd).toBe(true)
      expect(result.remaining).toBe(6)
    })

    it('retorna canAdd=false cuando el partido está lleno', async () => {
      mockFrom.mockReturnValue(
        makeBuilder({ data: { current_players: 10, total_players: 10, status: 'open' } }),
      )

      const result = await matchPlayersService.canAddMorePlayers('match-1')

      expect(result.canAdd).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('retorna canAdd=false cuando el status no es "open"', async () => {
      mockFrom.mockReturnValue(
        makeBuilder({ data: { current_players: 5, total_players: 10, status: 'full' } }),
      )

      const result = await matchPlayersService.canAddMorePlayers('match-1')

      expect(result.canAdd).toBe(false)
    })

    it('retorna { canAdd: false, remaining: 0 } ante un error de Supabase', async () => {
      mockFrom.mockReturnValue(
        makeBuilder({ data: null, error: new Error('DB error') }),
      )

      const result = await matchPlayersService.canAddMorePlayers('match-1')

      expect(result).toEqual({ canAdd: false, remaining: 0 })
    })
  })

  // ── getMatchPlayersStats ───────────────────────────────────────────────────
  describe('getMatchPlayersStats()', () => {
    it('calcula correctamente total, registered, guests y byTeam', async () => {
      const players = [
        { user_id: 'user-1', team_slot: 'A' },
        { user_id: null, team_slot: 'B' },
        { user_id: 'user-2', team_slot: 'A' },
        { user_id: null, team_slot: null },
        { user_id: 'user-3', team_slot: null },
      ]
      mockFrom.mockReturnValue(makeBuilder({ data: players }))

      const stats = await matchPlayersService.getMatchPlayersStats('match-1')

      expect(stats.total).toBe(5)
      expect(stats.registered).toBe(3)
      expect(stats.guests).toBe(2)
      expect(stats.byTeam.A).toBe(2)
      expect(stats.byTeam.B).toBe(1)
      expect(stats.byTeam.none).toBe(2)
    })

    it('retorna todo en cero ante un error', async () => {
      mockFrom.mockReturnValue(makeBuilder({ data: null, error: new Error('Error') }))

      const stats = await matchPlayersService.getMatchPlayersStats('match-1')

      expect(stats).toEqual({
        total: 0,
        registered: 0,
        guests: 0,
        byTeam: { A: 0, B: 0, none: 0 },
      })
    })

    it('funciona con lista vacía', async () => {
      mockFrom.mockReturnValue(makeBuilder({ data: [] }))

      const stats = await matchPlayersService.getMatchPlayersStats('match-1')

      expect(stats.total).toBe(0)
      expect(stats.registered).toBe(0)
      expect(stats.guests).toBe(0)
    })
  })

  // ── searchUsers ────────────────────────────────────────────────────────────
  describe('searchUsers()', () => {
    it('retorna array vacío para query menor a 2 caracteres', async () => {
      const result = await matchPlayersService.searchUsers('a')
      expect(result).toEqual([])
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('retorna array vacío para query vacía', async () => {
      const result = await matchPlayersService.searchUsers('')
      expect(result).toEqual([])
    })

    it('retorna array vacío para query de solo espacios', async () => {
      const result = await matchPlayersService.searchUsers('   ')
      expect(result).toEqual([])
    })

    it('busca usuarios cuando query tiene 2 o más caracteres', async () => {
      const users = [{ id: 'u1', full_name: 'María García' }]
      mockFrom.mockReturnValue(makeBuilder({ data: users }))

      const result = await matchPlayersService.searchUsers('Ma')

      expect(mockFrom).toHaveBeenCalledWith('profiles')
      expect(result).toEqual(users)
    })

    it('escapa caracteres especiales en la búsqueda', async () => {
      const builder = makeBuilder({ data: [] })
      mockFrom.mockReturnValue(builder)

      await matchPlayersService.searchUsers('test%_test')

      // El query debe escapar % y _ con backslash
      const orCall = builder.or.mock.calls[0][0] as string
      expect(orCall).toContain('\\%')
      expect(orCall).toContain('\\_')
    })

    it('respeta el límite máximo de 10', async () => {
      const builder = makeBuilder({ data: [] })
      mockFrom.mockReturnValue(builder)

      await matchPlayersService.searchUsers('test', 50)

      expect(builder.limit).toHaveBeenCalledWith(10) // normalizeSearchLimit clamps a 10
    })

    it('respeta el límite mínimo de 1', async () => {
      const builder = makeBuilder({ data: [] })
      mockFrom.mockReturnValue(builder)

      await matchPlayersService.searchUsers('test', 0)

      expect(builder.limit).toHaveBeenCalledWith(1) // normalizeSearchLimit clamps a 1
    })
  })

  // ── getMatchPlayers ────────────────────────────────────────────────────────
  describe('getMatchPlayers()', () => {
    it('retorna la lista de jugadores con perfiles', async () => {
      mockFrom.mockReturnValue(makeBuilder({ data: [playerWithUser, guestPlayer] }))

      const players = await matchPlayersService.getMatchPlayers('match-1')

      expect(players).toHaveLength(2)
      expect(players[0].user_id).toBe('user-1')
      expect(players[1].user_id).toBeNull()
    })

    it('lanza error cuando Supabase falla', async () => {
      const builder = makeBuilder({})
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(builder as any).then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (r: unknown) => unknown) =>
        Promise.resolve({ data: null, error: new Error('Query failed') }).then(onFulfilled, onRejected)
      mockFrom.mockReturnValue(builder)

      await expect(matchPlayersService.getMatchPlayers('match-1')).rejects.toThrow('Query failed')
    })
  })

  // ── removePlayer ───────────────────────────────────────────────────────────
  describe('removePlayer()', () => {
    it('llama a RPC remove_match_player con el id correcto', async () => {
      mockRpc.mockResolvedValue({ data: true, error: null })

      const result = await matchPlayersService.removePlayer('player-1')

      expect(mockRpc).toHaveBeenCalledWith('remove_match_player', { p_player_id: 'player-1' })
      expect(result).toBe(true)
    })

    it('lanza error cuando RPC falla', async () => {
      mockRpc.mockResolvedValue({ data: null, error: new Error('RPC error') })

      await expect(matchPlayersService.removePlayer('player-1')).rejects.toThrow('RPC error')
    })
  })

  // ── addMultiplePlayers ─────────────────────────────────────────────────────
  describe('addMultiplePlayers()', () => {
    it('llama a RPC add_multiple_players con los parámetros correctos', async () => {
      const rpcResult = [
        { success: true, player_id: 'p1', player_name: 'Juan', error_message: null },
      ]
      mockRpc.mockResolvedValue({ data: rpcResult, error: null })

      const players = [{ player_name: 'Juan', user_id: null, team_slot: null }]
      const result = await matchPlayersService.addMultiplePlayers('match-1', 'organizer-1', players)

      expect(mockRpc).toHaveBeenCalledWith('add_multiple_players', {
        p_match_id: 'match-1',
        p_added_by_user_id: 'organizer-1',
        p_players: players,
      })
      expect(result).toEqual(rpcResult)
    })
  })

  // ── subscribe ──────────────────────────────────────────────────────────────
  describe('subscribe()', () => {
    it('crea un canal con el matchId correcto', () => {
      const mockSubscribe = jest.fn().mockReturnValue({ unsubscribe: jest.fn() })
      const mockOn = jest.fn().mockReturnThis()
      mockChannel.mockReturnValue({ on: mockOn, subscribe: mockSubscribe })

      matchPlayersService.subscribe('match-1', jest.fn())

      expect(mockChannel).toHaveBeenCalledWith('match_players:match-1')
    })
  })
})
