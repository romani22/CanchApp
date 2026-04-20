// Global test setup — runs before every test file

// ── AsyncStorage mock ────────────────────────────────────────────────────────
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
  getAllKeys: jest.fn().mockResolvedValue([]),
  multiGet: jest.fn().mockResolvedValue([]),
  multiSet: jest.fn().mockResolvedValue(undefined),
  multiRemove: jest.fn().mockResolvedValue(undefined),
}))

// ── expo-secure-store mock ───────────────────────────────────────────────────
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}))

// ── expo-router mock ─────────────────────────────────────────────────────────
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
  })),
  useLocalSearchParams: jest.fn(() => ({})),
  useSegments: jest.fn(() => []),
  usePathname: jest.fn(() => '/'),
  Link: 'Link',
  Redirect: 'Redirect',
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  },
}))

// ── expo-notifications mock ──────────────────────────────────────────────────
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[test]' }),
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  addNotificationResponseReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('notification-id'),
  cancelAllScheduledNotificationsAsync: jest.fn().mockResolvedValue(undefined),
}))

// ── expo-device mock ─────────────────────────────────────────────────────────
jest.mock('expo-device', () => ({
  isDevice: true,
  osName: 'iOS',
}))

// ── expo-constants mock ──────────────────────────────────────────────────────
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      eas: { projectId: 'test-project-id' },
    },
  },
}))

// ── react-native-url-polyfill mock ───────────────────────────────────────────
jest.mock('react-native-url-polyfill/auto', () => {})

// ── Silence console.error in tests (keep console.warn) ──────────────────────
const originalError = console.error
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : ''

    // React 18/19: act() warning (con y sin prefijo "Warning:")
    if (
      msg.includes('Warning: An update to') ||
      msg.includes('inside a test was not wrapped in act') ||
      msg.includes('Warning: ReactDOM.render') ||
      // Mensajes de error esperados al testear caminos de error en servicios/hooks
      // (provienen de los console.error en los catch blocks del código de producción)
      msg.includes('Error fetching matches:') ||
      msg.includes('Error refreshing notification count:') ||
      msg.includes('Error fetching notification count:') ||
      msg.includes('Error checking if can add players:') ||
      msg.includes('Error getting match players stats:') ||
      msg.includes('Error fetching match players:') ||
      msg.includes('Error removing player:') ||
      msg.includes('Error adding player:') ||
      msg.includes('Error updating player team:') ||
      msg.includes('[useLocation] detect error:') ||
      msg.includes('[useLocation] geocodeZone error:')
    ) {
      return
    }
    originalError(...args)
  }
})

afterAll(() => {
  console.error = originalError
})
