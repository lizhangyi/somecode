import type { SM2Input, SM2Output } from '../types'

const INITIAL_EF = 2.5
const GRADUATING_INTERVAL = 3
const EASY_BONUS = 1.3

function nextReviewDate(intervalDays: number): string {
  if (intervalDays === 0) {
    return new Date().toISOString().split('T')[0]
  }
  const d = new Date()
  d.setDate(d.getDate() + intervalDays)
  return d.toISOString().split('T')[0]
}

function isDue(nextReviewDate: string | null | undefined): boolean {
  if (!nextReviewDate) return true
  const today = new Date().toISOString().split('T')[0]
  return nextReviewDate <= today
}

function calculate(card: SM2Input, quality: number): SM2Output {
  const { easiness, interval, repetitions } = card
  let newEF = easiness
  let newInterval: number
  let newReps: number

  if (quality < 3) {
    newReps = 0
    newInterval = 0
  } else {
    if (repetitions === 0) {
      newInterval = 1
    } else if (repetitions === 1) {
      newInterval = GRADUATING_INTERVAL
    } else {
      newInterval = Math.round(interval * easiness)
    }
    if (quality === 5) {
      newInterval = Math.round(newInterval * EASY_BONUS)
    }
    newReps = repetitions + 1
  }

  newEF = easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  if (newEF < 1.3) newEF = 1.3

  const nextReview = nextReviewDate(newInterval)

  return {
    easiness: Math.round(newEF * 100) / 100,
    interval: newInterval,
    repetitions: newReps,
    nextReview,
  }
}

export const SM2 = {
  INITIAL_EF,
  calculate,
  isDue,
  nextReviewDate,
}
