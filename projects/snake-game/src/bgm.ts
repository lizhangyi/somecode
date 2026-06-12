import type { MusicTheme } from './types'

const ROOT_FREQ = 110

function semitone(freq: number, semitones: number): number {
  return freq * 2 ** (semitones / 12)
}

interface BGMStyle {
  beatMs: number
  patternLen: number
  bass: { semitones: number[]; type: OscillatorType; vol: number; dur: number }
  melody: { semitones: number[]; type: OscillatorType; vol: number; dur: number; beats: number[] }
}

const STYLES: Record<MusicTheme, BGMStyle> = {
  retro: {
    beatMs: 250,
    patternLen: 8,
    bass: {
      semitones: [0, 7, 0, 7, 0, 7, 0, 7],
      type: 'sawtooth',
      vol: 0.04,
      dur: 0.8,
    },
    melody: {
      semitones: [12, 16, 19, 24],
      type: 'square',
      vol: 0.025,
      dur: 0.7,
      beats: [0, 2, 4, 6],
    },
  },
  chill: {
    beatMs: 320,
    patternLen: 16,
    bass: {
      semitones: [0, 0, 7, 7, 5, 5, 3, 3, 0, 0, 7, 7, 5, 5, 3, 3],
      type: 'triangle',
      vol: 0.035,
      dur: 0.9,
    },
    melody: {
      semitones: [12, 15, 19, 24, 19, 15, 12, 7],
      type: 'sine',
      vol: 0.02,
      dur: 0.8,
      beats: [0, 2, 4, 6, 8, 10, 12, 14],
    },
  },
  intense: {
    beatMs: 180,
    patternLen: 16,
    bass: {
      semitones: [0, 0, 3, 3, 5, 5, 7, 7, 0, 0, 3, 3, 5, 5, 7, 10],
      type: 'sawtooth',
      vol: 0.045,
      dur: 0.6,
    },
    melody: {
      semitones: [12, 15, 19, 22, 24, 22, 19, 15, 12, 15, 19, 22, 24, 27, 24, 22],
      type: 'square',
      vol: 0.02,
      dur: 0.5,
      beats: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    },
  },
}

export let currentMusicTheme: MusicTheme = 'retro'

export function setMusicTheme(theme: MusicTheme) {
  currentMusicTheme = theme
  localStorage.setItem('snake_music_theme', theme)
}

export function loadMusicTheme() {
  const saved = localStorage.getItem('snake_music_theme') as MusicTheme | null
  if (saved && STYLES[saved]) {
    currentMusicTheme = saved
  }
}

export const BGM = {
  ctx: null as AudioContext | null,
  gain: null as GainNode | null,
  playing: false,
  muted: false,
  volume: 0.5,
  timeoutId: 0 as ReturnType<typeof setTimeout>,
  beatIndex: 0,

  init() {
    if (this.ctx) return
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      this.gain = this.ctx.createGain()
      this.gain.gain.value = this.muted ? 0 : this.volume
      this.gain.connect(this.ctx.destination)
    } catch {
      console.log('Web Audio API 不可用')
    }
  },

  start() {
    this.init()
    if (!this.ctx || this.playing) return
    this.playing = true
    this.beatIndex = 0
    this.schedule()
  },

  stop() {
    this.playing = false
    clearTimeout(this.timeoutId)
  },

  setVolume(v: number) {
    this.volume = v
    if (this.gain && !this.muted) {
      this.gain.gain.value = v
    }
  },

  setMuted(muted: boolean) {
    this.muted = muted
    if (this.gain) {
      this.gain.gain.value = muted ? 0 : this.volume
    }
    if (muted) {
      clearTimeout(this.timeoutId)
    } else if (this.playing) {
      this.schedule()
    }
  },

  schedule() {
    if (!this.playing || this.muted) return

    const ctx = this.ctx!
    const now = ctx.currentTime
    const style = STYLES[currentMusicTheme]
    const beat = this.beatIndex % style.patternLen

    // Bass
    const bassFreq = semitone(ROOT_FREQ, style.bass.semitones[beat])
    this.playNote(bassFreq, style.beatMs / 1000 * style.bass.dur, style.bass.type, style.bass.vol, now)

    // Melody
    const melodyIdx = style.melody.beats.indexOf(beat)
    if (melodyIdx !== -1) {
      const melodyFreq = semitone(ROOT_FREQ, style.melody.semitones[melodyIdx % style.melody.semitones.length])
      this.playNote(melodyFreq, style.beatMs / 1000 * style.melody.dur, style.melody.type, style.melody.vol, now)
    }

    this.beatIndex++
    this.timeoutId = setTimeout(() => this.schedule(), style.beatMs)
  },

  playNote(freq: number, duration: number, type: OscillatorType, volume: number, startTime: number) {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    const noteGain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, startTime)
    noteGain.gain.setValueAtTime(volume, startTime)
    noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
    osc.connect(noteGain).connect(this.gain!)
    osc.start(startTime)
    osc.stop(startTime + duration)
  },
}
