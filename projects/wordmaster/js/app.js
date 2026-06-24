/*
 * WordMaster — 主应用
 */

// === 应用状态 ===
const state = {
  currentPage: 'learn',
  cards: [],
  currentIndex: 0,
  isFlipped: false,
  dailyGoal: 30,
  studyCount: 0
};

// === 初始化 ===
async function init() {
  await openDB();
  await initWordBank();
  await loadSetting();
  await refreshLearnPage();
  await navigateTo('learn');

  // 事件监听
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const page = tab.dataset.page;
      navigateTo(page);
    });
  });

  // 卡片点击翻转
  const cardFlip = document.getElementById('cardFlip');
  cardFlip.addEventListener('click', () => {
    if (state.cards.length === 0) return;
    state.isFlipped = !state.isFlipped;
    cardFlip.classList.toggle('flipped', state.isFlipped);

    // 翻转后显示评分按钮
    if (state.isFlipped) {
      setTimeout(() => {
        document.getElementById('ratingBar').style.opacity = '1';
      }, 300);
    } else {
      document.getElementById('ratingBar').style.opacity = '0';
    }
  });

  // 评分按钮
  document.querySelectorAll('.rating-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const quality = parseInt(btn.dataset.quality);
      handleRating(quality);
    });
  });
}

// === 页面导航 ===
async function navigateTo(page) {
  state.currentPage = page;

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));

  const targetPage = document.getElementById(`page-${page}`);
  const targetTab = document.querySelector(`[data-page="${page}"]`);

  if (targetPage) targetPage.classList.add('active');
  if (targetTab) targetTab.classList.add('active');

  if (page === 'stats') await refreshStats();
  if (page === 'settings') await refreshSettings();
}

// === 学习页 ===
async function refreshLearnPage() {
  const dueCards = await getDueCards(state.dailyGoal);
  const newCards = await getNewCards(10);

  // 优先复习，然后新词
  state.cards = [...dueCards.filter(c => c.learned), ...newCards, ...dueCards.filter(c => !c.learned)];

  // 去重
  const seen = new Set();
  state.cards = state.cards.filter(c => {
    if (seen.has(c.word)) return false;
    seen.add(c.word);
    return true;
  });

  state.cards = state.cards.slice(0, state.dailyGoal);
  state.currentIndex = 0;
  state.isFlipped = false;
  state.studyCount = 0;

  if (state.cards.length === 0) {
    showDone();
  } else {
    showCard();
  }
}

function showCard() {
  if (state.currentIndex >= state.cards.length) {
    showDone();
    return;
  }

  const card = state.cards[state.currentIndex];
  const container = document.getElementById('cardContainer');
  const ratingBar = document.getElementById('ratingBar');
  const doneState = document.getElementById('doneState');

  container.style.display = 'block';
  ratingBar.style.display = 'flex';
  ratingBar.style.opacity = '0';
  doneState.style.display = 'none';

  document.getElementById('cardFlip').classList.remove('flipped');
  state.isFlipped = false;

  document.getElementById('frontWord').textContent = card.word;
  document.getElementById('frontPhonetic').textContent = card.phonetic || '';
  document.getElementById('backMeaning').textContent = card.meaning;
  document.getElementById('backExample').textContent = card.example ? `"${card.example}"` : '';
  document.getElementById('backPhonetic').textContent = card.phonetic || '';
  document.getElementById('backPos').textContent = card.pos || '';
  document.getElementById('backPos').style.display = card.pos ? 'inline-block' : 'none';

  updateProgress();
}

function updateProgress() {
  const total = state.cards.length;
  const done = state.currentIndex;
  const pct = (done / total) * 100;

  document.getElementById('progressFill').style.width = `${pct}%`;
  document.getElementById('progressText').textContent = `${done}/${total}`;
  document.getElementById('progressRemain').textContent = `剩余 ${total - done}`;
}

async function handleRating(quality) {
  if (state.cards.length === 0) return;

  const card = state.cards[state.currentIndex];
  const result = SM2.calculate({
    easiness: card.easiness,
    interval: card.interval,
    repetitions: card.repetitions,
    nextReview: card.nextReview
  }, quality);

  await updateCard(card.word, {
    easiness: result.easiness,
    interval: result.interval,
    repetitions: result.repetitions,
    nextReview: result.nextReview,
    learned: true
  });

  state.studyCount++;
  state.currentIndex++;
  state.isFlipped = false;

  // 震动反馈（如果支持）
  if (navigator.vibrate) {
    const pattern = quality >= 4 ? [10] : quality >= 3 ? [20] : [30, 50, 30];
    navigator.vibrate(pattern);
  }

  if (state.currentIndex >= state.cards.length) {
    await recordDailyStudy(state.studyCount);
    showDone();
  } else {
    showCard();
  }
}

function showDone() {
  document.getElementById('cardContainer').style.display = 'none';
  document.getElementById('ratingBar').style.display = 'none';
  document.getElementById('doneState').style.display = 'block';
  document.getElementById('doneCount').textContent = state.studyCount;
  document.getElementById('progressFill').style.width = '100%';
  document.getElementById('progressText').textContent = `${state.cards.length}/${state.cards.length}`;
  document.getElementById('progressRemain').textContent = '已完成';
}

// === 统计页 ===
async function refreshStats() {
  const stats = await getStats();
  const streak = await getStreak();

  document.getElementById('stat-total').textContent = stats.total;
  document.getElementById('stat-learned').textContent = stats.learned;
  document.getElementById('stat-due').textContent = stats.due;
  document.getElementById('stat-master').textContent = stats.masterCount;
  document.getElementById('stat-streak').textContent = streak;
  document.getElementById('stat-pct').textContent =
    stats.total > 0 ? Math.round((stats.learned / stats.total) * 100) + '%' : '0%';
}

// === 设置页 ===
async function loadSetting() {
  state.dailyGoal = await getSetting('dailyGoal', 30);
}

async function refreshSettings() {
  const goalSelect = document.getElementById('dailyGoalSelect');
  if (goalSelect) goalSelect.value = state.dailyGoal;
}

async function changeDailyGoal(value) {
  state.dailyGoal = parseInt(value);
  await setSetting('dailyGoal', state.dailyGoal);
}

// === 重置 ===
async function resetProgress() {
  if (!confirm('确定要重置所有学习进度吗？此操作不可恢复。')) return;

  const tx = db.transaction('words', 'readwrite');
  const store = tx.objectStore('words');
  const today = new Date().toISOString().split('T')[0];

  store.openCursor().onsuccess = (event) => {
    const cursor = event.target.result;
    if (cursor) {
      const card = cursor.value;
      card.easiness = SM2.INITIAL_EF;
      card.interval = 0;
      card.repetitions = 0;
      card.nextReview = today;
      card.learned = false;
      cursor.update(card);
      cursor.continue();
    }
  };

  await new Promise((res) => { tx.oncomplete = res; });
  await refreshLearnPage();
  navigateTo('learn');
}

// === PWA 安装 ===
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('installBanner').classList.remove('hidden');
});

document.getElementById('installBtn').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const result = await deferredPrompt.userChoice;
  if (result.outcome === 'accepted') {
    document.getElementById('installBanner').classList.add('hidden');
  }
  deferredPrompt = null;
});

document.getElementById('dismissInstall').addEventListener('click', () => {
  document.getElementById('installBanner').classList.add('hidden');
});

// === 启动 ===
document.addEventListener('DOMContentLoaded', init);

// === Service Worker 注册 ===
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
