import { renderHook, act } from '@testing-library/react-native'
import { useLocation } from '@/hooks/useLocation'

// ── expo-location mock ─────────────────────────────────────────────────────────
const mockGetForegroundPermissions = jest.fn()
const mockRequestForegroundPermissions = jest.fn()
const mockGetCurrentPosition = jest.fn()
const mockReverseGeocode = jest.fn()
const mockGeocode = jest.fn()

jest.mock('expo-location', () => ({
  PermissionStatus: {
    GRANTED: 'granted',
    DENIED: 'denied',
    UNDETERMINED: 'undetermined',
  },
  Accuracy: {
    Balanced: 3,
  },
  getForegroundPermissionsAsync: (...args: unknown[]) =>
    mockGetForegroundPermissions(...args),
  requestForegroundPermissionsAsync: (...args: unknown[]) =>
    mockRequestForegroundPermissions(...args),
  getCurrentPositionAsync: (...args: unknown[]) =>
    mockGetCurrentPosition(...args),
  reverseGeocodeAsync: (...args: unknown[]) =>
    mockReverseGeocode(...args),
  geocodeAsync: (...args: unknown[]) =>
    mockGeocode(...args),
}))

// ────────────────────────────────────────────────────────────────────────────

describe('useLocation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ── Estado inicial ─────────────────────────────────────────────────────────
  describe('estado inicial', () => {
    it('inicia con loading=false y permissionGranted=null', () => {
      const { result } = renderHook(() => useLocation())

      expect(result.current.loading).toBe(false)
      expect(result.current.geocoding).toBe(false)
      expect(result.current.permissionGranted).toBeNull()
    })
  })

  // ── requestPermission ──────────────────────────────────────────────────────
  describe('requestPermission()', () => {
    it('retorna true y actualiza permissionGranted cuando se otorga permiso', async () => {
      mockRequestForegroundPermissions.mockResolvedValue({ status: 'granted' })

      const { result } = renderHook(() => useLocation())

      let granted: boolean
      await act(async () => {
        granted = await result.current.requestPermission()
      })

      expect(granted!).toBe(true)
      expect(result.current.permissionGranted).toBe(true)
    })

    it('retorna false cuando el permiso es denegado', async () => {
      mockRequestForegroundPermissions.mockResolvedValue({ status: 'denied' })

      const { result } = renderHook(() => useLocation())

      let granted: boolean
      await act(async () => {
        granted = await result.current.requestPermission()
      })

      expect(granted!).toBe(false)
      expect(result.current.permissionGranted).toBe(false)
    })
  })

  // ── detect ─────────────────────────────────────────────────────────────────
  describe('detect()', () => {
    it('retorna null cuando el permiso es denegado por el usuario', async () => {
      mockGetForegroundPermissions.mockResolvedValue({ status: 'denied' })
      mockRequestForegroundPermissions.mockResolvedValue({ status: 'denied' })

      const { result } = renderHook(() => useLocation())

      let locationResult: ReturnType<typeof useLocation>['detect'] extends () => Promise<infer T> ? T : never
      await act(async () => {
        locationResult = await result.current.detect()
      })

      expect(locationResult!).toBeNull()
    })

    it('retorna LocationResult cuando el permiso ya está otorgado', async () => {
      mockGetForegroundPermissions.mockResolvedValue({ status: 'granted' })
      mockGetCurrentPosition.mockResolvedValue({
        coords: { latitude: -31.41, longitude: -64.18 },
      })
      mockReverseGeocode.mockResolvedValue([
        { city: 'Córdoba', subregion: null, region: null },
      ])

      const { result } = renderHook(() => useLocation())

      let locationResult: Awaited<ReturnType<typeof result.current.detect>>
      await act(async () => {
        locationResult = await result.current.detect()
      })

      expect(locationResult).not.toBeNull()
      expect(locationResult!.zone).toBe('Córdoba')
      expect(locationResult!.coordinates).toEqual({ x: -64.18, y: -31.41 })
    })

    it('usa subregion cuando city es null', async () => {
      mockGetForegroundPermissions.mockResolvedValue({ status: 'granted' })
      mockGetCurrentPosition.mockResolvedValue({
        coords: { latitude: -31.41, longitude: -64.18 },
      })
      mockReverseGeocode.mockResolvedValue([
        { city: null, subregion: 'Gran Córdoba', region: null },
      ])

      const { result } = renderHook(() => useLocation())

      let locationResult: Awaited<ReturnType<typeof result.current.detect>>
      await act(async () => {
        locationResult = await result.current.detect()
      })

      expect(locationResult!.zone).toBe('Gran Córdoba')
    })

    it('usa region cuando city y subregion son null', async () => {
      mockGetForegroundPermissions.mockResolvedValue({ status: 'granted' })
      mockGetCurrentPosition.mockResolvedValue({
        coords: { latitude: -31.41, longitude: -64.18 },
      })
      mockReverseGeocode.mockResolvedValue([
        { city: null, subregion: null, region: 'Córdoba' },
      ])

      const { result } = renderHook(() => useLocation())

      let locationResult: Awaited<ReturnType<typeof result.current.detect>>
      await act(async () => {
        locationResult = await result.current.detect()
      })

      expect(locationResult!.zone).toBe('Córdoba')
    })

    it('usa fallback de coordenadas cuando no hay nombre disponible', async () => {
      mockGetForegroundPermissions.mockResolvedValue({ status: 'granted' })
      mockGetCurrentPosition.mockResolvedValue({
        coords: { latitude: -31.41234, longitude: -64.18567 },
      })
      mockReverseGeocode.mockResolvedValue([
        { city: null, subregion: null, region: null },
      ])

      const { result } = renderHook(() => useLocation())

      let locationResult: Awaited<ReturnType<typeof result.current.detect>>
      await act(async () => {
        locationResult = await result.current.detect()
      })

      expect(locationResult!.zone).toMatch(/^-?\d+\.\d+, -?\d+\.\d+$/)
    })

    it('pide permiso si aún no fue concedido', async () => {
      mockGetForegroundPermissions.mockResolvedValue({ status: 'undetermined' })
      mockRequestForegroundPermissions.mockResolvedValue({ status: 'granted' })
      mockGetCurrentPosition.mockResolvedValue({
        coords: { latitude: -31.41, longitude: -64.18 },
      })
      mockReverseGeocode.mockResolvedValue([{ city: 'Córdoba', subregion: null, region: null }])

      const { result } = renderHook(() => useLocation())

      await act(async () => {
        await result.current.detect()
      })

      expect(mockRequestForegroundPermissions).toHaveBeenCalledTimes(1)
    })

    it('retorna null ante un error inesperado', async () => {
      mockGetForegroundPermissions.mockRejectedValue(new Error('Location unavailable'))

      const { result } = renderHook(() => useLocation())

      let locationResult: Awaited<ReturnType<typeof result.current.detect>>
      await act(async () => {
        locationResult = await result.current.detect()
      })

      expect(locationResult!).toBeNull()
    })

    it('loading es false al finalizar (tanto en éxito como en error)', async () => {
      mockGetForegroundPermissions.mockResolvedValue({ status: 'denied' })
      mockRequestForegroundPermissions.mockResolvedValue({ status: 'denied' })

      const { result } = renderHook(() => useLocation())

      await act(async () => {
        await result.current.detect()
      })

      expect(result.current.loading).toBe(false)
    })
  })

  // ── geocodeZone ────────────────────────────────────────────────────────────
  describe('geocodeZone()', () => {
    it('retorna null para query vacía', async () => {
      const { result } = renderHook(() => useLocation())

      let coords: Awaited<ReturnType<typeof result.current.geocodeZone>>
      await act(async () => {
        coords = await result.current.geocodeZone('')
      })

      expect(coords!).toBeNull()
      expect(mockGeocode).not.toHaveBeenCalled()
    })

    it('retorna null para query con solo espacios', async () => {
      const { result } = renderHook(() => useLocation())

      let coords: Awaited<ReturnType<typeof result.current.geocodeZone>>
      await act(async () => {
        coords = await result.current.geocodeZone('   ')
      })

      expect(coords!).toBeNull()
    })

    it('retorna null cuando la query tiene menos de 3 caracteres', async () => {
      const { result } = renderHook(() => useLocation())

      let coords: Awaited<ReturnType<typeof result.current.geocodeZone>>
      await act(async () => {
        coords = await result.current.geocodeZone('ab')
      })

      expect(coords!).toBeNull()
      expect(mockGeocode).not.toHaveBeenCalled()
    })

    it('retorna coordenadas cuando la geocodificación es exitosa', async () => {
      mockGeocode.mockResolvedValue([{ longitude: -64.18, latitude: -31.41 }])

      const { result } = renderHook(() => useLocation())

      let coords: Awaited<ReturnType<typeof result.current.geocodeZone>>
      await act(async () => {
        coords = await result.current.geocodeZone('Córdoba')
      })

      expect(coords).toEqual({ x: -64.18, y: -31.41 })
    })

    it('agrega ", Argentina" a la query para mejorar la precisión', async () => {
      mockGeocode.mockResolvedValue([{ longitude: -65.0, latitude: -27.0 }])

      const { result } = renderHook(() => useLocation())

      await act(async () => {
        await result.current.geocodeZone('Morteros')
      })

      expect(mockGeocode).toHaveBeenCalledWith('Morteros, Argentina')
    })

    it('retorna null cuando la geocodificación no encuentra resultados', async () => {
      mockGeocode.mockResolvedValue([])

      const { result } = renderHook(() => useLocation())

      let coords: Awaited<ReturnType<typeof result.current.geocodeZone>>
      await act(async () => {
        coords = await result.current.geocodeZone('LugarInexistente')
      })

      expect(coords!).toBeNull()
    })

    it('retorna null ante un error del servicio de geocodificación', async () => {
      mockGeocode.mockRejectedValue(new Error('Geocoding failed'))

      const { result } = renderHook(() => useLocation())

      let coords: Awaited<ReturnType<typeof result.current.geocodeZone>>
      await act(async () => {
        coords = await result.current.geocodeZone('Córdoba')
      })

      expect(coords!).toBeNull()
    })

    it('geocoding es false al finalizar', async () => {
      mockGeocode.mockResolvedValue([{ longitude: -64.18, latitude: -31.41 }])

      const { result } = renderHook(() => useLocation())

      await act(async () => {
        await result.current.geocodeZone('Córdoba')
      })

      expect(result.current.geocoding).toBe(false)
    })
  })
})
