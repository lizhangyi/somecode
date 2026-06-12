import type { Point, Portal, GameState } from './types'
import { GRID_SIZE, CELL_SIZE, BASE_SPEED, DIRECTION } from './config'

export const snake: Point[] = []
export const food: Point = { x: 0, y: 0 }
export let direction: Point = { ...DIRECTION.RIGHT }
export let nextDirection: Point = { ...DIRECTION.RIGHT }
export let gameState: GameState = 'idle'
export let score = 0
export let highScore = 0
export let gameLoop: ReturnType<typeof setInterval> | null = null
export let currentSpeed = BASE_SPEED
export let lastSpeedIncreaseScore = 0
export let foodPulse = 0
export const portals: Portal[] = []
export let portalTimer = 0
export let canvas!: HTMLCanvasElement
export let ctx!: CanvasRenderingContext2D
export let scoreEl!: HTMLElement
export let highScoreEl!: HTMLElement
export let themeButtons!: NodeListOf<Element>
export let musicButtons!: NodeListOf<Element>
export let boosting = false
export let boostTicks = 0
export let boostCooldownEnd = 0
export const boostTrail: Point[] = []
export let comboCount = 0
export let comboExpire = 0
export const comboPopups: { x: number; y: number; text: string; alpha: number; vy: number }[] = []

export function setDirection(d: Point) { direction = d }
export function setNextDirection(d: Point) { nextDirection = d }
export function setGameState(s: GameState) { gameState = s }
export function setScore(s: number) { score = s }
export function setHighScore(s: number) { highScore = s }
export function setGameLoop(loop: ReturnType<typeof setInterval> | null) { gameLoop = loop }
export function setCurrentSpeed(s: number) { currentSpeed = s }
export function setLastSpeedIncreaseScore(s: number) { lastSpeedIncreaseScore = s }
export function setFoodPulse(p: number) { foodPulse = p }
export function setPortalTimer(t: number) { portalTimer = t }
export function setBoosting(b: boolean) { boosting = b }
export function setBoostTicks(t: number) { boostTicks = t }
export function setBoostCooldownEnd(t: number) { boostCooldownEnd = t }
export function setComboCount(c: number) { comboCount = c }
export function setComboExpire(t: number) { comboExpire = t }

export function initDOM() {
  canvas = document.getElementById('gameCanvas') as HTMLCanvasElement
  ctx = canvas.getContext('2d')!
  canvas.width = GRID_SIZE * CELL_SIZE
  canvas.height = GRID_SIZE * CELL_SIZE
  scoreEl = document.getElementById('score')!
  highScoreEl = document.getElementById('highScore')!
  themeButtons = document.querySelectorAll('.theme-btn')
  musicButtons = document.querySelectorAll('.music-btn')
  highScore = Number(localStorage.getItem('snake_high_score')) || 0
  highScoreEl.textContent = String(highScore)
}
