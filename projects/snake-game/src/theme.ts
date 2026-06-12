import type { ThemeName } from './types'
import { THEMES, THEME_CLASSES } from './config'

export let currentTheme: ThemeName = 'neon-green'

export function applyTheme(themeName: ThemeName) {
  currentTheme = themeName
  document.body.classList.remove('theme-neon-blue', 'theme-fire-red')
  if (THEME_CLASSES[themeName]) {
    document.body.classList.add(THEME_CLASSES[themeName])
  }
  localStorage.setItem('snake_theme', themeName)
}

export function loadTheme() {
  const saved = (localStorage.getItem('snake_theme') || 'neon-green') as ThemeName
  applyTheme(saved)
}

export function getThemeColors() {
  return THEMES[currentTheme]
}
