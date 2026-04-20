import React from 'react'
import { renderHook, act } from '@testing-library/react-native'
import { AuthProvider, useAuth } from '@/context/AuthContext'

// ── Service mocks — definidos dentro de la factory para evitar problemas de hoisting ──
jest.mock('@/services/auth.service', () => ({
  authService: {
    getSession: jest.fn(),
    signIn: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    resetPassword: jest.fn(),
    onAuthStateChange: jest.fn(),
  },
}))

jest.mock('@/services/profiles.service', () => ({
  profilesService: {
    getById: jest.fn(),
    updateProfile: jest.fn(),
    getUserStats: jest.fn(),
  },
}))

jest.mock('@/services/pushnotifications.service', () => ({
  pushNotificationService: {
    registerForPushNotifications: jest.fn().mockResolvedValue(null),
    savePushToken: jest.fn().mockResolvedValue(undefined),
    removePushToken: jest.fn().mockResolvedValue(undefined),
  },
}))

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
  },
}))

// Accedemos a los mocks via requireMock para poder configurarlos en cada test
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockAuthService = (jest.requireMock('@/services/auth.service') as { authService: Record<string, jest.Mock> }).authService
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockProfilesService = (jest.requireMock('@/services/profiles.service') as { profilesService: Record<string, jest.Mock> }).profilesService
// (pushNotificationService está mockeado pero no necesitamos configurarlo en estos tests)

// ── Fixtures ──────────────────────────────────────────────────────────────────
const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00Z',
}

const mockSession = {
  user: mockUser,
  access_token: 'token-abc',
  refresh_token: 'refresh-abc',
  expires_in: 3600,
  token_type: 'bearer',
}

const mockProfile = {
  id: 'user-1',
  full_name: 'Test User',
  email: 'test@example.com',
  avatar_url: null,
  zone: 'Córdoba',
  zone_coordinates: null,
  favorite_sports: ['futbol'],
  skill_level: 'intermedio',
  rating: 4.0,
  elo_rating: 1200,
  notifications_enabled: true,
  notification_radius: 20,
  created_at: '2026-01-01T00:00:00Z',
}

const mockStats = {
  user_id: 'user-1',
  total_matches: 10,
  total_wins: 6,
  elo_rating: 1200,
  rating: 4.0,
  rating_count: 8,
}

// ────────────────────────────────────────────────────────────────────────────

describe('AuthContext', () => {
  const unsubscribeMock = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockAuthService.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: unsubscribeMock } },
    })
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  )

  // ── useAuth fuera del provider ────────────────────────────────────────────
  describe('useAuth() fuera del provider', () => {
    it('lanza error cuando se usa fuera de AuthProvider', () => {
      // Suprimir el error de React en la consola durante este test
      jest.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => renderHook(() => useAuth())).toThrow(
        'useAuth must be used within an AuthProvider',
      )

      jest.restoreAllMocks()
    })
  })

  // ── Estado inicial ─────────────────────────────────────────────────────────
  describe('estado inicial', () => {
    it('inicia con isLoading=true', async () => {
      // getSession nunca resuelve (cuelga) → isLoading permanece true
      mockAuthService.getSession.mockReturnValue(new Promise(() => {}))

      const { result } = renderHook(() => useAuth(), { wrapper })

      expect(result.current.isLoading).toBe(true)
    })

    it('inicia sin usuario autenticado cuando no hay sesión', async () => {
      mockAuthService.getSession.mockResolvedValue({ data: { session: null } })

      const { result } = renderHook(() => useAuth(), { wrapper })

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
      expect(result.current.session).toBeNull()
      expect(result.current.profile).toBeNull()
      expect(result.current.isLoading).toBe(false)
    })

    it('carga el perfil cuando hay sesión activa', async () => {
      mockAuthService.getSession.mockResolvedValue({ data: { session: mockSession } })
      mockProfilesService.getById.mockResolvedValue(mockProfile)
      mockProfilesService.getUserStats.mockResolvedValue(mockStats)

      const { result } = renderHook(() => useAuth(), { wrapper })

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.user?.id).toBe('user-1')
      expect(result.current.profile?.full_name).toBe('Test User')
    })
  })

  // ── isAuthenticated ────────────────────────────────────────────────────────
  describe('isAuthenticated', () => {
    it('es false cuando user es null', async () => {
      mockAuthService.getSession.mockResolvedValue({ data: { session: null } })

      const { result } = renderHook(() => useAuth(), { wrapper })

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      expect(result.current.isAuthenticated).toBe(false)
    })

    it('es true cuando user no es null', async () => {
      mockAuthService.getSession.mockResolvedValue({ data: { session: mockSession } })
      mockProfilesService.getById.mockResolvedValue(mockProfile)
      mockProfilesService.getUserStats.mockResolvedValue(mockStats)

      const { result } = renderHook(() => useAuth(), { wrapper })

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      expect(result.current.isAuthenticated).toBe(true)
    })
  })

  // ── updateProfile ──────────────────────────────────────────────────────────
  describe('updateProfile()', () => {
    it('retorna error cuando no hay usuario logueado', async () => {
      mockAuthService.getSession.mockResolvedValue({ data: { session: null } })

      const { result } = renderHook(() => useAuth(), { wrapper })

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      const { error } = await result.current.updateProfile({ full_name: 'Nuevo' })

      expect(error?.message).toBe('No user logged in')
    })

    it('llama a profilesService.updateProfile y refresca el perfil', async () => {
      mockAuthService.getSession.mockResolvedValue({ data: { session: mockSession } })
      mockProfilesService.getById.mockResolvedValue(mockProfile)
      mockProfilesService.getUserStats.mockResolvedValue(mockStats)
      mockProfilesService.updateProfile.mockResolvedValue({
        ...mockProfile,
        full_name: 'Nombre Actualizado',
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      await act(async () => {
        await result.current.updateProfile({ full_name: 'Nombre Actualizado' })
      })

      expect(mockProfilesService.updateProfile).toHaveBeenCalledWith(
        'user-1',
        { full_name: 'Nombre Actualizado' },
      )
    })

    it('retorna el error cuando profilesService lanza excepción', async () => {
      mockAuthService.getSession.mockResolvedValue({ data: { session: mockSession } })
      mockProfilesService.getById.mockResolvedValue(mockProfile)
      mockProfilesService.getUserStats.mockResolvedValue(mockStats)
      mockProfilesService.updateProfile.mockRejectedValue(new Error('Update failed'))

      const { result } = renderHook(() => useAuth(), { wrapper })

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      let updateResult: { error: Error | null }
      await act(async () => {
        updateResult = await result.current.updateProfile({ full_name: 'Test' })
      })

      expect(updateResult!.error?.message).toBe('Update failed')
    })
  })

  // ── signIn / signOut expuestos ─────────────────────────────────────────────
  describe('signIn y signOut expuestos', () => {
    it('expone signIn del authService', async () => {
      mockAuthService.getSession.mockResolvedValue({ data: { session: null } })

      const { result } = renderHook(() => useAuth(), { wrapper })

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      expect(result.current.signIn).toBe(mockAuthService.signIn)
    })

    it('expone signOut del authService', async () => {
      mockAuthService.getSession.mockResolvedValue({ data: { session: null } })

      const { result } = renderHook(() => useAuth(), { wrapper })

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      expect(result.current.signOut).toBe(mockAuthService.signOut)
    })
  })

  // ── Limpieza de suscripción ────────────────────────────────────────────────
  describe('limpieza de suscripción', () => {
    it('llama a unsubscribe al desmontar el provider', async () => {
      mockAuthService.getSession.mockResolvedValue({ data: { session: null } })

      const { unmount } = renderHook(() => useAuth(), { wrapper })

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      unmount()

      expect(unsubscribeMock).toHaveBeenCalled()
    })
  })
})
