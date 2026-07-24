import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
type AppliedTheme = 'light' | 'dark'

const STORAGE_KEY = 'indi-qr-theme'
const THEME_COLOR: Record<AppliedTheme, string> = { dark: '#0a0e18', light: '#f3f4f6' }

function systemPrefersLight() {
  return window.matchMedia('(prefers-color-scheme: light)').matches
}

function resolveApplied(preference: ThemePreference): AppliedTheme {
  return preference === 'system' ? (systemPrefersLight() ? 'light' : 'dark') : preference
}

function getInitialPreference(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

interface ThemeContextValue {
  preference: ThemePreference
  theme: AppliedTheme
  setPreference: (preference: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  preference: 'system',
  theme: 'dark',
  setPreference: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(getInitialPreference)
  const [theme, setTheme] = useState<AppliedTheme>(() => resolveApplied(preference))

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, preference)
    setTheme(resolveApplied(preference))

    if (preference !== 'system') return

    // Con preferencia "Sistema" el tema aplicado sigue el sistema operativo
    // en vivo — si el usuario cambia su modo oscuro/claro del sistema sin
    // recargar la app, esto lo refleja al instante.
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)')
    const onSystemChange = () => setTheme(resolveApplied('system'))
    mediaQuery.addEventListener('change', onSystemChange)
    return () => mediaQuery.removeEventListener('change', onSystemChange)
  }, [preference])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
  }, [theme])

  return <ThemeContext.Provider value={{ preference, theme, setPreference }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
