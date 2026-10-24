import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'system' | 'light' | 'dark'

interface ThemeState {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  cycle: () => void
}

const ORDER: ThemeMode[] = ['system', 'light', 'dark']

const darkQuery = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement
  const isDark = mode === 'dark' || (mode === 'system' && !!darkQuery?.matches)
  root.classList.toggle('dark', isDark)
  root.classList.toggle('light', !isDark)
  root.dataset.theme = isDark ? 'dark' : 'light'
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', isDark ? '#0F1312' : '#F6F7F5')
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      setMode: (mode) => {
        applyTheme(mode)
        set({ mode })
      },
      cycle: () => {
        const next = ORDER[(ORDER.indexOf(get().mode) + 1) % ORDER.length]
        applyTheme(next)
        set({ mode: next })
      },
    }),
    {
      name: 'flowin-theme',
      onRehydrateStorage: () => (state) => applyTheme(state?.mode ?? 'system'),
    },
  ),
)

darkQuery?.addEventListener('change', () => {
  if (useThemeStore.getState().mode === 'system') applyTheme('system')
})
