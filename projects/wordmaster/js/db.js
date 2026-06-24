/*
 * IndexedDB 数据持久层
 */
const DB_NAME = 'WordMasterDB';
const DB_VERSION = 1;

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      if (!database.objectStoreNames.contains('words')) {
        const store = database.createObjectStore('words', { keyPath: 'word' });
        store.createIndex('nextReview', 'nextReview', { unique: false });
        store.createIndex('reps', 'repetitions', { unique: false });
      }

      if (!database.objectStoreNames.contains('stats')) {
        database.createObjectStore('stats', { keyPath: 'date' });
      }

      if (!database.objectStoreNames.contains('settings')) {
        database.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

// === 单词操作 ===

async function initWordBank() {
  const tx = db.transaction('words', 'readonly');
  const store = tx.objectStore('words');
  const count = await new Promise((res, rej) => {
    const r = store.count();
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });

  if (count === 0) {
    const writeTx = db.transaction('words', 'readwrite');
    const writeStore = writeTx.objectStore('words');
    const today = new Date().toISOString().split('T')[0];

    WORDS.forEach((w, i) => {
      writeStore.put({
        word: w.word,
        phonetic: w.phonetic || '',
        meaning: w.meaning,
        example: w.example || '',
        pos: w.pos || '',
        easiness: SM2.INITIAL_EF,
        interval: 0,
        repetitions: 0,
        nextReview: today,
        learned: false,
        createdAt: today
      });
    });

    return new Promise((res, rej) => {
      writeTx.oncomplete = () => res();
      writeTx.onerror = rej;
    });
  }
}

function getDueCards(limit = 20) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('words', 'readonly');
    const store = tx.objectStore('words');
    const today = new Date().toISOString().split('T')[0];
    const cards = [];

    store.openCursor().onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const card = cursor.value;
        if (SM2.isDue(card.nextReview) && cards.length < limit) {
          cards.push(card);
        }
        cursor.continue();
      } else {
        resolve(cards);
      }
    };
    store.openCursor().onerror = reject;
  });
}

function getNewCards(limit = 10) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('words', 'readonly');
    const store = tx.objectStore('words');
    const cards = [];

    store.openCursor().onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const card = cursor.value;
        if (!card.learned && cards.length < limit) {
          cards.push(card);
        }
        cursor.continue();
      } else {
        resolve(cards);
      }
    };
    store.openCursor().onerror = reject;
  });
}

function updateCard(word, updates) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('words', 'readwrite');
    const store = tx.objectStore('words');
    const getReq = store.get(word);

    getReq.onsuccess = () => {
      const card = getReq.result;
      if (!card) { reject(new Error('Word not found')); return; }
      Object.assign(card, updates);
      store.put(card);
    };
    getReq.onerror = reject;
    tx.oncomplete = () => resolve();
    tx.onerror = reject;
  });
}

// === 统计操作 ===

function getStats() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('words', 'readonly');
    const store = tx.objectStore('words');
    const today = new Date().toISOString().split('T')[0];
    let total = 0, learned = 0, due = 0, masterCount = 0;

    store.openCursor().onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const card = cursor.value;
        total++;
        if (card.learned) learned++;
        if (SM2.isDue(card.nextReview)) due++;
        if (card.repetitions >= 3) masterCount++;
        cursor.continue();
      } else {
        resolve({ total, learned, due, masterCount, today });
      }
    };
    store.openCursor().onerror = reject;
  });
}

function recordDailyStudy(count) {
  return new Promise((resolve, reject) => {
    const today = new Date().toISOString().split('T')[0];
    const tx = db.transaction('stats', 'readwrite');
    const store = tx.objectStore('stats');

    const getReq = store.get(today);
    getReq.onsuccess = () => {
      const existing = getReq.result || { date: today, count: 0, streak: 0 };
      existing.count += count;
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const getYesterday = store.get(yesterday);
      getYesterday.onsuccess = () => {
        if (getYesterday.result) {
          existing.streak = (getYesterday.result.streak || 0) + 1;
        } else {
          existing.streak = 1;
        }
        store.put(existing);
      };
      getYesterday.onerror = () => {
        existing.streak = 1;
        store.put(existing);
      };
    };
    getReq.onerror = reject;
    tx.oncomplete = () => resolve();
    tx.onerror = reject;
  });
}

function getStreak() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('stats', 'readonly');
    const store = tx.objectStore('stats');
    const today = new Date().toISOString().split('T')[0];

    const getReq = store.get(today);
    getReq.onsuccess = () => {
      resolve(getReq.result ? getReq.result.streak || 0 : 0);
    };
    getReq.onerror = reject;
  });
}

// === 设置操作 ===

function getSetting(key, defaultValue = null) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : defaultValue);
    req.onerror = reject;
  });
}

function setSetting(key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    store.put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = reject;
  });
}
