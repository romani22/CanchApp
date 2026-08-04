import { matchResultsService } from '@/services/matchResults.service'

// ── Supabase query builder factory ───────────────────────────────────────────
function makeBuilder(result: { data?: unknown; error?: unknown } = {}) {
	const resolved = { data: result.data ?? null, error: result.error ?? null }
	const builder = {
		select: jest.fn().mockReturnThis(),
		eq: jest.fn().mockReturnThis(),
		in: jest.fn().mockReturnThis(),
		order: jest.fn().mockReturnThis(),
		maybeSingle: jest.fn().mockResolvedValue(resolved),
		then: (onFulfilled?: (v: typeof resolved) => unknown) => Promise.resolve(resolved).then(onFulfilled),
	}
	return builder as unknown as typeof builder & Record<string, jest.Mock>
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
			removeChannel: jest.fn(),
		},
		__mockFrom: mockFrom,
		__mockRpc: mockRpc,
	}
})

const supabaseMock = jest.requireMock('@/lib/supabase') as { __mockFrom: jest.Mock; __mockRpc: jest.Mock }
const mockFrom = supabaseMock.__mockFrom
const mockRpc = supabaseMock.__mockRpc

const result = {
	id: 'result-1',
	match_id: 'match-1',
	score_a: 3,
	score_b: 2,
	sets: [],
	notes: null,
	reported_by: 'creator-1',
	has_dispute: false,
	created_at: '2026-04-20T22:00:00Z',
	updated_at: '2026-04-20T22:00:00Z',
}

const confirmation = {
	id: 'vote-1',
	result_id: 'result-1',
	user_id: 'user-2',
	vote: 'confirm' as const,
	comment: null,
	created_at: '2026-04-20T23:00:00Z',
	updated_at: '2026-04-20T23:00:00Z',
	user: { id: 'user-2', full_name: 'Jugador' },
}

const playerStat = {
	id: 'stat-1',
	match_id: 'match-1',
	user_id: 'user-1',
	display_name: 'Carlos',
	outcome: 'win' as const,
	goals: 2,
	assists: null,
	saves: null,
	points: null,
	extra: {},
	created_at: '2026-04-20T22:00:00Z',
}

beforeEach(() => {
	jest.clearAllMocks()
})

describe('getByMatchId()', () => {
	const setupFrom = ({ resultRow = result as unknown, players = [playerStat] as unknown, votes = [confirmation] as unknown } = {}) => {
		mockFrom.mockImplementation((table: string) => {
			if (table === 'match_results') return makeBuilder({ data: resultRow })
			if (table === 'match_player_stats') return makeBuilder({ data: players })
			return makeBuilder({ data: votes })
		})
	}

	it('junta el resultado con las stats por jugador y los votos', async () => {
		setupFrom()

		const data = await matchResultsService.getByMatchId('match-1')

		expect(data).toEqual({ ...result, players: [playerStat], confirmations: [confirmation] })
	})

	// null = "todavía no se cargó", que es el estado normal de un partido nuevo.
	it('devuelve null cuando el partido no tiene resultado', async () => {
		mockFrom.mockImplementation(() => makeBuilder({ data: null }))

		expect(await matchResultsService.getByMatchId('match-1')).toBeNull()
	})

	// Los votos cuelgan del id del resultado, no del partido: sin resultado no hay
	// nada que preguntar.
	it('no consulta los votos si no hay resultado', async () => {
		mockFrom.mockImplementation(() => makeBuilder({ data: null }))

		await matchResultsService.getByMatchId('match-1')

		expect(mockFrom).not.toHaveBeenCalledWith('match_result_confirmations')
	})

	it('devuelve listas vacías cuando no hay stats ni votos', async () => {
		setupFrom({ players: null, votes: null })

		const data = await matchResultsService.getByMatchId('match-1')

		expect(data?.players).toEqual([])
		expect(data?.confirmations).toEqual([])
	})

	it('propaga el error de la consulta', async () => {
		mockFrom.mockImplementation(() => makeBuilder({ error: new Error('Result error') }))

		await expect(matchResultsService.getByMatchId('match-1')).rejects.toThrow('Result error')
	})
})

describe('save()', () => {
	it('manda el resultado a save_match_result y devuelve el id', async () => {
		mockRpc.mockResolvedValue({ data: 'result-1', error: null })

		const id = await matchResultsService.save('match-1', {
			score_a: 3,
			score_b: 2,
			sets: [],
			notes: 'buen partido',
			players: [{ user_id: 'user-1', display_name: 'Carlos', outcome: 'win', goals: 2 }],
		})

		expect(id).toBe('result-1')
		expect(mockRpc).toHaveBeenCalledWith('save_match_result', {
			p_match_id: 'match-1',
			p_score_a: 3,
			p_score_b: 2,
			p_sets: [],
			p_notes: 'buen partido',
			p_players: [{ user_id: 'user-1', display_name: 'Carlos', outcome: 'win', goals: 2, assists: null, saves: null, points: null, extra: {} }],
		})
	})

	// En la base null es "no se cargó" y 0 es un cero real: una métrica que el
	// creador dejó vacía no puede llegar como 0 ni desaparecer del payload.
	it('convierte las métricas sin cargar en null', async () => {
		mockRpc.mockResolvedValue({ data: 'result-1', error: null })

		await matchResultsService.save('match-1', {
			players: [{ user_id: null, display_name: 'Invitado', outcome: 'loss', goals: 0 }],
		})

		expect(mockRpc.mock.calls[0][1].p_players[0]).toEqual({
			user_id: null,
			display_name: 'Invitado',
			outcome: 'loss',
			goals: 0,
			assists: null,
			saves: null,
			points: null,
			extra: {},
		})
	})

	it('deja pasar el error del servidor con su mensaje', async () => {
		mockRpc.mockResolvedValue({ data: null, error: new Error('Sólo el creador del partido puede cargar el resultado') })

		await expect(matchResultsService.save('match-1', { players: [] })).rejects.toThrow('Sólo el creador')
	})
})

describe('remove()', () => {
	it('llama a delete_match_result', async () => {
		mockRpc.mockResolvedValue({ data: null, error: null })

		await matchResultsService.remove('match-1')

		expect(mockRpc).toHaveBeenCalledWith('delete_match_result', { p_match_id: 'match-1' })
	})
})

describe('vote() / clearVote()', () => {
	it('confirma el resultado', async () => {
		mockRpc.mockResolvedValue({ data: null, error: null })

		await matchResultsService.vote('match-1', 'confirm')

		expect(mockRpc).toHaveBeenCalledWith('vote_match_result', { p_match_id: 'match-1', p_vote: 'confirm', p_comment: null })
	})

	it('objeta con comentario', async () => {
		mockRpc.mockResolvedValue({ data: null, error: null })

		await matchResultsService.vote('match-1', 'dispute', 'el segundo gol no fue')

		expect(mockRpc).toHaveBeenCalledWith('vote_match_result', { p_match_id: 'match-1', p_vote: 'dispute', p_comment: 'el segundo gol no fue' })
	})

	// El que cargó el resultado no vota: si está mal, lo corrige. Lo valida el
	// servidor, así que acá sólo importa que el mensaje llegue al usuario.
	it('propaga el rechazo del servidor', async () => {
		mockRpc.mockResolvedValue({ data: null, error: new Error('Cargaste vos el resultado: si está mal, corregilo') })

		await expect(matchResultsService.vote('match-1', 'dispute')).rejects.toThrow('Cargaste vos el resultado')
	})

	it('retira el voto', async () => {
		mockRpc.mockResolvedValue({ data: null, error: null })

		await matchResultsService.clearVote('match-1')

		expect(mockRpc).toHaveBeenCalledWith('clear_match_result_vote', { p_match_id: 'match-1' })
	})
})

describe('getUserSportStats()', () => {
	it('devuelve una fila por deporte jugado', async () => {
		const rows = [{ user_id: 'user-1', sport: 'futbol' }]
		mockFrom.mockReturnValue(makeBuilder({ data: rows }))

		expect(await matchResultsService.getUserSportStats('user-1')).toEqual(rows)
		expect(mockFrom).toHaveBeenCalledWith('user_sport_stats')
	})

	it('devuelve lista vacía si no jugó nada', async () => {
		mockFrom.mockReturnValue(makeBuilder({ data: null }))

		expect(await matchResultsService.getUserSportStats('user-1')).toEqual([])
	})
})

describe('getStatsForUsers()', () => {
	it('indexa las stats por usuario', async () => {
		const rows = [
			{ user_id: 'user-1', sport: 'futbol', wins: 3 },
			{ user_id: 'user-2', sport: 'futbol', wins: 1 },
		]
		mockFrom.mockReturnValue(makeBuilder({ data: rows }))

		const map = await matchResultsService.getStatsForUsers(['user-1', 'user-2'], 'futbol')

		expect(map['user-1']).toEqual(rows[0])
		expect(map['user-2']).toEqual(rows[1])
	})

	// Sin usuarios no hay nada que preguntar: un .in() con lista vacía es un query
	// al servidor para nada.
	it('no consulta con la lista vacía', async () => {
		expect(await matchResultsService.getStatsForUsers([], 'futbol')).toEqual({})
		expect(mockFrom).not.toHaveBeenCalled()
	})
})
