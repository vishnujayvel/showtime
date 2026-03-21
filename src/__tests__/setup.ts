import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Mock window.clui for all tests (Electron preload API)
const mockClui = {
  notifyActComplete: vi.fn(),
  notifyBeatCheck: vi.fn(),
  notifyVerdict: vi.fn(),
  start: vi.fn().mockResolvedValue({
    version: '0.1.0',
    auth: { email: 'test@test.com', subscriptionType: 'pro' },
    projectPath: '/test',
    homePath: '/home/test',
  }),
  prompt: vi.fn().mockResolvedValue(undefined),
  createTab: vi.fn().mockResolvedValue({ tabId: 'test-tab' }),
  closeTab: vi.fn().mockResolvedValue(undefined),
  isVisible: vi.fn().mockResolvedValue(true),
  respondPermission: vi.fn().mockResolvedValue(undefined),
  setPermissionMode: vi.fn(),
  resetTabSession: vi.fn(),
  loadSession: vi.fn().mockResolvedValue([]),
  fetchMarketplace: vi.fn().mockResolvedValue({ plugins: [], error: null }),
  listInstalledPlugins: vi.fn().mockResolvedValue([]),
  installPlugin: vi.fn().mockResolvedValue({ ok: true }),
  uninstallPlugin: vi.fn().mockResolvedValue({ ok: true }),
}

Object.defineProperty(window, 'clui', {
  value: mockClui,
  writable: true,
})

// Mock localStorage for Zustand persist
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (index: number) => Object.keys(store)[index] ?? null,
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Reset mocks between tests
afterEach(() => {
  vi.clearAllMocks()
  localStorageMock.clear()
})
