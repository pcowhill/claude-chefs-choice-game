// Small math / random helpers. No game imports.

export interface Vec { x: number; y: number }

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const dist2 = (ax: number, ay: number, bx: number, by: number) => {
  const dx = bx - ax, dy = by - ay
  return dx * dx + dy * dy
}
export const dist = (ax: number, ay: number, bx: number, by: number) => Math.sqrt(dist2(ax, ay, bx, by))

export const angleTo = (ax: number, ay: number, bx: number, by: number) => Math.atan2(by - ay, bx - ax)

/** shortest signed angular difference a→b in (-PI, PI] */
export const angDiff = (a: number, b: number) => {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

export const turnToward = (ang: number, target: number, maxStep: number) => {
  const d = angDiff(ang, target)
  return ang + clamp(d, -maxStep, maxStep)
}

// easing
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
export const easeInCubic = (t: number) => t * t * t
export const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t)
export const easeInOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

// ---------------------------------------------------------------------------
// Deterministic-ish RNG (mulberry32). One global stream is fine for gameplay.
// ---------------------------------------------------------------------------
let rngState = (Math.random() * 0xffffffff) >>> 0
export function seedRng(seed: number) { rngState = seed >>> 0 }
export function rand(): number {
  rngState = (rngState + 0x6d2b79f5) >>> 0
  let t = rngState
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
export const randRange = (lo: number, hi: number) => lo + rand() * (hi - lo)
export const randInt = (lo: number, hi: number) => Math.floor(randRange(lo, hi + 1))
export const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]

/** weighted pick from a record of weights */
export function pickWeighted<K extends string>(weights: Partial<Record<K, number>>): K {
  let total = 0
  for (const k in weights) total += weights[k as K] ?? 0
  let r = rand() * total
  let last: K | null = null
  for (const k in weights) {
    const w = weights[k as K] ?? 0
    if (w <= 0) continue
    last = k as K
    r -= w
    if (r <= 0) return k as K
  }
  return last as K
}

/** format 12345 -> "12,345" */
export const fmt = (n: number) => Math.round(n).toLocaleString('en-US')

/** format seconds -> "12:34" */
export const fmtTime = (s: number) => {
  const m = Math.floor(s / 60)
  const ss = Math.floor(s % 60)
  return `${m}:${ss.toString().padStart(2, '0')}`
}

export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'] as const
export const roman = (n: number) => (n <= 12 ? ROMAN[n - 1] : `XII+${n - 12}`)

/** color helper: hex -> rgba string with alpha */
export function rgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}
