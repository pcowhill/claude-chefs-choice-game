// Pre-rendered sprites. Everything in WYRMLIGHT is drawn from code — these
// offscreen canvases are the "asset pack". Visual language:
//   serpent  = dark plates with gilt rims and bright cores (things of light)
//   enemies  = black voids with burning rims (holes in the night)
// All sprites are rendered at SS×supersampling and drawn back at 1/SS scale.

import { PAL, type EnemyKind, type TurretKind } from './config'
import type { MoteKind } from './types'
import { rgba } from './util'

const SS = 2 // supersample factor

export interface Sprite {
  c: HTMLCanvasElement
  /** world-space half-width when drawn (canvas px / (2*SS)) */
  half: number
}

const cache = new Map<string, Sprite>()

function make(key: string, worldSize: number, draw: (g: CanvasRenderingContext2D, s: number) => void): Sprite {
  const hit = cache.get(key)
  if (hit) return hit
  const px = Math.ceil(worldSize * SS)
  const c = document.createElement('canvas')
  c.width = px
  c.height = px
  const g = c.getContext('2d')!
  g.translate(px / 2, px / 2)
  draw(g, px / 2)
  const spr: Sprite = { c, half: worldSize / 2 }
  cache.set(key, spr)
  return spr
}

/** draw centered at (x,y), optionally rotated/scaled */
export function blit(ctx: CanvasRenderingContext2D, s: Sprite, x: number, y: number, rot = 0, scale = 1, alpha = 1) {
  ctx.save()
  ctx.globalAlpha *= alpha
  ctx.translate(x, y)
  if (rot !== 0) ctx.rotate(rot)
  const sz = (s.half * 2) * scale
  ctx.drawImage(s.c, -sz / 2, -sz / 2, sz, sz)
  ctx.restore()
}

// ---------------------------------------------------------------------------
// Soft additive glow dot — the workhorse of the whole look.
// ---------------------------------------------------------------------------
export function glow(color: string, r: number, hard = 0.28): Sprite {
  return make(`glow:${color}:${r}:${hard}`, r * 2.2, (g, s) => {
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, s)
    grad.addColorStop(0, rgba(color, 0.85))
    grad.addColorStop(hard, rgba(color, 0.32))
    grad.addColorStop(1, rgba(color, 0))
    g.fillStyle = grad
    g.fillRect(-s, -s, s * 2, s * 2)
  })
}

// ---------------------------------------------------------------------------
// Serpent segment plates
// ---------------------------------------------------------------------------
function drawGlyph(g: CanvasRenderingContext2D, kind: TurretKind, r: number, color: string) {
  g.strokeStyle = color
  g.fillStyle = color
  g.lineWidth = r * 0.22
  g.lineJoin = 'round'
  g.lineCap = 'round'
  const s = r * 0.52
  g.beginPath()
  switch (kind) {
    case 'fang': // fang triangle
      g.moveTo(0, -s)
      g.lineTo(s * 0.8, s * 0.7)
      g.lineTo(-s * 0.8, s * 0.7)
      g.closePath()
      g.fill()
      break
    case 'storm': // bolt
      g.moveTo(s * 0.35, -s)
      g.lineTo(-s * 0.45, s * 0.15)
      g.lineTo(s * 0.05, s * 0.15)
      g.lineTo(-s * 0.35, s)
      g.stroke()
      break
    case 'frost': { // snowflake
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        g.moveTo(0, 0)
        g.lineTo(Math.cos(a) * s, Math.sin(a) * s)
      }
      g.stroke()
      break
    }
    case 'ember': // droplet-diamond
      g.moveTo(0, -s)
      g.lineTo(s * 0.7, 0)
      g.lineTo(0, s)
      g.lineTo(-s * 0.7, 0)
      g.closePath()
      g.fill()
      break
    case 'prism': { // 4-point star
      const q = s * 0.36
      g.moveTo(0, -s)
      g.quadraticCurveTo(0, -q, q, 0) // hmm quads make petals
      g.quadraticCurveTo(0, q, 0, s)
      g.quadraticCurveTo(0, q, -q, 0)
      g.quadraticCurveTo(0, -q, 0, -s)
      g.closePath()
      g.fill()
      g.beginPath()
      g.moveTo(-s, 0)
      g.quadraticCurveTo(-q, 0, 0, q * 0.9)
      g.quadraticCurveTo(q, 0, s, 0)
      g.quadraticCurveTo(q, 0, 0, -q * 0.9)
      g.quadraticCurveTo(-q, 0, -s, 0)
      g.closePath()
      g.fill()
      break
    }
  }
}

export function segmentSprite(kind: TurretKind, tier: 1 | 2 | 3, radius: number): Sprite {
  const color = PAL[kind]
  const pad = 1.7 // room for tier rings
  return make(`seg:${kind}:${tier}:${radius}`, radius * 2 * pad, (g, s) => {
    const r = s / pad
    // under-glow
    const halo = g.createRadialGradient(0, 0, r * 0.4, 0, 0, s)
    halo.addColorStop(0, rgba(color, 0.28))
    halo.addColorStop(1, rgba(color, 0))
    g.fillStyle = halo
    g.fillRect(-s, -s, s * 2, s * 2)
    // plate
    const plate = g.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r)
    plate.addColorStop(0, '#3a2e1c')
    plate.addColorStop(0.55, PAL.serpentPlate)
    plate.addColorStop(1, '#15100a')
    g.fillStyle = plate
    g.beginPath()
    g.arc(0, 0, r, 0, Math.PI * 2)
    g.fill()
    // gilt rim
    g.lineWidth = r * 0.16
    g.strokeStyle = PAL.serpentRim
    g.beginPath()
    g.arc(0, 0, r * 0.92, 0, Math.PI * 2)
    g.stroke()
    // core
    const coreR = r * 0.62
    const core = g.createRadialGradient(0, 0, 0, 0, 0, coreR)
    core.addColorStop(0, rgba(color, tier === 3 ? 0.95 : 0.75))
    core.addColorStop(1, rgba(color, 0.08))
    g.fillStyle = core
    g.beginPath()
    g.arc(0, 0, coreR, 0, Math.PI * 2)
    g.fill()
    drawGlyph(g, kind, coreR * 0.95, tier === 1 ? rgba('#ffffff', 0.85) : '#ffffff')
    // tier rings
    if (tier >= 2) {
      g.lineWidth = r * 0.09
      g.strokeStyle = rgba(color, 0.9)
      g.beginPath()
      g.arc(0, 0, r * 1.16, 0, Math.PI * 2)
      g.stroke()
    }
    if (tier >= 3) {
      g.lineWidth = r * 0.07
      g.strokeStyle = rgba('#ffffff', 0.75)
      g.beginPath()
      g.arc(0, 0, r * 1.34, 0, Math.PI * 2)
      g.stroke()
    }
  })
}

export function headSprite(radius: number): Sprite {
  // drawn facing +x
  return make(`head:${radius}`, radius * 2 * 1.9, (g, s) => {
    const r = s / 1.9
    // crest fins (behind)
    g.fillStyle = PAL.goldDeep
    for (const side of [-1, 1]) {
      g.beginPath()
      g.moveTo(-r * 0.15, side * r * 0.55)
      g.lineTo(-r * 1.55, side * r * 1.05)
      g.lineTo(-r * 0.72, side * r * 0.12)
      g.closePath()
      g.fill()
    }
    g.beginPath() // rear spine fin
    g.moveTo(-r * 0.5, 0)
    g.lineTo(-r * 1.75, 0)
    g.lineTo(-r * 0.75, -r * 0.3)
    g.closePath()
    g.fill()
    // skull plate — slightly elongated
    const plate = g.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.1, 0, 0, r * 1.1)
    plate.addColorStop(0, '#4a3a20')
    plate.addColorStop(0.5, PAL.serpentPlate)
    plate.addColorStop(1, '#141008')
    g.fillStyle = plate
    g.beginPath()
    g.ellipse(0, 0, r * 1.06, r * 0.88, 0, 0, Math.PI * 2)
    g.fill()
    g.lineWidth = r * 0.14
    g.strokeStyle = PAL.serpentRim
    g.beginPath()
    g.ellipse(0, 0, r * 0.97, r * 0.8, 0, 0, Math.PI * 2)
    g.stroke()
    // brow chevron
    g.strokeStyle = rgba(PAL.gold, 0.9)
    g.lineWidth = r * 0.1
    g.beginPath()
    g.moveTo(r * 0.15, -r * 0.45)
    g.lineTo(r * 0.62, 0)
    g.lineTo(r * 0.15, r * 0.45)
    g.stroke()
    // eyes
    g.fillStyle = '#fff6dd'
    for (const side of [-1, 1]) {
      g.beginPath()
      g.ellipse(r * 0.3, side * r * 0.34, r * 0.16, r * 0.11, side * 0.5, 0, Math.PI * 2)
      g.fill()
    }
  })
}

// ---------------------------------------------------------------------------
// Enemies — holes in the night with burning rims
// ---------------------------------------------------------------------------
function voidBody(g: CanvasRenderingContext2D, path: () => void, rim: string, r: number, rimW = 0.18) {
  // outer heat glow
  g.save()
  g.shadowColor = rim
  g.shadowBlur = r * 0.8
  g.fillStyle = '#050208'
  path()
  g.fill()
  g.restore()
  // burning rim
  g.lineWidth = r * rimW
  g.strokeStyle = rim
  path()
  g.stroke()
  // inner void
  g.fillStyle = '#020104'
  path()
  g.save()
  g.clip()
  g.fill()
  g.restore()
}

export function enemySprite(kind: EnemyKind, radius: number): Sprite {
  const pad = kind === 'eclipse' ? 2.3 : 1.9
  return make(`en:${kind}:${radius}`, radius * 2 * pad, (g, s) => {
    const r = s / pad
    switch (kind) {
      case 'mite': {
        const spikes = 5
        const path = () => {
          g.beginPath()
          for (let i = 0; i < spikes * 2; i++) {
            const a = (i / (spikes * 2)) * Math.PI * 2
            const rr = i % 2 === 0 ? r : r * 0.62
            g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
          }
          g.closePath()
        }
        voidBody(g, path, PAL.enemy, r, 0.22)
        g.fillStyle = rgba(PAL.enemy, 0.9)
        g.beginPath()
        g.arc(0, 0, r * 0.18, 0, Math.PI * 2)
        g.fill()
        break
      }
      case 'stinger': {
        // dart facing +x
        const path = () => {
          g.beginPath()
          g.moveTo(r * 1.15, 0)
          g.lineTo(-r * 0.5, -r * 0.55)
          g.lineTo(-r * 0.15, 0)
          g.lineTo(-r * 0.5, r * 0.55)
          g.closePath()
        }
        voidBody(g, path, PAL.stinger, r, 0.2)
        // barbs
        g.strokeStyle = rgba(PAL.stinger, 0.85)
        g.lineWidth = r * 0.12
        g.beginPath()
        g.moveTo(-r * 0.5, -r * 0.55)
        g.lineTo(-r * 1.0, -r * 0.85)
        g.moveTo(-r * 0.5, r * 0.55)
        g.lineTo(-r * 1.0, r * 0.85)
        g.stroke()
        break
      }
      case 'spitter': {
        const path = () => {
          g.beginPath()
          g.arc(0, 0, r * 0.9, 0.5, Math.PI * 2 - 0.5) // open maw gap faces +x
          g.lineTo(r * 0.25, 0)
          g.closePath()
        }
        voidBody(g, path, PAL.spitter, r, 0.2)
        g.strokeStyle = rgba(PAL.spitter, 0.6)
        g.lineWidth = r * 0.1
        g.beginPath()
        g.arc(0, 0, r * 0.55, 0.7, Math.PI * 2 - 0.7)
        g.stroke()
        break
      }
      case 'splitter': {
        const lobes = [
          { x: 0, y: -r * 0.42 },
          { x: -r * 0.4, y: r * 0.3 },
          { x: r * 0.4, y: r * 0.3 },
        ]
        const path = () => {
          g.beginPath()
          for (const l of lobes) {
            g.moveTo(l.x + r * 0.55, l.y)
            g.arc(l.x, l.y, r * 0.55, 0, Math.PI * 2)
          }
        }
        voidBody(g, path, PAL.splitter, r, 0.16)
        g.fillStyle = rgba(PAL.splitter, 0.8)
        for (const l of lobes) {
          g.beginPath()
          g.arc(l.x, l.y, r * 0.12, 0, Math.PI * 2)
          g.fill()
        }
        break
      }
      case 'husk': {
        const path = () => {
          g.beginPath()
          const pts = 7
          for (let i = 0; i < pts; i++) {
            const a = (i / pts) * Math.PI * 2 + 0.35
            const rr = r * (i % 2 === 0 ? 1 : 0.86)
            g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
          }
          g.closePath()
        }
        voidBody(g, path, PAL.husk, r, 0.15)
        // fracture lines
        g.strokeStyle = rgba(PAL.husk, 0.55)
        g.lineWidth = r * 0.07
        g.beginPath()
        g.moveTo(-r * 0.5, -r * 0.4)
        g.lineTo(r * 0.1, 0)
        g.lineTo(-r * 0.35, r * 0.5)
        g.moveTo(r * 0.55, -r * 0.45)
        g.lineTo(r * 0.2, r * 0.15)
        g.stroke()
        g.fillStyle = rgba(PAL.husk, 0.9)
        g.beginPath()
        g.arc(r * 0.05, 0, r * 0.13, 0, Math.PI * 2)
        g.fill()
        break
      }
      case 'maw': {
        const path = () => {
          g.beginPath()
          g.arc(0, 0, r, 0, Math.PI * 2)
        }
        voidBody(g, path, PAL.boss, r, 0.12)
        // inward teeth ring
        g.fillStyle = rgba(PAL.boss, 0.85)
        const teeth = 11
        for (let i = 0; i < teeth; i++) {
          const a = (i / teeth) * Math.PI * 2
          const c = Math.cos(a), sn = Math.sin(a)
          g.beginPath()
          g.moveTo(c * r * 0.86, sn * r * 0.86)
          const a2 = a + 0.16, a3 = a - 0.16
          g.lineTo(Math.cos(a2) * r * 0.6, Math.sin(a2) * r * 0.6)
          g.lineTo(Math.cos(a3) * r * 0.6, Math.sin(a3) * r * 0.6)
          g.closePath()
          g.fill()
        }
        g.fillStyle = '#ffb0bb'
        g.beginPath()
        g.arc(0, 0, r * 0.1, 0, Math.PI * 2)
        g.fill()
        break
      }
      case 'eclipse': {
        // black disc with blinding corona — an eclipse
        const halo = g.createRadialGradient(0, 0, r * 0.85, 0, 0, r * 2.1)
        halo.addColorStop(0, rgba('#fff0c8', 0.5))
        halo.addColorStop(0.25, rgba(PAL.boss, 0.25))
        halo.addColorStop(1, 'rgba(0,0,0,0)')
        g.fillStyle = halo
        g.fillRect(-s, -s, s * 2, s * 2)
        // dark rays
        g.strokeStyle = rgba('#2a0714', 0.9)
        g.lineWidth = r * 0.16
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2
          g.beginPath()
          g.moveTo(Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05)
          g.lineTo(Math.cos(a) * r * (1.55 + (i % 3) * 0.25), Math.sin(a) * r * (1.55 + (i % 3) * 0.25))
          g.stroke()
        }
        // corona ring
        g.lineWidth = r * 0.09
        g.strokeStyle = '#fff3d6'
        g.beginPath()
        g.arc(0, 0, r, 0, Math.PI * 2)
        g.stroke()
        // void disc
        g.fillStyle = '#010003'
        g.beginPath()
        g.arc(0, 0, r * 0.97, 0, Math.PI * 2)
        g.fill()
        // faint crimson eye
        g.fillStyle = rgba(PAL.boss, 0.55)
        g.beginPath()
        g.arc(0, 0, r * 0.16, 0, Math.PI * 2)
        g.fill()
        break
      }
    }
  })
}

// ---------------------------------------------------------------------------
// Motes
// ---------------------------------------------------------------------------
export function moteSprite(kind: MoteKind): Sprite {
  const color = kind === 'sun' ? PAL.sun : PAL[kind]
  return make(`mote:${kind}`, 30, (g, s) => {
    const r = s / 2.4
    const halo = g.createRadialGradient(0, 0, 0, 0, 0, s)
    halo.addColorStop(0, rgba(color, 0.55))
    halo.addColorStop(1, rgba(color, 0))
    g.fillStyle = halo
    g.fillRect(-s, -s, s * 2, s * 2)
    if (kind === 'sun') {
      // little sun: disc + cross sparkle
      g.fillStyle = '#fffdf2'
      g.beginPath()
      g.arc(0, 0, r * 0.5, 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = rgba(color, 0.95)
      g.lineWidth = r * 0.16
      g.beginPath()
      g.moveTo(0, -r)
      g.lineTo(0, r)
      g.moveTo(-r, 0)
      g.lineTo(r, 0)
      g.stroke()
    } else {
      // faceted gem diamond
      g.fillStyle = rgba(color, 0.95)
      g.beginPath()
      g.moveTo(0, -r)
      g.lineTo(r * 0.72, 0)
      g.lineTo(0, r)
      g.lineTo(-r * 0.72, 0)
      g.closePath()
      g.fill()
      g.fillStyle = 'rgba(255,255,255,0.85)'
      g.beginPath()
      g.moveTo(0, -r * 0.55)
      g.lineTo(r * 0.32, 0)
      g.lineTo(0, r * 0.14)
      g.lineTo(-r * 0.32, 0)
      g.closePath()
      g.fill()
    }
  })
}

// ---------------------------------------------------------------------------
// Star (arena core) — layered halo + disc; rays drawn at runtime
// ---------------------------------------------------------------------------
export function starCore(r: number): Sprite {
  return make(`star:${r}`, r * 2.4, (g, s) => {
    const rr = s / 1.2
    const disc = g.createRadialGradient(0, 0, 0, 0, 0, rr * 0.62)
    disc.addColorStop(0, '#ffffff')
    disc.addColorStop(0.55, PAL.starCore)
    disc.addColorStop(1, rgba(PAL.starGlow, 0.9))
    g.fillStyle = disc
    g.beginPath()
    g.arc(0, 0, rr * 0.62, 0, Math.PI * 2)
    g.fill()
  })
}

export function decoySprite(r: number): Sprite {
  return make(`decoy:${r}`, r * 3, (g, s) => {
    const rr = s / 1.5
    const halo = g.createRadialGradient(0, 0, 0, 0, 0, s)
    halo.addColorStop(0, rgba(PAL.gold, 0.5))
    halo.addColorStop(1, rgba(PAL.gold, 0))
    g.fillStyle = halo
    g.fillRect(-s, -s, s * 2, s * 2)
    // shed-skin knot: three overlapping plates
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2
      const x = Math.cos(a) * rr * 0.3
      const y = Math.sin(a) * rr * 0.3
      g.fillStyle = PAL.serpentPlate
      g.beginPath()
      g.arc(x, y, rr * 0.42, 0, Math.PI * 2)
      g.fill()
      g.lineWidth = rr * 0.08
      g.strokeStyle = PAL.serpentRim
      g.stroke()
    }
    g.fillStyle = rgba(PAL.gold, 0.9)
    g.beginPath()
    g.arc(0, 0, rr * 0.16, 0, Math.PI * 2)
    g.fill()
  })
}

/** for help-screen imagery */
export function spriteDataURL(s: Sprite): string {
  return s.c.toDataURL()
}
