// Procedural audio: every sound in the game is synthesized with the Web Audio
// API — no audio files. A small generative score (drone + pads + plucked
// arpeggio in D minor) deepens with the night; SFX are tiny fire-and-forget
// synth graphs. See ASSETS.md.

interface AudioSettings {
  music: number
  sfx: number
  muted: boolean
}

const LS_KEY = 'wyrmlight.audio'

function loadSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const s = JSON.parse(raw)
      return { music: s.music ?? 0.8, sfx: s.sfx ?? 0.9, muted: !!s.muted }
    }
  } catch { /* ignore */ }
  return { music: 0.8, sfx: 0.9, muted: false }
}

// note helper: D minor world
const NOTE = (semisFromA4: number) => 440 * Math.pow(2, semisFromA4 / 12)
// D across octaves: D2=-19, D3=-7, D4=+5 (semitones from A4)
const D2 = NOTE(-31) // 73.4
const D1 = D2 / 2

// chord progressions as semitone offsets from A4
const NIGHT_CHORDS: number[][] = [
  [-19, -12, -7, 0],   // D3 A3 D4... actually: D3(-19) A3(-12) D4(-7)? recompute below
]
// Let's define explicitly in Hz-friendly semitones (from A4):
// Dm: D3 -19, F3 -16, A3 -12, C4 -9 | Bb: Bb2 -23, D3 -19, F3 -16 | F: F3 -16, A3 -12, C4 -9 | C: C3 -21, E3 -17, G3 -14
NIGHT_CHORDS.length = 0
NIGHT_CHORDS.push(
  [-19, -16, -12, -9],
  [-23, -19, -16, -12],
  [-28, -16, -12, -9],
  [-21, -17, -14, -9],
)
const DAWN_CHORDS: number[][] = [
  [-19, -15, -12, -7], // D major: D F# A D
  [-14, -10, -7, -2],  // G: G B D G
  [-24, -12, -10, -5], // Bm-ish
  [-16, -12, -9, -4],  // A-ish colour
]
const NIGHT_SCALE = [-19, -16, -14, -12, -9, -7, -4, -2, 5] // D min pent + 9 across octaves
const DAWN_SCALE = [-19, -15, -12, -10, -7, -5, -3, 5]

export type MusicMode = 'title' | 'battle' | 'dawn' | 'defeat' | 'off'

class AudioEngine {
  ctx: AudioContext | null = null
  private master: GainNode | null = null
  private musicBus: GainNode | null = null
  private sfxBus: GainNode | null = null
  private noiseBuf: AudioBuffer | null = null

  settings = loadSettings()

  // music state
  private mode: MusicMode = 'off'
  intensity = 0.3
  private nextChord = 0
  private chordIdx = 0
  private nextArp = 0
  private droneGain: GainNode | null = null
  private subGain: GainNode | null = null
  private surgeGain: GainNode | null = null

  private throttle = new Map<string, number>()

  get unlocked() { return !!this.ctx }

  /** call from a user gesture */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    try {
      this.ctx = new AudioContext()
    } catch {
      return
    }
    const c = this.ctx
    this.master = c.createGain()
    this.master.connect(c.destination)
    this.musicBus = c.createGain()
    this.musicBus.connect(this.master)
    this.sfxBus = c.createGain()
    this.sfxBus.connect(this.master)
    this.applySettings()

    // shared noise buffer
    const len = c.sampleRate
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate)
    const data = this.noiseBuf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1

    // persistent drone (D2 + slightly detuned octave)
    this.droneGain = c.createGain()
    this.droneGain.gain.value = 0
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 240
    this.droneGain.connect(lp)
    lp.connect(this.musicBus)
    for (const [f, t, g] of [[D2, 'sine', 0.5], [D2 * 1.003, 'triangle', 0.22], [D2 / 2, 'sine', 0.35]] as [number, OscillatorType, number][]) {
      const o = c.createOscillator()
      o.type = t
      o.frequency.value = f
      const og = c.createGain()
      og.gain.value = g
      o.connect(og)
      og.connect(this.droneGain)
      o.start()
    }

    // boss sub-throb (LFO'd D1 sine)
    this.subGain = c.createGain()
    this.subGain.gain.value = 0
    const sub = c.createOscillator()
    sub.type = 'sine'
    sub.frequency.value = D1
    const lfo = c.createOscillator()
    lfo.frequency.value = 1.6
    const lfoG = c.createGain()
    lfoG.gain.value = 0.5
    const subCarrier = c.createGain()
    subCarrier.gain.value = 0.5
    lfo.connect(lfoG)
    lfoG.connect(subCarrier.gain)
    sub.connect(subCarrier)
    subCarrier.connect(this.subGain)
    this.subGain.connect(this.musicBus)
    sub.start()
    lfo.start()

    // surge wind loop (noise through bandpass, gain ridden by gameplay)
    const src = c.createBufferSource()
    src.buffer = this.noiseBuf
    src.loop = true
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1400
    bp.Q.value = 0.6
    this.surgeGain = c.createGain()
    this.surgeGain.gain.value = 0
    src.connect(bp)
    bp.connect(this.surgeGain)
    this.surgeGain.connect(this.sfxBus)
    src.start()

    // scheduler
    this.nextChord = c.currentTime + 0.1
    this.nextArp = c.currentTime + 0.5
    window.setInterval(() => this.schedule(), 60)
  }

  applySettings() {
    if (!this.master || !this.musicBus || !this.sfxBus) return
    this.master.gain.value = this.settings.muted ? 0 : 1
    this.musicBus.gain.value = this.settings.music * 0.9
    this.sfxBus.gain.value = this.settings.sfx
    try { localStorage.setItem(LS_KEY, JSON.stringify(this.settings)) } catch { /* ignore */ }
  }

  setMode(m: MusicMode) {
    if (this.mode === m) return
    this.mode = m
    if (m === 'dawn' || m === 'defeat') this.chordIdx = 0
  }

  setSurge(on: boolean) {
    if (!this.ctx || !this.surgeGain) return
    const t = this.ctx.currentTime
    this.surgeGain.gain.setTargetAtTime(on ? 0.055 : 0, t, 0.08)
  }

  // -------------------------------------------------------------------------
  // generative score
  // -------------------------------------------------------------------------
  private schedule() {
    const c = this.ctx
    if (!c || !this.musicBus) return
    const ahead = c.currentTime + 0.35

    const inten = this.mode === 'title' ? 0.22
      : this.mode === 'dawn' ? 0.75
      : this.mode === 'defeat' ? 0.12
      : this.mode === 'off' ? 0
      : this.intensity

    if (this.droneGain) this.droneGain.gain.setTargetAtTime(this.mode === 'off' ? 0 : 0.05 + 0.075 * inten, c.currentTime, 0.5)
    if (this.subGain) this.subGain.gain.setTargetAtTime(this.mode === 'battle' && inten > 0.85 ? 0.12 : 0, c.currentTime, 0.8)

    if (this.mode === 'off') return
    const chords = this.mode === 'dawn' ? DAWN_CHORDS : NIGHT_CHORDS
    const scale = this.mode === 'dawn' ? DAWN_SCALE : NIGHT_SCALE

    // pads on a slow cycle
    const chordLen = this.mode === 'defeat' ? 9.5 : 7.5
    while (this.nextChord < ahead) {
      const chord = chords[this.chordIdx % chords.length]
      this.chordIdx++
      if (this.mode !== 'defeat' || this.chordIdx < 3) {
        const padGain = 0.05 + 0.05 * inten
        for (const semi of chord) {
          this.pad(NOTE(semi), this.nextChord, chordLen + 2.5, padGain / chord.length * 3, 420 + 700 * inten)
        }
      }
      this.nextChord += chordLen
    }

    // plucked arp on a 0.25s grid, probabilistic density
    const grid = 0.25
    while (this.nextArp < ahead) {
      const p = this.mode === 'defeat' ? 0.05 : 0.1 + 0.5 * inten
      if (Math.random() < p) {
        const semi = scale[Math.floor(Math.random() * scale.length)]
        const oct = Math.random() < 0.3 ? 12 : 0
        this.pluck(NOTE(semi + oct), this.nextArp, 0.05 + 0.05 * inten * Math.random())
      }
      this.nextArp += grid
    }
  }

  private pad(freq: number, at: number, dur: number, vol: number, lpf: number) {
    const c = this.ctx!
    const o = c.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = freq
    const o2 = c.createOscillator()
    o2.type = 'sawtooth'
    o2.frequency.value = freq * 1.006
    const f = c.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = lpf
    f.Q.value = 0.3
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.linearRampToValueAtTime(vol, at + dur * 0.35)
    g.gain.setValueAtTime(vol, at + dur * 0.6)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    o.connect(f); o2.connect(f)
    f.connect(g)
    g.connect(this.musicBus!)
    o.start(at); o2.start(at)
    o.stop(at + dur + 0.1); o2.stop(at + dur + 0.1)
  }

  private pluck(freq: number, at: number, vol: number) {
    const c = this.ctx!
    const o = c.createOscillator()
    o.type = 'triangle'
    o.frequency.value = freq
    const g = c.createGain()
    g.gain.setValueAtTime(vol, at)
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.9)
    o.connect(g)
    g.connect(this.musicBus!)
    o.start(at)
    o.stop(at + 1)
  }

  // -------------------------------------------------------------------------
  // SFX
  // -------------------------------------------------------------------------
  private canPlay(name: string, minGap: number): boolean {
    if (!this.ctx || !this.sfxBus) return false
    const t = performance.now()
    const last = this.throttle.get(name) ?? -1e9
    if (t - last < minGap) return false
    this.throttle.set(name, t)
    return true
  }

  private tone(opts: { f0: number; f1?: number; dur: number; type?: OscillatorType; vol?: number; at?: number; curve?: 'exp' | 'lin' }) {
    const c = this.ctx!
    const at = opts.at ?? c.currentTime
    const o = c.createOscillator()
    o.type = opts.type ?? 'sine'
    o.frequency.setValueAtTime(opts.f0, at)
    if (opts.f1 !== undefined) {
      o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.f1), at + opts.dur)
    }
    const g = c.createGain()
    const v = opts.vol ?? 0.15
    g.gain.setValueAtTime(v, at)
    g.gain.exponentialRampToValueAtTime(0.0001, at + opts.dur)
    o.connect(g)
    g.connect(this.sfxBus!)
    o.start(at)
    o.stop(at + opts.dur + 0.05)
  }

  private noise(opts: { dur: number; vol?: number; lpf?: number; hpf?: number; bpf?: number; q?: number; at?: number }) {
    const c = this.ctx!
    if (!this.noiseBuf) return
    const at = opts.at ?? c.currentTime
    const src = c.createBufferSource()
    src.buffer = this.noiseBuf
    src.loop = true
    src.playbackRate.value = 0.7 + Math.random() * 0.6
    let node: AudioNode = src
    if (opts.bpf) {
      const f = c.createBiquadFilter()
      f.type = 'bandpass'
      f.frequency.value = opts.bpf
      f.Q.value = opts.q ?? 1
      node.connect(f)
      node = f
    }
    if (opts.lpf) {
      const f = c.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = opts.lpf
      node.connect(f)
      node = f
    }
    if (opts.hpf) {
      const f = c.createBiquadFilter()
      f.type = 'highpass'
      f.frequency.value = opts.hpf
      node.connect(f)
      node = f
    }
    const g = c.createGain()
    g.gain.setValueAtTime(opts.vol ?? 0.12, at)
    g.gain.exponentialRampToValueAtTime(0.0001, at + opts.dur)
    node.connect(g)
    g.connect(this.sfxBus!)
    src.start(at)
    src.stop(at + opts.dur + 0.05)
  }

  private bell(freq: number, at: number, vol = 0.14, dur = 0.5) {
    this.tone({ f0: freq, dur, type: 'sine', vol, at })
    this.tone({ f0: freq * 2.01, dur: dur * 0.7, type: 'sine', vol: vol * 0.4, at })
    this.tone({ f0: freq * 2.99, dur: dur * 0.4, type: 'sine', vol: vol * 0.15, at })
  }

  play(name: string, opt?: { pitch?: number }) {
    if (!this.ctx || !this.sfxBus) return
    const c = this.ctx
    const t = c.currentTime
    const pitch = opt?.pitch ?? 1
    switch (name) {
      case 'shoot':
        if (!this.canPlay('shoot', 30)) return
        this.tone({ f0: (700 + Math.random() * 260) * pitch, f1: 320, dur: 0.07, type: 'square', vol: 0.05 })
        break
      case 'zap':
        if (!this.canPlay('zap', 55)) return
        this.tone({ f0: 1400 + Math.random() * 500, f1: 180, dur: 0.09, type: 'sawtooth', vol: 0.07 })
        this.noise({ dur: 0.08, vol: 0.06, bpf: 2400, q: 1.4 })
        break
      case 'emberLaunch':
        if (!this.canPlay('emberLaunch', 60)) return
        this.tone({ f0: 170, f1: 80, dur: 0.16, type: 'sine', vol: 0.12 })
        break
      case 'emberBoom':
        if (!this.canPlay('emberBoom', 70)) return
        this.noise({ dur: 0.3, vol: 0.16, lpf: 900 })
        this.tone({ f0: 130, f1: 42, dur: 0.32, type: 'sine', vol: 0.2 })
        break
      case 'prismOn':
        if (!this.canPlay('prismOn', 300)) return
        this.tone({ f0: 880, f1: 1320, dur: 0.25, type: 'sine', vol: 0.05 })
        break
      case 'eat': {
        if (!this.canPlay('eat', 60)) return
        this.bell(520 * pitch, t, 0.13, 0.4)
        this.tone({ f0: 120, f1: 60, dur: 0.1, type: 'sine', vol: 0.1 })
        break
      }
      case 'upgrade':
        this.bell(660, t, 0.12, 0.35)
        this.bell(990, t + 0.09, 0.1, 0.4)
        break
      case 'segHurt':
        if (!this.canPlay('segHurt', 90)) return
        this.noise({ dur: 0.08, vol: 0.09, lpf: 600 })
        break
      case 'segLost':
        if (!this.canPlay('segLost', 120)) return
        this.noise({ dur: 0.2, vol: 0.16, lpf: 1100 })
        this.tone({ f0: 300, f1: 70, dur: 0.25, type: 'square', vol: 0.08 })
        break
      case 'headHurt':
        this.tone({ f0: 210, f1: 160, dur: 0.12, type: 'square', vol: 0.16 })
        this.tone({ f0: 160, f1: 110, dur: 0.16, type: 'square', vol: 0.14, at: t + 0.09 })
        this.noise({ dur: 0.18, vol: 0.1, lpf: 1400 })
        break
      case 'starHurt':
        if (!this.canPlay('starHurt', 160)) return
        this.tone({ f0: 98, dur: 1.1, type: 'sine', vol: 0.22 })
        this.tone({ f0: 147.6, dur: 0.9, type: 'sine', vol: 0.12 })
        this.noise({ dur: 0.15, vol: 0.12, lpf: 500 })
        break
      case 'molt':
        this.noise({ dur: 0.3, vol: 0.14, bpf: 900, q: 0.7 })
        this.tone({ f0: 240, f1: 500, dur: 0.25, type: 'sine', vol: 0.08 })
        break
      case 'moltBoom':
        this.noise({ dur: 0.45, vol: 0.22, lpf: 1200 })
        this.tone({ f0: 95, f1: 28, dur: 0.5, type: 'sine', vol: 0.26 })
        break
      case 'decoyWarble':
        this.tone({ f0: 330, f1: 260, dur: 0.18, type: 'triangle', vol: 0.07 })
        this.tone({ f0: 392, f1: 300, dur: 0.18, type: 'triangle', vol: 0.06, at: t + 0.16 })
        break
      case 'waveHorn': {
        for (const det of [1, 1.006]) {
          const o = c.createOscillator()
          o.type = 'sawtooth'
          o.frequency.value = 146.8 * det // D3
          const f = c.createBiquadFilter()
          f.type = 'lowpass'
          f.frequency.setValueAtTime(300, t)
          f.frequency.linearRampToValueAtTime(1400, t + 0.7)
          f.frequency.linearRampToValueAtTime(500, t + 1.6)
          const g = c.createGain()
          g.gain.setValueAtTime(0.0001, t)
          g.gain.linearRampToValueAtTime(0.09, t + 0.5)
          g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7)
          o.connect(f); f.connect(g); g.connect(this.sfxBus)
          o.start(t)
          o.stop(t + 1.8)
        }
        break
      }
      case 'bossRoar': {
        for (const f0 of [55, 82.5, 66]) {
          const o = c.createOscillator()
          o.type = 'sawtooth'
          o.frequency.setValueAtTime(f0 * 1.4, t)
          o.frequency.exponentialRampToValueAtTime(f0 * 0.8, t + 1.1)
          const g = c.createGain()
          g.gain.setValueAtTime(0.09, t)
          g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3)
          const lp = c.createBiquadFilter()
          lp.type = 'lowpass'
          lp.frequency.value = 700
          o.connect(lp); lp.connect(g); g.connect(this.sfxBus)
          o.start(t)
          o.stop(t + 1.4)
        }
        this.noise({ dur: 1.0, vol: 0.12, lpf: 400 })
        break
      }
      case 'spit':
        if (!this.canPlay('spit', 80)) return
        this.tone({ f0: 500, f1: 190, dur: 0.12, type: 'triangle', vol: 0.06 })
        break
      case 'hourClear':
        this.bell(440, t, 0.1, 0.7)
        this.bell(587, t + 0.14, 0.1, 0.7)
        this.bell(880, t + 0.28, 0.08, 1.0)
        break
      case 'draftPick':
        this.bell(587, t, 0.12, 0.4)
        this.bell(880, t + 0.1, 0.1, 0.6)
        break
      case 'uiHover':
        if (!this.canPlay('uiHover', 40)) return
        this.tone({ f0: 1150, dur: 0.035, type: 'sine', vol: 0.025 })
        break
      case 'uiClick':
        this.tone({ f0: 740, f1: 900, dur: 0.06, type: 'sine', vol: 0.07 })
        break
      case 'dawn': {
        const notes = [293.66, 369.99, 440, 587.33, 739.99, 880]
        notes.forEach((f, i) => this.bell(f, t + i * 0.22, 0.13, 1.6))
        break
      }
      case 'defeat': {
        const notes = [220, 174.6, 146.8]
        notes.forEach((f, i) => {
          this.tone({ f0: f, dur: 1.6, type: 'sine', vol: 0.15, at: t + i * 0.9 })
          this.tone({ f0: f * 2.01, dur: 1.2, type: 'sine', vol: 0.05, at: t + i * 0.9 })
        })
        break
      }
      case 'ram':
        if (!this.canPlay('ram', 70)) return
        this.noise({ dur: 0.1, vol: 0.1, bpf: 700, q: 1 })
        break
      case 'stingerDie':
        if (!this.canPlay('stingerDie', 60)) return
        this.tone({ f0: 900, f1: 200, dur: 0.14, type: 'sawtooth', vol: 0.06 })
        break
      case 'enemyDie':
        if (!this.canPlay('enemyDie', 45)) return
        this.noise({ dur: 0.12, vol: 0.07, bpf: 500 + Math.random() * 400, q: 1.2 })
        this.tone({ f0: 260 + Math.random() * 120, f1: 60, dur: 0.14, type: 'triangle', vol: 0.05 })
        break
      case 'bigDie':
        this.noise({ dur: 0.4, vol: 0.16, lpf: 800 })
        this.tone({ f0: 180, f1: 40, dur: 0.45, type: 'sine', vol: 0.18 })
        break
      case 'sunEat':
        this.bell(880, t, 0.13, 0.6)
        this.bell(1174.7, t + 0.12, 0.11, 0.8)
        break
    }
  }
}

export const audio = new AudioEngine()
