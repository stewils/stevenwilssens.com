// Light/dark theme. The saved choice is applied before first paint by an inline
// script in index.html; without one, the page follows the device setting.

export type Theme = 'light' | 'dark'

const storageKey = 'sw-theme'

export const currentTheme = (): Theme => {
  const chosen = document.documentElement.dataset.theme
  if (chosen === 'light' || chosen === 'dark') return chosen
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const applyTheme = (theme: Theme) => {
  document.documentElement.dataset.theme = theme
  try { localStorage.setItem(storageKey, theme) } catch { /* storage unavailable */ }
}
