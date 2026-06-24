export interface WordCard {
  word: string
  phonetic: string
  meaning: string
  example: string
  pos: string
  easiness: number
  interval: number
  repetitions: number
  nextReview: string
  learned: boolean
  createdAt: string
}

export interface DailyStat {
  date: string
  count: number
  streak: number
}

export interface Setting {
  key: string
  value: number | string | boolean
}

export interface AppStats {
  total: number
  learned: number
  due: number
  masterCount: number
  today: string
}

export interface SM2Input {
  easiness: number
  interval: number
  repetitions: number
  nextReview: string
}

export interface SM2Output {
  easiness: number
  interval: number
  repetitions: number
  nextReview: string
}
