import './style.css'
import { initDOM, themeButtons, gameState } from './state'
import { loadTheme, applyTheme, getThemeColors } from './theme'
import { SoundFX } from './sound'
import { renderStartScreen, renderGameFrame, renderGameOver } from './renderer'
import { setupControls } from './controls'
import { setupHistoryButton } from './history'
import type { ThemeName } from './types'

function init() {
  initDOM()

  loadTheme()

  renderStartScreen()

  setupControls()

  // Theme selector
  themeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = (btn as HTMLElement).dataset.theme as ThemeName
      applyTheme(theme)
      if (gameState === 'playing' || gameState === 'paused') {
        renderGameFrame()
      } else if (gameState === 'idle') {
        renderStartScreen()
      } else if (gameState === 'game_over') {
        renderGameOver()
      }
    })
  })

  // Mute button
  const muteBtn = document.getElementById('muteBtn')!
  SoundFX.loadMuteState()
  updateMuteButton()
  muteBtn.addEventListener('click', () => {
    SoundFX.init()
    SoundFX.toggleMute()
    updateMuteButton()
  })
  function updateMuteButton() {
    muteBtn.textContent = SoundFX.muted ? '🔇' : '🔊'
    muteBtn.classList.toggle('muted', SoundFX.muted)
  }

  setupHistoryButton()
}

document.addEventListener('DOMContentLoaded', init)
