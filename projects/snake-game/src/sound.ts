export const SoundFX = {
  ctx: null as AudioContext | null,
  masterGain: null as GainNode | null,
  muted: false,
  volume: 0.5,

  init() {
    if (this.ctx) return
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.value = this.muted ? 0 : this.volume
      this.masterGain.connect(this.ctx.destination)
    } catch {
      console.log('Web Audio API 不可用')
    }
  },

  setVolume(v: number) {
    this.volume = v
    localStorage.setItem('snake_volume', String(v))
    if (this.masterGain && !this.muted) {
      this.masterGain.gain.value = v
    }
  },

  getCtx(): AudioContext | null {
    this.init()
    return this.ctx
  },

  getDest(): AudioNode {
    this.init()
    return this.masterGain || this.ctx!.destination
  },

  loadVolume() {
    this.volume = Number(localStorage.getItem('snake_volume')) || 0.5
  },

  toggleMute() {
    this.muted = !this.muted
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : this.volume
    }
    localStorage.setItem('snake_muted', this.muted ? '1' : '0')
    return this.muted
  },

  loadMuteState() {
    this.muted = localStorage.getItem('snake_muted') === '1'
  },

  playEat() {
    if (this.muted) return
    const ctx = this.getCtx()
    if (!ctx) return
    const now = ctx.currentTime
    ;[0, 0.05].forEach((delay, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(800 + i * 300, now + delay)
      osc.frequency.exponentialRampToValueAtTime(1600 + i * 300, now + delay + 0.06)
      gain.gain.setValueAtTime(0.12, now + delay)
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.1)
      osc.connect(gain).connect(this.getDest())
      osc.start(now + delay)
      osc.stop(now + delay + 0.1)
    })
  },

  playDeath() {
    if (this.muted) return
    const ctx = this.getCtx()
    if (!ctx) return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(400, now)
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.5)
    gain.gain.setValueAtTime(0.15, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
    osc.connect(gain).connect(this.getDest())
    osc.start(now)
    osc.stop(now + 0.5)
  },

  playPortal() {
    if (this.muted) return
    const ctx = this.getCtx()
    if (!ctx) return
    const now = ctx.currentTime
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
    }
    const noise = ctx.createBufferSource()
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    noise.buffer = buf
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(2000, now)
    filter.frequency.exponentialRampToValueAtTime(200, now + 0.2)
    filter.Q.setValueAtTime(0.5, now)
    gain.gain.setValueAtTime(0.1, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
    noise.connect(filter).connect(gain).connect(this.getDest())
    noise.start(now)
    noise.stop(now + 0.2)
  },

  playHighScore() {
    if (this.muted) return
    const ctx = this.getCtx()
    if (!ctx) return
    const now = ctx.currentTime
    ;[523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      const t = now + i * 0.12
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0.1, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
      osc.connect(gain).connect(this.getDest())
      osc.start(t)
      osc.stop(t + 0.15)
    })
  },

  playStart() {
    if (this.muted) return
    const ctx = this.getCtx()
    if (!ctx) return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(440, now)
    osc.frequency.setValueAtTime(660, now + 0.06)
    gain.gain.setValueAtTime(0.08, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
    osc.connect(gain).connect(this.getDest())
    osc.start(now)
    osc.stop(now + 0.15)
  },

  playPause() {
    if (this.muted) return
    const ctx = this.getCtx()
    if (!ctx) return
    const now = ctx.currentTime
    ;[0, 0.12].forEach((delay, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(600 - i * 150, now + delay)
      gain.gain.setValueAtTime(0.07, now + delay)
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.08)
      osc.connect(gain).connect(this.getDest())
      osc.start(now + delay)
      osc.stop(now + delay + 0.08)
    })
  },

  playResume() {
    if (this.muted) return
    const ctx = this.getCtx()
    if (!ctx) return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(440, now)
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12)
    gain.gain.setValueAtTime(0.08, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
    osc.connect(gain).connect(this.getDest())
    osc.start(now)
    osc.stop(now + 0.15)
  },

  playTurn() {
    if (this.muted) return
    const ctx = this.getCtx()
    if (!ctx) return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(400, now)
    osc.frequency.exponentialRampToValueAtTime(1000, now + 0.05)
    gain.gain.setValueAtTime(0.06, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07)
    osc.connect(gain).connect(this.getDest())
    osc.start(now)
    osc.stop(now + 0.07)
  },

  playBoost() {
    if (this.muted) return
    const ctx = this.getCtx()
    if (!ctx) return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(200, now)
    osc.frequency.exponentialRampToValueAtTime(2500, now + 0.12)
    gain.gain.setValueAtTime(0.08, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
    osc.connect(gain).connect(this.getDest())
    osc.start(now)
    osc.stop(now + 0.15)
  },
}
