const ROOT_FREQ = 110
const BEAT_MS = 250

function semitone(freq: number, semitones: number): number {
  return freq * 2 ** (semitones / 12)
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
    const beat = this.beatIndex % 8

    // Bass: A2 alternates with E3
    const bassSemitones = [0, 7, 0, 7, 0, 7, 0, 7]
    const bassFreq = semitone(ROOT_FREQ, bassSemitones[beat])
    this.playNote(bassFreq, BEAT_MS / 1000 * 0.8, 'sawtooth', 0.04, now)

    // Melody: plays on beats 0, 2, 4, 6
    if (beat % 2 === 0) {
      const melodySemitones = [12, 16, 19, 24]
      const melodyFreq = semitone(ROOT_FREQ, melodySemitones[beat / 2])
      this.playNote(melodyFreq, BEAT_MS / 1000 * 0.7, 'square', 0.025, now)
    }

    this.beatIndex++
    this.timeoutId = setTimeout(() => this.schedule(), BEAT_MS)
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
