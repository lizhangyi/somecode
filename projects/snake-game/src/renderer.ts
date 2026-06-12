import {
  snake, food, direction, foodPulse, portals, boosting, boostTrail,
  canvas, ctx, gameState, score, highScore, setFoodPulse,
  comboCount, comboExpire, comboPopups,
} from './state'
import { getThemeColors } from './theme'
import { GRID_SIZE, CELL_SIZE, hexToRgba, COMBO_WINDOW } from './config'

function theme() {
  return getThemeColors()
}

export function drawGrid() {
  const c = ctx
  c.strokeStyle = theme().grid
  c.lineWidth = 0.5
  for (let i = 0; i <= GRID_SIZE; i++) {
    const pos = i * CELL_SIZE
    c.beginPath(); c.moveTo(pos, 0); c.lineTo(pos, canvas.height); c.stroke()
    c.beginPath(); c.moveTo(0, pos); c.lineTo(canvas.width, pos); c.stroke()
  }
}

function drawSpiral(x: number, y: number, spiralAngle: number, radius: number) {
  const c = ctx
  const lines = 3
  const turns = 2
  for (let i = 0; i < lines; i++) {
    const lineAngle = (i / lines) * Math.PI * 2 + spiralAngle
    c.strokeStyle = `rgba(255, 0, 128, ${0.4 + (i / lines) * 0.2})`
    c.lineWidth = 2
    c.beginPath()
    for (let t = 0; t < turns * Math.PI * 2; t += 0.1) {
      const currentAngle = lineAngle + t
      const r = (t / (turns * Math.PI * 2)) * radius
      const px = x + Math.cos(currentAngle) * r
      const py = y + Math.sin(currentAngle) * r
      if (t === 0) c.moveTo(px, py)
      else c.lineTo(px, py)
    }
    c.stroke()
  }
}

function drawPortalPoint(pos: { x: number; y: number }, pulse: number, spiral: number) {
  const c = ctx
  const x = pos.x * CELL_SIZE + CELL_SIZE / 2
  const y = pos.y * CELL_SIZE + CELL_SIZE / 2
  const baseRadius = CELL_SIZE / 2 - 4
  const pulseRadius = baseRadius + Math.sin(pulse) * 2

  c.shadowColor = theme().portalGlow
  c.shadowBlur = 15 + Math.sin(pulse) * 8
  drawSpiral(x, y, spiral, pulseRadius)

  c.strokeStyle = theme().portal
  c.lineWidth = 2
  c.beginPath(); c.arc(x, y, pulseRadius + 3, 0, Math.PI * 2); c.stroke()

  c.fillStyle = 'rgba(157, 0, 255, 0.6)'
  c.beginPath(); c.arc(x, y, pulseRadius, 0, Math.PI * 2); c.fill()
  c.shadowBlur = 0
}

function drawPortalConnection(a: { x: number; y: number }, b: { x: number; y: number }) {
  const c = ctx
  const x1 = a.x * CELL_SIZE + CELL_SIZE / 2
  const y1 = a.y * CELL_SIZE + CELL_SIZE / 2
  const x2 = b.x * CELL_SIZE + CELL_SIZE / 2
  const y2 = b.y * CELL_SIZE + CELL_SIZE / 2
  c.shadowColor = theme().portal
  c.shadowBlur = 5
  c.strokeStyle = 'rgba(157, 0, 255, 0.3)'
  c.lineWidth = 1
  c.setLineDash([5, 5])
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke()
  c.setLineDash([])
  c.shadowBlur = 0
}

export function drawPortals() {
  portals.forEach(p => {
    drawPortalPoint(p.pointA, p.pulse, p.spiralA)
    drawPortalPoint(p.pointB, p.pulse + Math.PI * 0.5, p.spiralB)
    drawPortalConnection(p.pointA, p.pointB)
  })
}

export function drawFood() {
  const c = ctx
  const x = food.x * CELL_SIZE + CELL_SIZE / 2
  const y = food.y * CELL_SIZE + CELL_SIZE / 2
  const baseRadius = CELL_SIZE / 2 - 2
  const pulseRadius = baseRadius + Math.sin(foodPulse) * 2
  c.shadowColor = theme().food
  c.shadowBlur = 15 + Math.sin(foodPulse) * 5
  c.fillStyle = theme().food
  c.beginPath(); c.arc(x, y, pulseRadius, 0, Math.PI * 2); c.fill()
  c.shadowBlur = 0
}

export function drawSnake() {
  if (snake.length < 1) return
  const cs = CELL_SIZE
  const maxR = cs / 2 - 2
  const minR = cs / 4
  const t = theme()

  // Boost trail
  if (boosting && boostTrail.length > 0) {
    for (let i = 0; i < boostTrail.length; i++) {
      const t2 = i / boostTrail.length
      const pos = boostTrail[i]
      const tx = pos.x * cs + cs / 2
      const ty = pos.y * cs + cs / 2
      const tr = maxR * t2 * 0.5
      ctx.fillStyle = hexToRgba(t.snake, t2 * 0.25)
      ctx.beginPath(); ctx.arc(tx, ty, tr, 0, Math.PI * 2); ctx.fill()
    }
  }

  // Body connections
  ctx.shadowColor = t.snake
  ctx.shadowBlur = 8
  for (let i = 0; i < snake.length - 1; i++) {
    const t2 = i / Math.max(snake.length - 1, 1)
    const r = minR + (1 - t2) * (maxR - minR)
    const alpha = 0.5 + (1 - t2) * 0.5
    const a = snake[i]
    const b = snake[i + 1]
    if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) > 1) continue
    const ax = a.x * cs + cs / 2
    const ay = a.y * cs + cs / 2
    const bx = b.x * cs + cs / 2
    const by = b.y * cs + cs / 2
    ctx.fillStyle = hexToRgba(t.snake, alpha)
    if (ax === bx) {
      ctx.fillRect(ax - r, Math.min(ay, by), r * 2, Math.abs(ay - by))
    } else {
      ctx.fillRect(Math.min(ax, bx), ay - r, Math.abs(ax - bx), r * 2)
    }
  }

  // Body nodes (tail to head for overlap)
  for (let i = snake.length - 1; i >= 0; i--) {
    const t2 = i / Math.max(snake.length - 1, 1)
    const r = minR + (1 - t2) * (maxR - minR)
    const alpha = 0.5 + (1 - t2) * 0.5
    const seg = snake[i]
    const cx = seg.x * cs + cs / 2
    const cy = seg.y * cs + cs / 2
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
    if (i === 0) {
      ctx.fillStyle = t.snakeHead
      ctx.shadowBlur = boosting ? 25 : 15
    } else {
      ctx.fillStyle = hexToRgba(t.snake, alpha)
      ctx.shadowBlur = boosting ? 15 : 8
    }
    ctx.fill()
  }
  ctx.shadowBlur = 0

  // Head details (eyes + tongue)
  const head = snake[0]
  const hx = head.x * cs + cs / 2
  const hy = head.y * cs + cs / 2
  const d = direction
  const eyeDist = 4
  const eyeR = 3

  let eyes: { x: number; y: number }[] = []
  if (d.x === 1) eyes = [{ x: hx + 3, y: hy - eyeDist }, { x: hx + 3, y: hy + eyeDist }]
  else if (d.x === -1) eyes = [{ x: hx - 3, y: hy - eyeDist }, { x: hx - 3, y: hy + eyeDist }]
  else if (d.y === -1) eyes = [{ x: hx - eyeDist, y: hy - 3 }, { x: hx + eyeDist, y: hy - 3 }]
  else eyes = [{ x: hx - eyeDist, y: hy + 3 }, { x: hx + eyeDist, y: hy + 3 }]

  eyes.forEach(e => {
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.arc(e.x, e.y, eyeR, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#111'
    ctx.beginPath(); ctx.arc(e.x + d.x * 1, e.y + d.y * 1, eyeR * 0.5, 0, Math.PI * 2); ctx.fill()
  })

  // Forked tongue
  const tongueLen = 8
  const tb = { x: hx + d.x * (maxR - 1), y: hy + d.y * (maxR - 1) }
  const tt = { x: tb.x + d.x * tongueLen, y: tb.y + d.y * tongueLen }
  const wiggle = Math.sin(Date.now() / 80) * 2
  const fork = 3
  ctx.strokeStyle = t.food
  ctx.lineWidth = 1.5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(tb.x, tb.y)
  ctx.lineTo(tt.x + d.y * wiggle - d.y * fork, tt.y + d.x * wiggle - d.x * fork)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(tb.x, tb.y)
  ctx.lineTo(tt.x + d.y * wiggle + d.y * fork, tt.y + d.x * wiggle + d.x * fork)
  ctx.stroke()
}

export function drawPauseOverlay() {
  const c = ctx
  c.fillStyle = 'rgba(0, 0, 0, 0.5)'
  c.fillRect(0, 0, canvas.width, canvas.height)
  c.textAlign = 'center'
  c.fillStyle = theme().snake
  c.font = '24px "Press Start 2P"'
  c.shadowColor = theme().snake
  c.shadowBlur = 30
  c.fillText('PAUSED', canvas.width / 2, canvas.height / 2 - 20)
  c.font = '10px "Press Start 2P"'
  c.fillStyle = 'rgba(255, 255, 255, 0.8)'
  c.shadowBlur = 10
  c.fillText('按空格键继续', canvas.width / 2, canvas.height / 2 + 30)
  c.shadowBlur = 0
}

export function renderStartScreen() {
  const c = ctx
  c.fillStyle = theme().background
  c.fillRect(0, 0, canvas.width, canvas.height)
  drawGrid()
  c.fillStyle = theme().snake
  c.font = '14px "Press Start 2P"'
  c.textAlign = 'center'
  c.shadowColor = theme().snake
  c.shadowBlur = 20
  c.fillText('按空格键开始', canvas.width / 2, canvas.height / 2)
  c.font = '10px "Press Start 2P"'
  c.fillStyle = theme().food
  c.shadowColor = theme().food
  c.fillText('SNAKE GAME', canvas.width / 2, canvas.height / 2 - 50)
  c.shadowBlur = 0
}

function drawComboPopups() {
  const c = ctx
  for (let i = comboPopups.length - 1; i >= 0; i--) {
    const p = comboPopups[i]
    p.y += p.vy
    p.alpha -= 0.018
    if (p.alpha <= 0) {
      comboPopups.splice(i, 1)
      continue
    }
    const x = (p.x + 0.5) * CELL_SIZE
    const y = (p.y + 0.5) * CELL_SIZE
    c.save()
    c.globalAlpha = p.alpha
    c.fillStyle = '#ffff00'
    c.font = 'bold 16px "Press Start 2P"'
    c.textAlign = 'center'
    c.shadowColor = '#ffff00'
    c.shadowBlur = 12
    c.fillText(p.text, x, y)
    c.shadowBlur = 0
    c.restore()
  }
}

function drawComboCounter() {
  if (comboCount <= 0) return
  const c = ctx
  const now = Date.now()
  const remaining = Math.max(0, comboExpire - now)
  const ratio = remaining / COMBO_WINDOW
  const x = 10
  const y = 10

  c.save()
  c.fillStyle = '#ffff00'
  c.font = '12px "Press Start 2P"'
  c.textAlign = 'left'
  c.shadowColor = '#ffff00'
  c.shadowBlur = 8
  c.fillText(`COMBO x${comboCount + 1}`, x, y + 12)
  c.shadowBlur = 0

  c.fillStyle = 'rgba(255, 255, 255, 0.2)'
  c.fillRect(x, y + 18, 100, 4)
  c.fillStyle = '#ffff00'
  c.fillRect(x, y + 18, 100 * ratio, 4)
  c.restore()
}

export function renderGameFrame() {
  if (gameState !== 'playing' && gameState !== 'paused') return
  const c = ctx
  c.fillStyle = theme().background
  c.fillRect(0, 0, canvas.width, canvas.height)
  drawGrid()
  drawPortals()
  drawFood()
  drawSnake()
  drawComboPopups()
  drawComboCounter()
  if (gameState === 'paused') drawPauseOverlay()
  setFoodPulse(foodPulse + 0.1)
  portals.forEach(p => {
    p.pulse += 0.08
    p.spiralA += 0.15
    p.spiralB += 0.15
  })
  requestAnimationFrame(renderGameFrame)
}

export function renderGameOver() {
  const c = ctx
  c.fillStyle = theme().background
  c.fillRect(0, 0, canvas.width, canvas.height)
  drawGrid()
  c.textAlign = 'center'
  c.fillStyle = theme().food
  c.font = '16px "Press Start 2P"'
  c.shadowColor = theme().food
  c.shadowBlur = 20
  c.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 40)
  c.fillStyle = theme().snake
  c.font = '12px "Press Start 2P"'
  c.shadowColor = theme().snake
  c.shadowBlur = 15
  c.fillText(`SCORE: ${score}`, canvas.width / 2, canvas.height / 2)
  if (score >= highScore) {
    c.fillStyle = '#ffff00'
    c.shadowColor = '#ffff00'
    c.fillText('NEW HIGH SCORE!', canvas.width / 2, canvas.height / 2 + 25)
  }
  c.fillStyle = 'rgba(255, 255, 255, 0.6)'
  c.font = '10px "Press Start 2P"'
  c.shadowBlur = 0
  c.fillText('按空格键重新开始', canvas.width / 2, canvas.height / 2 + 60)
}
