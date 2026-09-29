// Light/dark theme. The saved choice is applied before first paint by an inline
// script in index.html; without one, the site uses the dark theme.

export type Theme = 'light' | 'dark'

const storageKey = 'sw-theme'
const listeners = new Set<() => void>()

export const currentTheme = (): Theme => {
  const chosen = document.documentElement.dataset.theme
  if (chosen === 'light' || chosen === 'dark') return chosen
  return 'dark'
}

// Prerendered HTML is built in dark; the browser switches to the saved theme right after hydrating.
export const serverTheme = (): Theme => 'dark'

export const subscribeTheme = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export const applyTheme = (theme: Theme) => {
  document.documentElement.dataset.theme = theme
  try { localStorage.setItem(storageKey, theme) } catch { /* storage unavailable */ }
  listeners.forEach((listener) => listener())
}
