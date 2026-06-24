import type { WordCard, DailyStat, Setting, AppStats } from '../types'
import { WORDS } from '../utils/words'
import { SM2 } from '../utils/sm2'

const DB_NAME = 'WordMasterDB'
const DB_VERSION = 1

let db: IDBDatabase | null = null

function openDB(): Promise<IDBDatabase> {
  if (db) return Promise.resolve(db)
  return new Promise((resolve, reject) => {
    console.log('[WordMaster DB] opening IndexedDB...')
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => {
      console.error('[WordMaster DB] open error:', request.error)
      reject(request.error)
    }
    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result
      if (!database.objectStoreNames.contains('words')) {
        const store = database.createObjectStore('words', { keyPath: 'word' })
        store.createIndex('nextReview', 'nextReview', { unique: false })
        store.createIndex('reps', 'repetitions', { unique: false })
      }
      if (!database.objectStoreNames.contains('stats')) {
        database.createObjectStore('stats', { keyPath: 'date' })
      }
      if (!database.objectStoreNames.contains('settings')) {
        database.createObjectStore('settings', { keyPath: 'key' })
      }
    }
    request.onsuccess = (event) => {
      db = (event.target as IDBOpenDBRequest).result
      console.log('[WordMaster DB] opened successfully')
      resolve(db!)
    }
    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error)
    }
  })
}

// ---- 单词操作 ----

async function initWordBank(): Promise<void> {
  const database = await openDB()
  const tx = database.transaction('words', 'readonly')
  const store = tx.objectStore('words')
  const count = await new Promise<number>((res, rej) => {
    const r = store.count()
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
  if (count === 0) {
    const writeTx = database.transaction('words', 'readwrite')
    const writeStore = writeTx.objectStore('words')
    const today = new Date().toISOString().split('T')[0]
    WORDS.forEach((w) => {
      writeStore.put({
        ...w,
        easiness: SM2.INITIAL_EF,
        interval: 0,
        repetitions: 0,
        nextReview: today,
        learned: false,
        createdAt: today,
      })
    })
    await new Promise<void>((res, rej) => {
      writeTx.oncomplete = () => res()
      writeTx.onerror = () => rej(writeTx.error)
    })
  }
}

function getDueCards(limit = 20): Promise<WordCard[]> {
  return new Promise((resolve, reject) => {
    openDB().then((database) => {
      const tx = database.transaction('words', 'readonly')
      const store = tx.objectStore('words')
      const cards: WordCard[] = []
      store.openCursor().onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result
        if (cursor) {
          const card: WordCard = cursor.value
          if (SM2.isDue(card.nextReview) && cards.length < limit) {
            cards.push(card)
          }
          cursor.continue()
        } else {
          resolve(cards)
        }
      }
      store.openCursor().onerror = () => reject(store.openCursor().error)
    }).catch(reject)
  })
}

function getNewCards(limit = 10): Promise<WordCard[]> {
  return new Promise((resolve, reject) => {
    openDB().then((database) => {
      const tx = database.transaction('words', 'readonly')
      const store = tx.objectStore('words')
      const cards: WordCard[] = []
      store.openCursor().onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result
        if (cursor) {
          const card: WordCard = cursor.value
          if (!card.learned && cards.length < limit) {
            cards.push(card)
          }
          cursor.continue()
        } else {
          resolve(cards)
        }
      }
      store.openCursor().onerror = () => reject(store.openCursor().error)
    }).catch(reject)
  })
}

function updateCard(word: string, updates: Partial<WordCard>): Promise<void> {
  return new Promise((resolve, reject) => {
    openDB().then((database) => {
      const tx = database.transaction('words', 'readwrite')
      const store = tx.objectStore('words')
      const getReq = store.get(word)
      getReq.onsuccess = () => {
        const card: WordCard | undefined = getReq.result
        if (!card) { reject(new Error('Word not found')); return }
        Object.assign(card, updates)
        store.put(card)
      }
      getReq.onerror = () => reject(getReq.error)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    }).catch(reject)
  })
}

// ---- 统计操作 ----

function getStats(): Promise<AppStats> {
  return new Promise((resolve, reject) => {
    openDB().then((database) => {
      const tx = database.transaction('words', 'readonly')
      const store = tx.objectStore('words')
      const today = new Date().toISOString().split('T')[0]
      let total = 0, learned = 0, due = 0, masterCount = 0
      store.openCursor().onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result
        if (cursor) {
          const card: WordCard = cursor.value
          total++
          if (card.learned) learned++
          if (SM2.isDue(card.nextReview)) due++
          if (card.repetitions >= 3) masterCount++
          cursor.continue()
        } else {
          resolve({ total, learned, due, masterCount, today })
        }
      }
      store.openCursor().onerror = () => reject(store.openCursor().error)
    }).catch(reject)
  })
}

function recordDailyStudy(count: number): Promise<void> {
  return new Promise((resolve, reject) => {
    openDB().then((database) => {
      const today = new Date().toISOString().split('T')[0]
      const tx = database.transaction('stats', 'readwrite')
      const store = tx.objectStore('stats')
      const getReq = store.get(today)
      getReq.onsuccess = () => {
        const existing: DailyStat | undefined = getReq.result
        const record: DailyStat = existing
          ? { ...existing, count: existing.count + count }
          : { date: today, count, streak: 0 }
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
        const getYesterday = store.get(yesterday)
        getYesterday.onsuccess = () => {
          const yest = getYesterday.result as DailyStat | undefined
          record.streak = yest ? (yest.streak || 0) + 1 : 1
          store.put(record)
        }
        getYesterday.onerror = () => {
          record.streak = 1
          store.put(record)
        }
      }
      getReq.onerror = () => reject(getReq.error)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    }).catch(reject)
  })
}

function getStreak(): Promise<number> {
  return new Promise((resolve, reject) => {
    openDB().then((database) => {
      const today = new Date().toISOString().split('T')[0]
      const tx = database.transaction('stats', 'readonly')
      const store = tx.objectStore('stats')
      const getReq = store.get(today)
      getReq.onsuccess = () => {
        const result = getReq.result as DailyStat | undefined
        resolve(result ? result.streak || 0 : 0)
      }
      getReq.onerror = () => reject(getReq.error)
    }).catch(reject)
  })
}

// ---- 设置操作 ----

function getSetting(key: string, defaultValue: number | string | boolean = null): Promise<number | string | boolean | null> {
  return new Promise((resolve, reject) => {
    openDB().then((database) => {
      const tx = database.transaction('settings', 'readonly')
      const store = tx.objectStore('settings')
      const req = store.get(key)
      req.onsuccess = () => resolve(req.result ? (req.result as Setting).value : defaultValue)
      req.onerror = () => reject(req.error)
    }).catch(reject)
  })
}

function setSetting(key: string, value: number | string | boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    openDB().then((database) => {
      const tx = database.transaction('settings', 'readwrite')
      const store = tx.objectStore('settings')
      store.put({ key, value })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    }).catch(reject)
  })
}

// ---- 重置进度 ----

function resetProgress(): Promise<void> {
  return new Promise((resolve, reject) => {
    openDB().then((database) => {
      const tx = database.transaction('words', 'readwrite')
      const store = tx.objectStore('words')
      const today = new Date().toISOString().split('T')[0]
      store.openCursor().onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result
        if (cursor) {
          const card: WordCard = cursor.value
          card.easiness = SM2.INITIAL_EF
          card.interval = 0
          card.repetitions = 0
          card.nextReview = today
          card.learned = false
          cursor.update(card)
          cursor.continue()
        }
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    }).catch(reject)
  })
}

export {
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
}
