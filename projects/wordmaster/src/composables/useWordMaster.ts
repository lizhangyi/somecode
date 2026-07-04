import { ref, computed } from 'vue'
import type { WordCard, AppStats } from '../types'
import {
  openDB,
  initWordBank,
  getDueCards,
  getNewCards,
  updateCard,
  getStats,
  recordDailyStudy,
  getStreak,
  getSetting,
  setSetting,
  resetProgress,
} from '../db'
import { SM2 } from '../utils/sm2'

// ---- 全局状态 ----
const currentPage = ref<'learn' | 'stats' | 'settings'>('learn')
const cards = ref<WordCard[]>([])
const currentIndex = ref(0)
const isFlipped = ref(false)
const dailyGoal = ref(30)
const studyCount = ref(0)
const isInitialized = ref(false)

// 正面和背面各自持有独立的数据副本，彻底避免翻转期间内容错乱
const frontCard = ref<WordCard | null>(null)
const backCard = ref<WordCard | null>(null)

// ---- 学习页逻辑 ----
async function refreshLearnPage() {
  const dueCards = await getDueCards(dailyGoal.value)
  const newCards = await getNewCards(10)
  const dueRemain = dueCards.filter(c => !c.learned)
  const dueLearned = dueCards.filter(c => c.learned)
  const merged = [...dueLearned, ...newCards, ...dueRemain]

  const seen = new Set<string>()
  const unique = merged.filter(c => {
    if (seen.has(c.word)) return false
    seen.add(c.word)
    return true
  })

  cards.value = unique.slice(0, dailyGoal.value)
  currentIndex.value = 0
  isFlipped.value = false
  studyCount.value = 0

  // 初始化正背面数据副本
  frontCard.value = cards.value[0] ?? null
  backCard.value = cards.value[0] ?? null

  if (cards.value.length === 0) {
    isDone.value = true
  } else {
    isDone.value = false
  }
}

const progressPct = computed(() => {
  if (cards.value.length === 0) return 0
  return (currentIndex.value / cards.value.length) * 100
})

const progressText = computed(() => `${currentIndex.value}/${cards.value.length}`)
const progressRemain = computed(() => {
  if (currentIndex.value >= cards.value.length) return '已完成'
  return `剩余 ${cards.value.length - currentIndex.value}`
})

const isDone = ref(false)
const doneCount = computed(() => studyCount.value)

function toggleFlip() {
  if (cards.value.length === 0) return

  if (!isFlipped.value) {
    // 当前是正面，即将翻到背面 → 先更新背面数据（此时背面不可见，不会闪现）
    backCard.value = frontCard.value
  }
  // 翻到正面时不需要更新 frontCard（frontCard 在 handleRating 里已经更新好了）

  isFlipped.value = !isFlipped.value
}

async function handleRating(quality: number) {
  if (cards.value.length === 0) return
  const card = cards.value[currentIndex.value]
  if (!card) return

  const result = SM2.calculate(
    {
      easiness: card.easiness,
      interval: card.interval,
      repetitions: card.repetitions,
      nextReview: card.nextReview,
    },
    quality
  )

  await updateCard(card.word, {
    easiness: result.easiness,
    interval: result.interval,
    repetitions: result.repetitions,
    nextReview: result.nextReview,
    learned: true,
  })

  studyCount.value++

  // 先推进索引
  currentIndex.value++

  // 如果还有词，提前准备好下一个词的正面数据
  // 此时如果卡片是背面朝上，正面不可见，更新 frontCard 不会闪现
  if (currentIndex.value < cards.value.length) {
    frontCard.value = cards.value[currentIndex.value]
  } else {
    frontCard.value = null
  }

  // 翻回正面（显示下一个词的英文）
  isFlipped.value = false

  if (navigator.vibrate) {
    const pattern = quality >= 4 ? [10] : quality >= 3 ? [20] : [30, 50, 30]
    navigator.vibrate(pattern)
  }

  if (currentIndex.value >= cards.value.length) {
    await recordDailyStudy(studyCount.value)
    isDone.value = true
  }
}

// ---- 统计页 ----
const stats = ref<AppStats | null>(null)
const streak = ref(0)

async function refreshStats() {
  stats.value = await getStats()
  streak.value = await getStreak()
}

const statsPct = computed(() => {
  if (!stats.value || stats.value.total === 0) return '0%'
  return Math.round((stats.value.learned / stats.value.total) * 100) + '%'
})

// ---- 设置页 ----
async function loadSettings() {
  dailyGoal.value = (await getSetting('dailyGoal', 30)) as number
}

async function changeDailyGoal(val: number) {
  dailyGoal.value = val
  await setSetting('dailyGoal', val)
}

async function handleResetProgress(): Promise<boolean> {
  const ok = confirm('确定要重置所有学习进度吗？此操作不可恢复。')
  if (!ok) return false
  await resetProgress()
  await refreshLearnPage()
  return true
}

// ---- 页面导航 ----
async function navigateTo(page: 'learn' | 'stats' | 'settings') {
  currentPage.value = page
  isDone.value = false
  if (page === 'learn') await refreshLearnPage()
  if (page === 'stats') await refreshStats()
  if (page === 'settings') await loadSettings()
}

// ---- 初始化 ----
const initError = ref<string | null>(null)

async function init() {
  try {
    await openDB()
    await initWordBank()
    await loadSettings()
    await refreshLearnPage()
    isInitialized.value = true

    // 每 5 秒刷新顶部待复习/已掌握数字
    setInterval(async () => {
      try {
        const s = await getStats()
        topDue.value = s.due
        topLearned.value = s.learned
      } catch {}
    }, 5000)
  } catch (e: any) {
    initError.value = e?.message || String(e)
    console.error('[WordMaster] init failed:', e)
  }
}

const topDue = ref(0)
const topLearned = ref(0)

// ---- PWA 安装 ----
const showInstallBanner = ref(false)
let deferredPrompt: any = null

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    console.log('[WordMaster] beforeinstallprompt fired')
    e.preventDefault()
    deferredPrompt = e
    showInstallBanner.value = true
  })
}

function setupInstallPrompt() {
  // 实际逻辑已在上面立即注册
}

async function installApp() {
  if (!deferredPrompt) return
  deferredPrompt.prompt()
  const result = await deferredPrompt.userChoice
  if (result.outcome === 'accepted') {
    showInstallBanner.value = false
  }
  deferredPrompt = null
}

function dismissInstallBanner() {
  showInstallBanner.value = false
}

export function useWordMaster() {
  return {
    // 状态
    currentPage,
    cards,
    currentIndex,
    isFlipped,
    dailyGoal,
    studyCount,
    isInitialized,
    isDone,
    initError,

    // 卡片数据（正背面独立副本）
    frontCard,
    backCard,

    // 计算属性
    progressPct,
    progressText,
    progressRemain,
    doneCount,
    stats,
    streak,
    statsPct,
    topDue,
    topLearned,
    showInstallBanner,

    // 方法
    toggleFlip,
    handleRating,
    refreshLearnPage,
    refreshStats,
    navigateTo,
    changeDailyGoal,
    handleResetProgress,
    init,
    installApp,
    dismissInstallBanner,
    setupInstallPrompt,
  }
}
