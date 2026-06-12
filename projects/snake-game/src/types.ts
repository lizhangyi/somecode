export interface Point { x: number; y: number }

export interface Portal {
  pointA: Point
  pointB: Point
  spiralA: number
  spiralB: number
  pulse: number
}

export type GameState = 'idle' | 'playing' | 'paused' | 'game_over'

export type ThemeName = 'neon-green' | 'neon-blue' | 'fire-red'

export interface ThemeColors {
  snake: string
  snakeHead: string
  food: string
  grid: string
  background: string
  portal: string
  portalGlow: string
}

export interface HistoryEntry {
  score: number
  length: number
  date: string
}
