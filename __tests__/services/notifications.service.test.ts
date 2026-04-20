import { notificationsService } from '@/services/notifications.service'

// ── Supabase query builder factory ───────────────────────────────────────────
function makeBuilder(result: { data?: unknown; error?: unknown; count?: number } = {}) {
  const resolved = {
    data: result.data ?? null,
    error: result.error ?? null,
    count: result.count ?? null,
  }
  const builder: Record<string, jest.Mock> & {
    then: (onFulfilled?: (v: typeof resolved) => unknown) => Promise<unknown>
  } = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
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
  const mockChannel = jest.fn()
  return {
    supabase: {
      from: (...args: unknown[]) => mockFrom(...args),
      channel: (...args: unknown[]) => mockChannel(...args),
    },
    __mockFrom: mockFrom,
    __mockChannel: mockChannel,
  }
})

// eslint-disable-next-line @typescript-eslint/no-require-imports
const supabaseMock = jest.requireMock('@/lib/supabase') as { __mockFrom: jest.Mock; __mockChannel: jest.Mock }
const mockFrom = supabaseMock.__mockFrom
const mockChannel = supabaseMock.__mockChannel

// ── Fixtures ─────────────────────────────────────────────────────────────────
const notificationFixture = {
  id: 'notif-1',
  user_id: 'user-1',
  type: 'new_match' as const,
  title: 'Nuevo partido cerca',
  body: 'Hay un partido de fútbol en tu zona',
  data: { match_id: 'match-1' },
  is_read: false,
  created_at: '2026-04-20T10:00:00Z',
}

// ────────────────────────────────────────────────────────────────────────────

describe('notificationsService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ── list ───────────────────────────────────────────────────────────────────
  describe('list()', () => {
    it('retorna las notificaciones del usuario', async () => {
      mockFrom.mockReturnValue(makeBuilder({ data: [notificationFixture] }))

      const result = await notificationsService.list('user-1')

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('notif-1')
      expect(mockFrom).toHaveBeenCalledWith('notifications')
    })

    it('retorna array vacío cuando no hay notificaciones', async () => {
      mockFrom.mockReturnValue(makeBuilder({ data: [] }))

      const result = await notificationsService.list('user-1')

      expect(result).toEqual([])
    })

    it('lanza error cuando Supabase falla', async () => {
      mockFrom.mockReturnValue(makeBuilder({ data: null, error: new Error('DB error') }))

      await expect(notificationsService.list('user-1')).rejects.toThrow('DB error')
    })
  })

  // ── getUnread ──────────────────────────────────────────────────────────────
  describe('getUnread()', () => {
    it('filtra por is_read=false', async () => {
      const builder = makeBuilder({ data: [notificationFixture] })
      mockFrom.mockReturnValue(builder)

      await notificationsService.getUnread('user-1')

      expect(builder.eq).toHaveBeenCalledWith('is_read', false)
    })
  })

  // ── getUnreadCount ─────────────────────────────────────────────────────────
  describe('getUnreadCount()', () => {
    it('retorna el conteo de notificaciones no leídas', async () => {
      mockFrom.mockReturnValue(makeBuilder({ count: 5 }))

      const count = await notificationsService.getUnreadCount('user-1')

      expect(count).toBe(5)
    })

    it('retorna 0 cuando count es null', async () => {
      mockFrom.mockReturnValue(makeBuilder({ count: undefined }))

      const count = await notificationsService.getUnreadCount('user-1')

      expect(count).toBe(0)
    })

    it('lanza error cuando Supabase falla', async () => {
      mockFrom.mockReturnValue(makeBuilder({ error: new Error('Count failed') }))

      await expect(notificationsService.getUnreadCount('user-1')).rejects.toThrow('Count failed')
    })
  })

  // ── markAsRead ─────────────────────────────────────────────────────────────
  describe('markAsRead()', () => {
    it('actualiza is_read a true para la notificación correcta', async () => {
      const builder = makeBuilder({ error: null })
      mockFrom.mockReturnValue(builder)

      await notificationsService.markAsRead('notif-1')

      expect(builder.update).toHaveBeenCalledWith({ is_read: true })
      expect(builder.eq).toHaveBeenCalledWith('id', 'notif-1')
    })

    it('lanza error cuando Supabase falla', async () => {
      const builder = makeBuilder({})
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(builder as any).then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (r: unknown) => unknown) =>
        Promise.resolve({ data: null, error: new Error('Update failed') }).then(onFulfilled, onRejected)
      mockFrom.mockReturnValue(builder)

      await expect(notificationsService.markAsRead('notif-1')).rejects.toThrow('Update failed')
    })
  })

  // ── markAllAsRead ──────────────────────────────────────────────────────────
  describe('markAllAsRead()', () => {
    it('actualiza todas las notificaciones no leídas del usuario', async () => {
      const builder = makeBuilder({ error: null })
      mockFrom.mockReturnValue(builder)

      await notificationsService.markAllAsRead('user-1')

      expect(builder.update).toHaveBeenCalledWith({ is_read: true })
      expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1')
      expect(builder.eq).toHaveBeenCalledWith('is_read', false)
    })
  })

  // ── create ─────────────────────────────────────────────────────────────────
  describe('create()', () => {
    it('inserta una notificación con los datos correctos', async () => {
      const builder = makeBuilder({ data: notificationFixture })
      mockFrom.mockReturnValue(builder)

      const result = await notificationsService.create(
        'user-1',
        'new_match',
        'Nuevo partido',
        'Descripción del partido',
        { match_id: 'match-1' },
      )

      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          type: 'new_match',
          title: 'Nuevo partido',
          body: 'Descripción del partido',
          is_read: false,
        }),
      )
      expect(result).toEqual(notificationFixture)
    })

    it('usa objeto vacío para data cuando no se proporciona', async () => {
      const builder = makeBuilder({ data: notificationFixture })
      mockFrom.mockReturnValue(builder)

      await notificationsService.create('user-1', 'new_match', 'Título', 'Cuerpo')

      const insertCall = builder.insert.mock.calls[0][0] as Record<string, unknown>
      expect(insertCall.data).toEqual({})
    })
  })

  // ── delete ─────────────────────────────────────────────────────────────────
  describe('delete()', () => {
    it('elimina la notificación con el id correcto', async () => {
      const builder = makeBuilder({ error: null })
      mockFrom.mockReturnValue(builder)

      await notificationsService.delete('notif-1')

      expect(builder.delete).toHaveBeenCalled()
      expect(builder.eq).toHaveBeenCalledWith('id', 'notif-1')
    })
  })

  // ── deleteAll ──────────────────────────────────────────────────────────────
  describe('deleteAll()', () => {
    it('elimina todas las notificaciones del usuario', async () => {
      const builder = makeBuilder({ error: null })
      mockFrom.mockReturnValue(builder)

      await notificationsService.deleteAll('user-1')

      expect(builder.delete).toHaveBeenCalled()
      expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1')
    })
  })

  // ── getByType ──────────────────────────────────────────────────────────────
  describe('getByType()', () => {
    it('filtra notificaciones por tipo', async () => {
      const builder = makeBuilder({ data: [notificationFixture] })
      mockFrom.mockReturnValue(builder)

      await notificationsService.getByType('user-1', 'new_match')

      expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1')
      expect(builder.eq).toHaveBeenCalledWith('type', 'new_match')
    })
  })

  // ── updateSettings ─────────────────────────────────────────────────────────
  describe('updateSettings()', () => {
    it('actualiza las preferencias de notificaciones en profiles', async () => {
      const builder = makeBuilder({ error: null })
      mockFrom.mockReturnValue(builder)

      await notificationsService.updateSettings('user-1', {
        notifications_enabled: false,
        notification_radius: 30,
      })

      expect(mockFrom).toHaveBeenCalledWith('profiles')
      expect(builder.update).toHaveBeenCalledWith({
        notifications_enabled: false,
        notification_radius: 30,
      })
      expect(builder.eq).toHaveBeenCalledWith('id', 'user-1')
    })
  })

  // ── getStats — fallback manual ─────────────────────────────────────────────
  describe('getStats() — fallback calculation', () => {
    it('calcula estadísticas manualmente cuando la vista no existe', async () => {
      const notifications = [
        { type: 'new_match', is_read: false },
        { type: 'new_match', is_read: true },
        { type: 'join_request', is_read: false },
        { type: 'request_accepted', is_read: true },
        { type: 'request_rejected', is_read: false },
      ]

      let callCount = 0
      mockFrom.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // Vista notification_stats — falla (view doesn't exist)
          return makeBuilder({ data: null, error: new Error('Not found') })
        }
        // Fallback — tabla notifications
        return makeBuilder({ data: notifications })
      })

      const stats = await notificationsService.getStats('user-1')

      expect(stats.total_notifications).toBe(5)
      expect(stats.unread_count).toBe(3)
      expect(stats.new_matches).toBe(2)
      expect(stats.join_requests).toBe(1)
      expect(stats.accepted_requests).toBe(1)
      expect(stats.rejected_requests).toBe(1)
    })

    it('retorna todo en cero cuando el fallback tampoco tiene datos', async () => {
      let callCount = 0
      mockFrom.mockImplementation(() => {
        callCount++
        return makeBuilder({ data: callCount === 1 ? null : null, error: new Error('Error') })
      })

      const stats = await notificationsService.getStats('user-1')

      expect(stats.total_notifications).toBe(0)
      expect(stats.unread_count).toBe(0)
    })
  })

  // ── subscribe ──────────────────────────────────────────────────────────────
  describe('subscribe()', () => {
    it('crea un canal con el userId correcto', () => {
      const mockSubscribe = jest.fn().mockReturnValue({ unsubscribe: jest.fn() })
      const mockOn = jest.fn().mockReturnThis()
      mockChannel.mockReturnValue({ on: mockOn, subscribe: mockSubscribe })

      const callback = jest.fn()
      notificationsService.subscribe('user-1', callback)

      expect(mockChannel).toHaveBeenCalledWith('notifications:user-1')
    })
  })
})
