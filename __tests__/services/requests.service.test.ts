import { requestsService } from '@/services/requests.service'

// ── Supabase query builder factory ───────────────────────────────────────────
function makeBuilder(result: { data?: unknown; error?: unknown } = {}) {
	const resolved = { data: result.data ?? null, error: result.error ?? null }
	const builder = {
		select: jest.fn().mockReturnThis(),
		eq: jest.fn().mockReturnThis(),
		order: jest.fn().mockReturnThis(),
		insert: jest.fn().mockReturnThis(),
		update: jest.fn().mockReturnThis(),
		delete: jest.fn().mockReturnThis(),
		maybeSingle: jest.fn().mockResolvedValue(resolved),
		then: (onFulfilled?: (v: typeof resolved) => unknown) => Promise.resolve(resolved).then(onFulfilled),
	}
	return builder as unknown as typeof builder & Record<string, jest.Mock>
}

jest.mock('@/lib/supabase', () => {
	const mockFrom = jest.fn()
	const mockRpc = jest.fn()
	return {
		supabase: {
			from: (...args: unknown[]) => mockFrom(...args),
			rpc: (...args: unknown[]) => mockRpc(...args),
			channel: jest.fn(),
			removeChannel: jest.fn(),
		},
		__mockFrom: mockFrom,
		__mockRpc: mockRpc,
	}
})

const supabaseMock = jest.requireMock('@/lib/supabase') as { __mockFrom: jest.Mock; __mockRpc: jest.Mock }
const mockFrom = supabaseMock.__mockFrom
const mockRpc = supabaseMock.__mockRpc

const request = {
	id: 'request-1',
	match_id: 'match-1',
	user_id: 'user-1',
	status: 'pending' as const,
	message: null,
	team_slot: null,
	created_at: '2026-04-20T10:00:00Z',
	updated_at: '2026-04-20T10:00:00Z',
}

beforeEach(() => {
	jest.clearAllMocks()
})

describe('createJoin()', () => {
	// El orden de consultas de create(): participante → solicitud existente → escritura.
	const setupFrom = (participant: unknown, existing: unknown, write = makeBuilder({ data: request })) => {
		const writeBuilder = write
		mockFrom.mockReturnValueOnce(makeBuilder({ data: participant })).mockReturnValueOnce(makeBuilder({ data: existing })).mockReturnValueOnce(writeBuilder)
		return writeBuilder
	}

	it('inserta la solicitud cuando no hay ninguna previa', async () => {
		const write = setupFrom(null, null)

		await requestsService.createJoin('match-1', 'user-1')

		expect(write.insert).toHaveBeenCalledWith({ match_id: 'match-1', user_id: 'user-1', message: null, team_slot: null })
	})

	it('guarda el equipo pedido', async () => {
		const write = setupFrom(null, null)

		await requestsService.createJoin('match-1', 'user-1', 'me sumo', 'B')

		expect(write.insert).toHaveBeenCalledWith({ match_id: 'match-1', user_id: 'user-1', message: 'me sumo', team_slot: 'B' })
	})

	it('no deja pedir entrar si ya sos parte del partido', async () => {
		mockFrom.mockReturnValueOnce(makeBuilder({ data: { id: 'participant-1' } }))

		await expect(requestsService.createJoin('match-1', 'user-1')).rejects.toThrow('Ya sos parte de este partido')
	})

	it('no deja mandar dos solicitudes pendientes', async () => {
		mockFrom.mockReturnValueOnce(makeBuilder({ data: null })).mockReturnValueOnce(makeBuilder({ data: request }))

		await expect(requestsService.createJoin('match-1', 'user-1')).rejects.toThrow('Ya enviaste una solicitud')
	})

	// join_requests tiene UNIQUE(match_id, user_id): volver a pedir entrar es la
	// misma fila volviendo a 'pending', no una nueva.
	it('reusa la fila rechazada al volver a solicitar', async () => {
		const write = setupFrom(null, { ...request, status: 'rejected' })

		await requestsService.createJoin('match-1', 'user-1', undefined, 'A')

		expect(write.insert).not.toHaveBeenCalled()
		expect(write.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending', team_slot: 'A' }))
		expect(write.eq).toHaveBeenCalledWith('id', 'request-1')
	})

	// Quien se fue del partido dejó su solicitud en 'accepted': tiene que poder
	// volver a pedir entrar.
	it('reusa la fila aceptada de alguien que se fue del partido', async () => {
		const write = setupFrom(null, { ...request, status: 'accepted' })

		await requestsService.createJoin('match-1', 'user-1')

		expect(write.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' }))
	})
})

describe('getMine()', () => {
	it('devuelve la solicitud del usuario en el partido', async () => {
		mockFrom.mockReturnValue(makeBuilder({ data: request }))

		expect(await requestsService.getMine('match-1', 'user-1')).toEqual(request)
	})

	it('devuelve null si nunca pidió entrar', async () => {
		mockFrom.mockReturnValue(makeBuilder({ data: null }))

		expect(await requestsService.getMine('match-1', 'user-1')).toBeNull()
	})
})

describe('accept() / reject()', () => {
	it('acepta por RPC', async () => {
		mockRpc.mockResolvedValue({ data: null, error: null })

		await requestsService.accept('request-1')

		expect(mockRpc).toHaveBeenCalledWith('accept_join_request', { request_id: 'request-1' })
	})

	// Por RPC y no por update directo: el servidor valida que siga pendiente y que
	// quien responde sea el creador.
	it('rechaza por RPC', async () => {
		mockRpc.mockResolvedValue({ data: null, error: null })

		await requestsService.reject('request-1')

		expect(mockRpc).toHaveBeenCalledWith('reject_join_request', { request_id: 'request-1' })
	})

	it('propaga el error del servidor al aceptar', async () => {
		mockRpc.mockResolvedValue({ data: null, error: new Error('El partido ya está completo') })

		await expect(requestsService.accept('request-1')).rejects.toThrow('El partido ya está completo')
	})
})
