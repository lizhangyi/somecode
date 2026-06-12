import type { ThemeName, ThemeColors } from './types'

export const GRID_SIZE = 30
export const CELL_SIZE = 25
export const BASE_SPEED = 150
export const MIN_SPEED = 50
export const SPEED_DECREMENT = 10
export const SPEED_INCREASE_SCORE = 50
export const PORTAL_PAIRS = 1
export const PORTAL_COOLDOWN = 300
export const BOOST_TICKS = 6
export const BOOST_INTERVAL = 30
export const BOOST_COOLDOWN = 2000
export const BOOST_TRAIL_MAX = 8
export const MAX_HISTORY = 20
export const HISTORY_KEY = 'snake_history'
export const COMBO_WINDOW = 5000
export const COMBO_MAX = 10

export const DIRECTION = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
} as const

export const GAME_STATE = {
  IDLE: 'idle' as const,
  PLAYING: 'playing' as const,
  PAUSED: 'paused' as const,
  GAME_OVER: 'game_over' as const,
} as const

export const THEMES: Record<ThemeName, ThemeColors> = {
  'neon-green': {
    snake: '#00ff88',
    snakeHead: '#00ffaa',
    food: '#ff0080',
    grid: '#1a1a2e',
    background: '#0a0a1a',
    portal: '#9d00ff',
    portalGlow: '#ff00ff',
  },
  'neon-blue': {
    snake: '#00ccff',
    snakeHead: '#00eeff',
    food: '#ff6600',
    grid: '#1a2a3e',
    background: '#0a0f1a',
    portal: '#0066ff',
    portalGlow: '#00aaff',
  },
  'fire-red': {
    snake: '#ff4444',
    snakeHead: '#ff6666',
    food: '#ffaa00',
    grid: '#2e1a1a',
    background: '#1a0a0a',
    portal: '#ff0066',
    portalGlow: '#ff3388',
  },
}

export const THEME_CLASSES: Record<ThemeName, string> = {
  'neon-green': '',
  'neon-blue': 'theme-neon-blue',
  'fire-red': 'theme-fire-red',
}

export function hexToRgba(hex: string, alpha: number): string {
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
