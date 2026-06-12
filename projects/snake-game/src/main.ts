import './style.css'
import { initDOM, themeButtons, musicButtons, gameState } from './state'
import { loadTheme, applyTheme, getThemeColors } from './theme'
import { SoundFX } from './sound'
import { BGM, setMusicTheme, loadMusicTheme, currentMusicTheme } from './bgm'
import { renderStartScreen, renderGameFrame, renderGameOver } from './renderer'
import { setupControls } from './controls'
import { setupHistoryButton } from './history'
import type { ThemeName, MusicTheme } from './types'

function init() {
  initDOM()

  loadTheme()
  loadMusicTheme()
  updateMusicButtons()

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

  // Music theme selector
  musicButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = (btn as HTMLElement).dataset.music as MusicTheme
      setMusicTheme(theme)
      updateMusicButtons()
    })
  })
  function updateMusicButtons() {
    musicButtons.forEach(btn => {
      btn.classList.toggle('active', (btn as HTMLElement).dataset.music === currentMusicTheme)
    })
  }

  // Mute button
  const muteBtn = document.getElementById('muteBtn')!
  SoundFX.loadMuteState()
  SoundFX.loadVolume()
  BGM.muted = SoundFX.muted
  BGM.volume = SoundFX.volume
  updateMuteButton()
  muteBtn.addEventListener('click', () => {
    SoundFX.init()
    BGM.init()
    SoundFX.toggleMute()
    BGM.setMuted(SoundFX.muted)
    updateMuteButton()
  })
  function updateMuteButton() {
    muteBtn.textContent = SoundFX.muted ? '🔇' : '🔊'
    muteBtn.classList.toggle('muted', SoundFX.muted)
  }

  // Volume slider
  const slider = document.getElementById('volumeSlider') as HTMLInputElement
  const label = document.getElementById('volumeLabel')!
  slider.value = String(Math.round(SoundFX.volume * 100))
  label.textContent = String(Math.round(SoundFX.volume * 100))
  slider.addEventListener('input', () => {
    const v = Number(slider.value) / 100
    SoundFX.init()
    BGM.init()
    SoundFX.setVolume(v)
    BGM.setVolume(v)
    label.textContent = slider.value
  })

  setupHistoryButton()
}

document.addEventListener('DOMContentLoaded', init)
