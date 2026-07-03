// Pooled particle system + screen shake + hit-stop + floating texts.
// Module-level singleton (one game instance per page).

import { FX } from './config'
import { rand, randRange, rgba } from './util'

export type ParticleKind = 'spark' | 'shard' | 'ring' | 'smoke'

export interface Particle {
  alive: boolean
  kind: ParticleKind
  x: number
  y: number
  vx: number
  vy: number
  life: number
  total: number
  size: number
  color: string
  rot: number
  vrot: number
  drag: number
  additive: boolean
}

export interface Floater {
  alive: boolean
  x: number
  y: number
  vy: number
  life: number
  total: number
  text: string
  color: string
  size: number
}

const pool: Particle[] = []
for (let i = 0; i < FX.maxParticles; i++) {
  pool.push({ alive: false, kind: 'spark', x: 0, y: 0, vx: 0, vy: 0, life: 0, total: 1, size: 2, color: '#fff', rot: 0, vrot: 0, drag: 0.9, additive: true })
}
let poolCursor = 0

const floaters: Floater[] = []
for (let i = 0; i < 40; i++) floaters.push({ alive: false, x: 0, y: 0, vy: 0, life: 0, total: 1, text: '', color: '#fff', size: 15 })
let floaterCursor = 0

/** particle spawn multiplier — degraded automatically if the frame budget slips */
export let quality = 1
export function setQuality(q: number) { quality = q }

let trauma = 0
let freezeT = 0

export function addShake(amount: number) {
  trauma = Math.min(1, trauma + amount)
}
export function addFreeze(seconds: number) {
  freezeT = Math.max(freezeT, seconds)
}
export function consumeFreeze(dt: number): boolean {
  if (freezeT > 0) {
    freezeT -= dt
    return true
  }
  return false
}
export function shakeOffset(time: number): { x: number; y: number; r: number } {
  const s = trauma * trauma
  if (s < 0.001) return { x: 0, y: 0, r: 0 }
  const t = time * 39
  return {
    x: Math.sin(t * 1.1 + 2.4) * FX.shakeMax * s,
    y: Math.cos(t * 0.9 + 0.7) * FX.shakeMax * s,
    r: Math.sin(t * 0.63) * 0.008 * s,
  }
}

function next(): Particle {
  const p = pool[poolCursor]
  poolCursor = (poolCursor + 1) % pool.length
  p.alive = true
  return p
}

export function spawn(kind: ParticleKind, x: number, y: number, opts: {
  vx?: number; vy?: number; life?: number; size?: number; color?: string
  vrot?: number; drag?: number; additive?: boolean
}) {
  const p = next()
  p.kind = kind
  p.x = x
  p.y = y
  p.vx = opts.vx ?? 0
  p.vy = opts.vy ?? 0
  p.total = p.life = opts.life ?? 0.5
  p.size = opts.size ?? 3
  p.color = opts.color ?? '#ffffff'
  p.rot = rand() * Math.PI * 2
  p.vrot = opts.vrot ?? 0
  p.drag = opts.drag ?? 2.2
  p.additive = opts.additive ?? true
}

export function burst(x: number, y: number, color: string, count: number, speed = 160, life = 0.55, size = 3.2) {
  const n = Math.round(count * quality)
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2
    const v = speed * (0.35 + rand() * 0.85)
    spawn('spark', x, y, {
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: life * (0.6 + rand() * 0.7),
      size: size * (0.7 + rand() * 0.7),
      color,
    })
  }
}

export function shardBurst(x: number, y: number, color: string, count: number, speed = 200) {
  const n = Math.round(count * quality)
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2
    const v = speed * (0.4 + rand() * 0.9)
    spawn('shard', x, y, {
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: randRange(0.35, 0.8),
      size: randRange(3, 7),
      color,
      vrot: randRange(-9, 9),
      drag: 2.6,
    })
  }
}

export function ring(x: number, y: number, color: string, size: number, life = 0.5) {
  spawn('ring', x, y, { life, size, color, drag: 0 })
}

export function floatText(x: number, y: number, text: string, color: string, size = 16) {
  const f = floaters[floaterCursor]
  floaterCursor = (floaterCursor + 1) % floaters.length
  f.alive = true
  f.x = x
  f.y = y
  f.vy = -34
  f.total = f.life = 1.1
  f.text = text
  f.color = color
  f.size = size
}

export function updateParticles(dt: number) {
  trauma = Math.max(0, trauma - dt * 1.5)
  for (const p of pool) {
    if (!p.alive) continue
    p.life -= dt
    if (p.life <= 0) {
      p.alive = false
      continue
    }
    const d = Math.max(0, 1 - p.drag * dt)
    p.vx *= d
    p.vy *= d
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.rot += p.vrot * dt
  }
  for (const f of floaters) {
    if (!f.alive) continue
    f.life -= dt
    if (f.life <= 0) f.alive = false
    f.y += f.vy * dt
    f.vy *= 1 - 1.8 * dt
  }
}

export function clearParticles() {
  for (const p of pool) p.alive = false
  for (const f of floaters) f.alive = false
  trauma = 0
  freezeT = 0
}

export function drawParticles(ctx: CanvasRenderingContext2D) {
  for (const p of pool) {
    if (!p.alive) continue
    const t = p.life / p.total
    ctx.globalCompositeOperation = p.additive ? 'lighter' : 'source-over'
    switch (p.kind) {
      case 'spark': {
        ctx.globalAlpha = t * 0.9
        ctx.fillStyle = p.color
        const s = p.size * (0.5 + t * 0.5)
        ctx.beginPath()
        ctx.arc(p.x, p.y, s, 0, Math.PI * 2)
        ctx.fill()
        break
      }
      case 'shard': {
        ctx.globalAlpha = t
        ctx.strokeStyle = p.color
        ctx.lineWidth = 1.6
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        const s = p.size
        ctx.beginPath()
        ctx.moveTo(s, 0)
        ctx.lineTo(-s * 0.6, s * 0.55)
        ctx.lineTo(-s * 0.6, -s * 0.55)
        ctx.closePath()
        ctx.stroke()
        ctx.restore()
        break
      }
      case 'ring': {
        const grow = 1 - t
        ctx.globalAlpha = t * 0.8
        ctx.strokeStyle = p.color
        ctx.lineWidth = 2.5 * t + 0.5
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * (0.25 + grow * 0.75), 0, Math.PI * 2)
        ctx.stroke()
        break
      }
      case 'smoke': {
        ctx.globalCompositeOperation = 'source-over'
        ctx.globalAlpha = t * 0.24
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * (1.4 - t * 0.6), 0, Math.PI * 2)
        ctx.fill()
        break
      }
    }
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}

export function drawFloaters(ctx: CanvasRenderingContext2D) {
  ctx.textAlign = 'center'
  for (const f of floaters) {
    if (!f.alive) continue
    const t = f.life / f.total
    ctx.globalAlpha = Math.min(1, t * 2)
    ctx.font = `600 ${f.size}px 'Alegreya Sans SC', serif`
    ctx.fillStyle = f.color
    ctx.strokeStyle = rgba('#000000', 0.6)
    ctx.lineWidth = 3
    ctx.strokeText(f.text, f.x, f.y)
    ctx.fillText(f.text, f.x, f.y)
  }
  ctx.globalAlpha = 1
}
