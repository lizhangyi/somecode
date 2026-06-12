import type { Point } from './types'
import {
  snake, food, direction, nextDirection, score, highScore, portals, portalTimer,
  gameState, currentSpeed, lastSpeedIncreaseScore, boosting, boostTicks,
  boostCooldownEnd, boostTrail, scoreEl, highScoreEl, gameLoop,
  setDirection, setNextDirection, setGameState,
  setScore, setHighScore, setCurrentSpeed, setLastSpeedIncreaseScore,
  setBoosting, setBoostTicks, setBoostCooldownEnd, setFoodPulse, setPortalTimer,
  setGameLoop,
} from './state'
import { SoundFX } from './sound'
import { BGM } from './bgm'
import { renderGameFrame, renderGameOver } from './renderer'
import { saveHistory } from './history'
import {
  GRID_SIZE, DIRECTION, PORTAL_PAIRS, SPEED_INCREASE_SCORE,
  MIN_SPEED, SPEED_DECREMENT, BOOST_TICKS, BOOST_INTERVAL, BOOST_COOLDOWN,
  BOOST_TRAIL_MAX,
} from './config'

function getRandomEmptyPosition(): Point {
  return {
    x: Math.floor(Math.random() * GRID_SIZE),
    y: Math.floor(Math.random() * GRID_SIZE),
  }
}

function isOnSnake(x: number, y: number): boolean {
  return snake.some(seg => seg.x === x && seg.y === y)
}

function isOnPortal(x: number, y: number): boolean {
  return portals.some(p =>
    (p.pointA.x === x && p.pointA.y === y) ||
    (p.pointB.x === x && p.pointB.y === y)
  )
}

export function generatePortals() {
  portals.length = 0
  for (let i = 0; i < PORTAL_PAIRS; i++) {
    let pointA: Point, pointB: Point
    let attempts = 0
    do {
      pointA = getRandomEmptyPosition()
      attempts++
    } while (attempts < 100 && (isOnSnake(pointA.x, pointA.y) || (food.x === pointA.x && food.y === pointA.y)))
    if (attempts >= 100) continue

    attempts = 0
    do {
      pointB = getRandomEmptyPosition()
      attempts++
    } while (attempts < 100 && (
      isOnSnake(pointB.x, pointB.y) || (food.x === pointB.x && food.y === pointB.y) ||
      (pointA.x === pointB.x && pointA.y === pointB.y) ||
      (Math.abs(pointB.x - pointA.x) + Math.abs(pointB.y - pointA.y) < 5)
    ))
    if (attempts < 100) {
      portals.push({
        pointA, pointB,
        spiralA: 0, spiralB: Math.PI,
        pulse: Math.random() * Math.PI * 2,
      })
    }
  }
}

export function generateFood() {
  let valid = false
  while (!valid) {
    food.x = Math.floor(Math.random() * GRID_SIZE)
    food.y = Math.floor(Math.random() * GRID_SIZE)
    valid = !isOnSnake(food.x, food.y) && !isOnPortal(food.x, food.y)
  }
}

export function increaseSpeed() {
  if (currentSpeed > MIN_SPEED) {
    setCurrentSpeed(Math.max(MIN_SPEED, currentSpeed - SPEED_DECREMENT))
  }
}

export function startGame() {
  snake.length = 0
  snake.push({ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 })
  setDirection({ ...DIRECTION.RIGHT })
  setNextDirection({ ...DIRECTION.RIGHT })
  setScore(0)
  setCurrentSpeed(150)
  setLastSpeedIncreaseScore(0)

  // Reset boost
  setBoosting(false)
  setBoostTicks(0)
  setBoostCooldownEnd(0)
  boostTrail.length = 0

  // Reset portals
  portals.length = 0
  setPortalTimer(0)
  generatePortals()

  // Generate food
  generateFood()

  // Start game
  setGameState('playing')
  setGameLoop(setInterval(update, currentSpeed))
  requestAnimationFrame(renderGameFrame)
  SoundFX.playStart()
  BGM.start()
}

export function gameOver() {
  setGameState('game_over')
  SoundFX.playDeath()
  BGM.stop()
  if (gameLoop) clearInterval(gameLoop)

  if (score > highScore) {
    setHighScore(score)
    localStorage.setItem('snake_high_score', String(highScore))
    highScoreEl.textContent = String(highScore)
    SoundFX.playHighScore()
  }

  saveHistory(score)
  renderGameOver()
}

export function activateBoost() {
  if (boosting || Date.now() < boostCooldownEnd) return
  setBoosting(true)
  setBoostTicks(BOOST_TICKS)
  boostTrail.length = 0
  SoundFX.playBoost()
  if (gameLoop) clearInterval(gameLoop)
  setGameLoop(setInterval(update, BOOST_INTERVAL))
}

export function endBoost() {
  setBoosting(false)
  setBoostCooldownEnd(Date.now() + BOOST_COOLDOWN)
  if (gameLoop) clearInterval(gameLoop)
  setGameLoop(setInterval(update, currentSpeed))
}

export function togglePause() {
  if (gameState === 'playing') {
    setGameState('paused')
    SoundFX.playPause()
    BGM.stop()
    if (gameLoop) clearInterval(gameLoop)
  } else if (gameState === 'paused') {
    setGameState('playing')
    SoundFX.playResume()
    BGM.start()
    setGameLoop(setInterval(update, boosting ? BOOST_INTERVAL : currentSpeed))
  }
}

export function update() {
  if (gameState !== 'playing') return

  // Boost tick
  if (boosting) {
    setBoostTicks(boostTicks - 1)
    if (boostTicks <= 0) endBoost()
  }

  // Direction change
  const wasTurning = direction.x !== nextDirection.x || direction.y !== nextDirection.y
  setDirection(nextDirection)
  if (wasTurning) SoundFX.playTurn()

  // New head position
  let head: Point = {
    x: snake[0].x + direction.x,
    y: snake[0].y + direction.y,
  }

  // Wall wrapping
  if (head.x < 0) head.x = GRID_SIZE - 1
  else if (head.x >= GRID_SIZE) head.x = 0
  if (head.y < 0) head.y = GRID_SIZE - 1
  else if (head.y >= GRID_SIZE) head.y = 0

  // Portal detection
  let teleported = false
  for (const portal of portals) {
    if (head.x === portal.pointA.x && head.y === portal.pointA.y) {
      head.x = portal.pointB.x + direction.x
      head.y = portal.pointB.y + direction.y
      teleported = true
    } else if (head.x === portal.pointB.x && head.y === portal.pointB.y) {
      head.x = portal.pointA.x + direction.x
      head.y = portal.pointA.y + direction.y
      teleported = true
    }
    if (teleported) {
      if (head.x < 0) head.x = GRID_SIZE - 1
      else if (head.x >= GRID_SIZE) head.x = 0
      if (head.y < 0) head.y = GRID_SIZE - 1
      else if (head.y >= GRID_SIZE) head.y = 0
      generatePortals()
      SoundFX.playPortal()
      break
    }
  }

  // Boost trail
  if (boosting) {
    boostTrail.push({ x: head.x, y: head.y })
    if (boostTrail.length > BOOST_TRAIL_MAX) boostTrail.shift()
  }

  // Self collision
  if (snake.some(seg => seg.x === head.x && seg.y === head.y)) {
    gameOver()
    return
  }

  // Add head
  snake.unshift(head)

  // Food check
  if (head.x === food.x && head.y === food.y) {
    setScore(score + (boosting ? 20 : 10))
    scoreEl.textContent = String(score)
    generateFood()
    SoundFX.playEat()
    if (score - lastSpeedIncreaseScore >= SPEED_INCREASE_SCORE) {
      increaseSpeed()
      if (gameState === 'playing' && !boosting) {
        if (gameLoop) clearInterval(gameLoop)
        setGameLoop(setInterval(update, currentSpeed))
      }
      setLastSpeedIncreaseScore(score)
    }
  } else {
    snake.pop()
  }
}
