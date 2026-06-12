import {
  direction, setNextDirection, gameState,
} from './state'
import { DIRECTION, GAME_STATE } from './config'
import { startGame, togglePause, activateBoost } from './game'

export function setupControls() {
  document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase()
    switch (key) {
      case ' ':
        e.preventDefault()
        if (gameState === 'idle' || gameState === 'game_over') {
          startGame()
        } else if (gameState === 'playing' || gameState === 'paused') {
          togglePause()
        }
        break
      case 'p':
        if (gameState === 'playing' || gameState === 'paused') togglePause()
        break
      case 'arrowup':
      case 'w':
        if (direction !== DIRECTION.DOWN) {
          if (direction === DIRECTION.UP && gameState === 'playing') {
            activateBoost()
          } else {
            setNextDirection(DIRECTION.UP)
          }
        }
        break
      case 'arrowdown':
      case 's':
        if (direction !== DIRECTION.UP) {
          if (direction === DIRECTION.DOWN && gameState === 'playing') {
            activateBoost()
          } else {
            setNextDirection(DIRECTION.DOWN)
          }
        }
        break
      case 'arrowleft':
      case 'a':
        if (direction !== DIRECTION.RIGHT) {
          if (direction === DIRECTION.LEFT && gameState === 'playing') {
            activateBoost()
          } else {
            setNextDirection(DIRECTION.LEFT)
          }
        }
        break
      case 'arrowright':
      case 'd':
        if (direction !== DIRECTION.LEFT) {
          if (direction === DIRECTION.RIGHT && gameState === 'playing') {
            activateBoost()
          } else {
            setNextDirection(DIRECTION.RIGHT)
          }
        }
        break
    }
  })

  // Touch controls
  let touchStartX = 0
  let touchStartY = 0
  const canvas = document.getElementById('gameCanvas')!

  canvas.addEventListener('touchstart', (e) => {
    if (gameState === 'idle' || gameState === 'game_over') {
      startGame()
      return
    }
    touchStartX = (e as TouchEvent).touches[0].clientX
    touchStartY = (e as TouchEvent).touches[0].clientY
  }, { passive: true })

  canvas.addEventListener('touchend', (e) => {
    if (gameState !== 'playing') return
    const diffX = (e as TouchEvent).changedTouches[0].clientX - touchStartX
    const diffY = (e as TouchEvent).changedTouches[0].clientY - touchStartY
    const minSwipe = 30
    if (Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX > minSwipe && direction !== DIRECTION.LEFT) setNextDirection(DIRECTION.RIGHT)
      else if (diffX < -minSwipe && direction !== DIRECTION.RIGHT) setNextDirection(DIRECTION.LEFT)
    } else {
      if (diffY > minSwipe && direction !== DIRECTION.UP) setNextDirection(DIRECTION.DOWN)
      else if (diffY < -minSwipe && direction !== DIRECTION.DOWN) setNextDirection(DIRECTION.UP)
    }
  }, { passive: true })
}
