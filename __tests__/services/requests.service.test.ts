import { requestsService } from '@/services/requests.service'

// ── Supabase query builder factory ───────────────────────────────────────────
function makeBuilder(result: { data?: unknown; error?: unknown } = {}) {
	const resolved = { data: result.data ?? null, error: result.error ?? null }
	const builder = {
		select: jest.fn().mockReturnThis(),
		eq: jest.fn().mockReturnThis(),
		not: jest.fn().mockReturnThis(),
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

// ── Invitaciones (027) ───────────────────────────────────────────────────────
const invitation = {
	...request,
	id: 'request-2',
	user_id: 'user-2',
	invited_by: 'user-1',
	user: { id: 'user-2', full_name: 'Ana', avatar_url: null },
}

describe('getInvitations()', () => {
	it('trae las invitaciones del partido en cualquier estado', async () => {
		const builder = makeBuilder({ data: [invitation] })
		mockFrom.mockReturnValue(builder)

		expect(await requestsService.getInvitations('match-1')).toEqual([invitation])
		// Sin filtro de status: una invitación rechazada tiene que seguir viéndose,
		// porque enterarse de que alguien no va es lo que el creador necesita para
		// buscar reemplazo.
		expect(builder.eq).toHaveBeenCalledWith('match_id', 'match-1')
		expect(builder.eq).not.toHaveBeenCalledWith('status', expect.anything())
		// Sólo invitaciones, no solicitudes: las distingue invited_by.
		expect(builder.not).toHaveBeenCalledWith('invited_by', 'is', null)
	})

	it('pide el perfil por la FK explícita, y sólo las columnas que se muestran', async () => {
		// Las dos mitades de esta aserción son bugs distintos que ya pasaron.
		//
		// La FK: desde la 027 join_requests tiene DOS claves foráneas a profiles
		// (user_id e invited_by). Sin la pista, PostgREST no elige y devuelve
		// 300 Multiple Choices — y como la pantalla envuelve la llamada en un catch,
		// se veía igual que un partido sin invitaciones.
		//
		// Las columnas: profiles(*) arrastra mail, teléfono y coordenadas para pintar
		// un nombre y un avatar.
		const builder = makeBuilder({ data: [] })
		mockFrom.mockReturnValue(builder)

		await requestsService.getInvitations('match-1')

		const select = builder.select.mock.calls[0][0] as string
		expect(select).toContain('profiles!join_requests_user_id_fkey')
		expect(select).not.toContain('profiles(*)')
	})

	it('propaga el error en vez de devolver una lista vacía', async () => {
		// Que decida la pantalla: una lista vacía y una consulta rota no son lo mismo.
		mockFrom.mockReturnValue(makeBuilder({ error: new Error('PGRST201') }))

		await expect(requestsService.getInvitations('match-1')).rejects.toThrow('PGRST201')
	})
})

describe('acceptInvitation() / rejectInvitation()', () => {
	// Por RPC y no por update: el consentimiento del invitado es la mitad que hace
	// segura a la invitación, y el servidor valida que quien responde sea él.
	it('acepta la invitación por RPC', async () => {
		mockRpc.mockResolvedValue({ data: null, error: null })

		await requestsService.acceptInvitation('request-2')

		expect(mockRpc).toHaveBeenCalledWith('accept_match_invitation', { request_id: 'request-2' })
	})

	it('rechaza la invitación por RPC', async () => {
		mockRpc.mockResolvedValue({ data: null, error: null })

		await requestsService.rejectInvitation('request-2')

		expect(mockRpc).toHaveBeenCalledWith('reject_match_invitation', { request_id: 'request-2' })
	})

	it('propaga el error del servidor al aceptar una invitación', async () => {
		mockRpc.mockResolvedValue({ data: null, error: new Error('El partido ya está completo') })

		await expect(requestsService.acceptInvitation('request-2')).rejects.toThrow('El partido ya está completo')
	})
})

describe('cancel()', () => {
	it('da de baja la invitación', async () => {
		const builder = makeBuilder({ data: [{ id: 'request-2' }] })
		mockFrom.mockReturnValue(builder)

		await requestsService.cancel('request-2')

		expect(builder.delete).toHaveBeenCalled()
		expect(builder.eq).toHaveBeenCalledWith('id', 'request-2')
	})

	it('avisa si el DELETE no borró nada', async () => {
		// La policy de la 027 sólo deja borrar las invitaciones propias. RLS no falla:
		// filtra, y el DELETE vuelve con cero filas. Sin este chequeo la pantalla
		// mostraría un éxito y la fila seguiría ahí.
		mockFrom.mockReturnValue(makeBuilder({ data: [] }))

		await expect(requestsService.cancel('request-2')).rejects.toThrow('No se pudo dar de baja')
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
