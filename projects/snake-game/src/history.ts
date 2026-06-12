import type { HistoryEntry } from './types'
import { HISTORY_KEY, MAX_HISTORY } from './config'
import { snake } from './state'

export function saveHistory(score: number) {
  const history = loadHistory()
  history.push({
    score,
    length: snake.length,
    date: new Date().toISOString(),
  })
  history.sort((a, b) => b.score - a.score)
  if (history.length > MAX_HISTORY) {
    history.length = MAX_HISTORY
  }
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}

export function loadHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') || []
  } catch {
    return []
  }
}

export function renderHistory() {
  const listEl = document.getElementById('historyList')!
  const history = loadHistory()
  if (history.length === 0) {
    listEl.innerHTML = '<div class="history-empty">暂无记录</div>'
    return
  }
  listEl.innerHTML = history
    .map((entry, i) => {
      const d = new Date(entry.date)
      const dateStr = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      return `<div class="history-row">
          <span class="rank">#${i + 1}</span>
          <span class="score">${entry.score}</span>
          <span class="length">${entry.length}节</span>
          <span class="date">${dateStr}</span>
        </div>`
    })
    .join('')
}

export function toggleHistory() {
  const overlay = document.getElementById('historyOverlay')!
  if (overlay.style.display === 'none') {
    renderHistory()
    overlay.style.display = 'flex'
  } else {
    overlay.style.display = 'none'
  }
}

export function setupHistoryButton() {
  const historyBtn = document.getElementById('historyBtn')!
  const overlay = document.getElementById('historyOverlay')!
  const closeBtn = document.getElementById('closeHistoryBtn')!
  const clearBtn = document.getElementById('clearHistoryBtn')!

  historyBtn.addEventListener('click', toggleHistory)
  closeBtn.addEventListener('click', () => { overlay.style.display = 'none' })
  clearBtn.addEventListener('click', () => {
    localStorage.removeItem(HISTORY_KEY)
    renderHistory()
  })
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.style.display = 'none'
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.style.display !== 'none') {
      overlay.style.display = 'none'
    }
  })
}
