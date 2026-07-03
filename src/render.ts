// World renderer. Everything is lit by the Star: its remaining integrity
// drives the reach of the warm light and how far the void has crept in.

import { CENTER, ECLIPSE, PAL, SERPENT, STAR, TURRETS, WORLD } from './config'
import { eclipseBeam, enemyColor } from './enemies'
import { drawFloaters, drawParticles } from './particles'
import {
  blit, decoySprite, enemySprite, glow, headSprite, moteSprite, segmentSprite, starCore,
} from './sprites'
import type { Enemy, Run } from './types'
import { clamp, easeOutQuad, rand, rgba } from './util'

// --- static starfield --------------------------------------------------------
let bg: HTMLCanvasElement | null = null
interface Twinkle { x: number; y: number; ph: number; s: number }
const twinkles: Twinkle[] = []

function buildBackground() {
  bg = document.createElement('canvas')
  bg.width = WORLD.w
  bg.height = WORLD.h
  const g = bg.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, WORLD.h)
  grad.addColorStop(0, PAL.bgTop)
  grad.addColorStop(0.5, PAL.bgMid)
  grad.addColorStop(1, PAL.bgBot)
  g.fillStyle = grad
  g.fillRect(0, 0, WORLD.w, WORLD.h)

  // nebulae
  const blobs = [
    { x: WORLD.w * 0.2, y: WORLD.h * 0.25, r: 420, c: '#2a1b4a', a: 0.16 },
    { x: WORLD.w * 0.85, y: WORLD.h * 0.7, r: 500, c: '#12304a', a: 0.13 },
    { x: WORLD.w * 0.6, y: WORLD.h * 0.15, r: 330, c: '#3a1430', a: 0.1 },
  ]
  for (const b of blobs) {
    const rg = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r)
    rg.addColorStop(0, rgba(b.c, b.a))
    rg.addColorStop(1, rgba(b.c, 0))
    g.fillStyle = rg
    g.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2)
  }

  // stars
  for (let i = 0; i < 380; i++) {
    const x = Math.random() * WORLD.w
    const y = Math.random() * WORLD.h
    const s = Math.random() * 1.5 + 0.3
    const warm = Math.random() < 0.2
    g.fillStyle = rgba(warm ? '#ffe0b3' : '#cdd8ff', Math.random() * 0.5 + 0.15)
    g.fillRect(x, y, s, s)
    if (i < 70) twinkles.push({ x, y, ph: Math.random() * Math.PI * 2, s: s + 0.6 })
  }
}

// ---------------------------------------------------------------------------
export function drawWorld(ctx: CanvasRenderingContext2D, run: Run, time: number) {
  if (!bg) buildBackground()
  ctx.drawImage(bg!, 0, 0)

  const hpFrac = run.star.hp / run.star.maxHp

  // twinkles
  ctx.globalCompositeOperation = 'lighter'
  for (const t of twinkles) {
    const a = 0.25 + 0.3 * Math.sin(time * 1.4 + t.ph)
    if (a <= 0) continue
    ctx.globalAlpha = a
    ctx.fillStyle = '#dfe8ff'
    ctx.fillRect(t.x, t.y, t.s, t.s)
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'

  drawStarLight(ctx, run, hpFrac, time)
  drawWardRings(ctx, time)
  drawTelegraphs(ctx, run, time)
  drawFrostAuras(ctx, run, time)
  drawStarBody(ctx, run, hpFrac, time)
  drawDecoys(ctx, run, time)
  drawBeams(ctx, run, time)
  drawEclipseBeam(ctx, run)
  drawMotes(ctx, run, time)
  drawEnemies(ctx, run, time)
  drawSerpent(ctx, run, time)
  drawShells(ctx, run)
  drawBullets(ctx, run)
  drawArcs(ctx, run)
  drawParticles(ctx)
  drawFloaters(ctx)
  drawVoidEdge(ctx, hpFrac, time)
  drawCinematics(ctx, run)
  drawFrame(ctx)
}

// ---------------------------------------------------------------------------
function drawStarLight(ctx: CanvasRenderingContext2D, run: Run, hpFrac: number, time: number) {
  const breathe = 1 + Math.sin(time * 1.1) * 0.02
  const reach = (430 + 560 * (0.2 + 0.8 * hpFrac)) * breathe
  const g = ctx.createRadialGradient(CENTER.x, CENTER.y, 0, CENTER.x, CENTER.y, reach)
  g.addColorStop(0, rgba(PAL.starGlow, 0.16 + 0.1 * hpFrac))
  g.addColorStop(0.4, rgba(PAL.starGlow, 0.07))
  g.addColorStop(1, rgba(PAL.starGlow, 0))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, WORLD.w, WORLD.h)
  if (run.star.hurtT > 0) {
    ctx.fillStyle = rgba(PAL.danger, run.star.hurtT * 0.1)
    ctx.fillRect(0, 0, WORLD.w, WORLD.h)
  }
}

function drawWardRings(ctx: CanvasRenderingContext2D, time: number) {
  ctx.strokeStyle = rgba(PAL.goldDeep, 0.06)
  ctx.lineWidth = 1
  for (const r of [150, 290, 430]) {
    ctx.beginPath()
    ctx.arc(CENTER.x, CENTER.y, r + Math.sin(time * 0.6 + r) * 3, 0, Math.PI * 2)
    ctx.stroke()
  }
}

function drawTelegraphs(ctx: CanvasRenderingContext2D, run: Run, time: number) {
  for (const t of run.telegraphs) {
    const boss = t.kind === 'maw' || t.kind === 'eclipse'
    const pulse = 0.5 + 0.5 * Math.sin(time * 9)
    const r = (boss ? 44 : 18) * (1 + pulse * 0.25)
    ctx.strokeStyle = rgba(PAL.enemy, 0.35 + 0.4 * pulse)
    ctx.lineWidth = boss ? 3 : 1.6
    ctx.beginPath()
    ctx.arc(t.x, t.y, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(t.x, t.y, r * 0.4, 0, Math.PI * 2)
    ctx.stroke()
  }
}

function drawFrostAuras(ctx: CanvasRenderingContext2D, run: Run, time: number) {
  const up = run.upgrades['deepRime'] ?? 0
  const radiusMul = 1 + 0.18 * up
  for (const s of run.segments) {
    if (s.kind !== 'frost' || s.born > 0.1) continue
    const radius = TURRETS.frost.radius * (1 + 0.12 * (s.tier - 1)) * radiusMul
    ctx.globalCompositeOperation = 'lighter'
    const g = ctx.createRadialGradient(s.x, s.y, radius * 0.2, s.x, s.y, radius)
    g.addColorStop(0, rgba(PAL.frost, 0.015))
    g.addColorStop(0.8, rgba(PAL.frost, 0.05))
    g.addColorStop(1, rgba(PAL.frost, 0))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(s.x, s.y, radius, 0, Math.PI * 2)
    ctx.fill()
    // rotating rim dashes
    ctx.strokeStyle = rgba(PAL.frost, 0.22)
    ctx.lineWidth = 1.4
    ctx.setLineDash([10, 14])
    ctx.lineDashOffset = -time * 26
    ctx.beginPath()
    ctx.arc(s.x, s.y, radius, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.globalCompositeOperation = 'source-over'
  }
}

function drawStarBody(ctx: CanvasRenderingContext2D, run: Run, hpFrac: number, time: number) {
  const flicker = hpFrac < 0.3 ? 0.85 + rand() * 0.15 : 1
  const pulse = 1 + Math.sin(run.star.pulseT * 2.2) * 0.035
  ctx.globalCompositeOperation = 'lighter'
  // big soft halo
  blit(ctx, glow(PAL.starGlow, 190, 0.2), CENTER.x, CENTER.y, 0, pulse * (0.7 + hpFrac * 0.5), 0.85 * flicker)
  // rays
  const rays = 7
  ctx.save()
  ctx.translate(CENTER.x, CENTER.y)
  ctx.rotate(time * 0.06)
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2
    const len = (150 + 60 * Math.sin(time * 0.8 + i * 2.1)) * (0.5 + hpFrac * 0.6)
    const g = ctx.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len)
    g.addColorStop(0, rgba(PAL.starGlow, 0.22 * flicker))
    g.addColorStop(1, rgba(PAL.starGlow, 0))
    ctx.strokeStyle = g
    ctx.lineWidth = 10
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * STAR.r * 0.7, Math.sin(a) * STAR.r * 0.7)
    ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len)
    ctx.stroke()
  }
  ctx.restore()
  // core
  blit(ctx, starCore(STAR.r), CENTER.x, CENTER.y, time * 0.03, pulse * flicker, 1)
  ctx.globalCompositeOperation = 'source-over'

  // integrity arc around the star
  const arcR = STAR.r + 16
  ctx.lineWidth = 3.5
  ctx.strokeStyle = rgba('#100a04', 0.55)
  ctx.beginPath()
  ctx.arc(CENTER.x, CENTER.y, arcR, -Math.PI / 2, Math.PI * 1.5)
  ctx.stroke()
  ctx.strokeStyle = hpFrac > 0.3 ? rgba(PAL.gold, 0.9) : rgba(PAL.danger, 0.95)
  ctx.beginPath()
  ctx.arc(CENTER.x, CENTER.y, arcR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hpFrac)
  ctx.stroke()
}

function drawDecoys(ctx: CanvasRenderingContext2D, run: Run, time: number) {
  for (const d of run.decoys) {
    const fusePct = d.t / SERPENT.moltFuse
    blit(ctx, decoySprite(20), d.x, d.y, time * 2.5, 1 + (1 - fusePct) * 0.25)
    // fuse ring
    ctx.strokeStyle = rgba(PAL.danger, 0.85)
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(d.x, d.y, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - fusePct))
    ctx.stroke()
    // taunt reach
    ctx.strokeStyle = rgba(PAL.gold, 0.1 + 0.06 * Math.sin(time * 6))
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 10])
    ctx.beginPath()
    ctx.arc(d.x, d.y, SERPENT.moltTauntRadius, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
  }
}

function drawBeams(ctx: CanvasRenderingContext2D, run: Run, time: number) {
  if (run.beams.length === 0) return
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'
  for (const b of run.beams) {
    const fl = 0.85 + 0.15 * Math.sin(time * 31 + b.x)
    const ex = b.x + Math.cos(b.ang) * b.len
    const ey = b.y + Math.sin(b.ang) * b.len
    const g = ctx.createLinearGradient(b.x, b.y, ex, ey)
    g.addColorStop(0, rgba(b.color, 0.5 * fl))
    g.addColorStop(0.75, rgba(b.color, 0.28 * fl))
    g.addColorStop(1, rgba(b.color, 0))
    ctx.strokeStyle = g
    ctx.lineWidth = b.width * 2.4
    ctx.beginPath()
    ctx.moveTo(b.x, b.y)
    ctx.lineTo(ex, ey)
    ctx.stroke()
    // white-hot core
    const g2 = ctx.createLinearGradient(b.x, b.y, ex, ey)
    g2.addColorStop(0, rgba('#ffffff', (b.power >= 2 ? 0.85 : 0.55) * fl))
    g2.addColorStop(1, rgba('#ffffff', 0))
    ctx.strokeStyle = g2
    ctx.lineWidth = Math.max(1.5, b.width * (b.power >= 2 ? 0.8 : 0.5))
    ctx.beginPath()
    ctx.moveTo(b.x, b.y)
    ctx.lineTo(ex, ey)
    ctx.stroke()
  }
  ctx.lineCap = 'butt'
  ctx.globalCompositeOperation = 'source-over'
}

function drawEclipseBeam(ctx: CanvasRenderingContext2D, run: Run) {
  const e = run.bossRef
  if (!e || e.kind !== 'eclipse') return
  const info = eclipseBeam(e)
  const len = 1400
  const ex = e.x + Math.cos(info.a) * len
  const ey = e.y + Math.sin(info.a) * len
  if (info.telegraph) {
    ctx.strokeStyle = rgba(PAL.boss, 0.5)
    ctx.lineWidth = 2
    ctx.setLineDash([14, 10])
    ctx.beginPath()
    ctx.moveTo(e.x, e.y)
    ctx.lineTo(ex, ey)
    ctx.stroke()
    ctx.setLineDash([])
  } else if (info.active) {
    // a beam of darkness with a burning edge
    ctx.strokeStyle = rgba('#0a0108', 0.85)
    ctx.lineWidth = 30
    ctx.beginPath()
    ctx.moveTo(e.x, e.y)
    ctx.lineTo(ex, ey)
    ctx.stroke()
    ctx.globalCompositeOperation = 'lighter'
    ctx.strokeStyle = rgba(PAL.boss, 0.55)
    ctx.lineWidth = 36
    ctx.beginPath()
    ctx.moveTo(e.x, e.y)
    ctx.lineTo(ex, ey)
    ctx.stroke()
    ctx.globalCompositeOperation = 'source-over'
  }
}

function drawMotes(ctx: CanvasRenderingContext2D, run: Run, time: number) {
  ctx.globalCompositeOperation = 'lighter'
  for (const m of run.motes) {
    if (m.life < 3 && Math.sin(time * 12 + m.seed) < -0.2) continue // blink out warning
    const bob = Math.sin(time * 2.2 + m.seed) * 3
    const s = 1 + Math.sin(time * 3.1 + m.seed) * 0.12
    blit(ctx, moteSprite(m.kind), m.x, m.y + bob, time * 0.8 + m.seed, s)
  }
  ctx.globalCompositeOperation = 'source-over'
}

function drawEnemies(ctx: CanvasRenderingContext2D, run: Run, time: number) {
  for (const e of run.enemies) {
    const color = enemyColor(e.kind)
    const born = e.born > 0 ? easeOutQuad(1 - e.born / 0.5) : 1
    const scale = clamp(born, 0.05, 1)
    // under-glow
    ctx.globalCompositeOperation = 'lighter'
    blit(ctx, glow(color, e.r * 2.2, 0.25), e.x, e.y, 0, scale, 0.4)
    ctx.globalCompositeOperation = 'source-over'

    let rot = 0
    let sc = scale
    switch (e.kind) {
      case 'mite':
        rot = time * (1.5 + e.spin)
        break
      case 'stinger':
        rot = Math.atan2(e.dirY, e.dirX)
        break
      case 'spitter':
        rot = Math.atan2(e.dirY, e.dirX)
        break
      case 'splitter':
        sc = scale * (1 + Math.sin(time * 5 + e.phase) * 0.06)
        rot = time * 0.5 * e.spin
        break
      case 'husk':
        rot = time * 0.4 * (e.spin >= 0 ? 1 : -1)
        break
      case 'maw':
        rot = time * 0.9
        sc = scale * (e.state === 'windup' ? 1 + Math.sin(time * 30) * 0.05 : 1)
        break
      case 'eclipse':
        rot = time * 0.05
        break
    }
    // gnaw chomp animation
    if (e.state === 'gnaw' || e.state === 'gnawStar') {
      sc *= 1 + Math.abs(Math.sin(time * 8 + e.phase)) * 0.12
    }
    if (e.kind === 'maw') drawMawTelegraph(ctx, e)
    blit(ctx, enemySprite(e.kind, e.r), e.x, e.y, rot, sc)
    if (e.flash > 0) {
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = e.flash * 0.75
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(e.x, e.y, e.r * scale, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
    }
    // boss health ring
    if (e.kind === 'maw' || e.kind === 'eclipse') {
      const frac = e.hp / e.maxHp
      ctx.lineWidth = 3
      ctx.strokeStyle = rgba('#000000', 0.5)
      ctx.beginPath()
      ctx.arc(e.x, e.y, e.r + 12, 0, Math.PI * 2)
      ctx.stroke()
      ctx.strokeStyle = rgba(PAL.boss, 0.9)
      ctx.beginPath()
      ctx.arc(e.x, e.y, e.r + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac)
      ctx.stroke()
    }
  }
}

function drawSerpent(ctx: CanvasRenderingContext2D, run: Run, time: number) {
  const segs = run.segments
  // spine underglow
  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = rgba(PAL.gold, run.surging ? 0.16 : 0.09)
  ctx.lineWidth = 30
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(run.headX, run.headY)
  for (const s of segs) ctx.lineTo(s.x, s.y)
  ctx.stroke()
  ctx.globalCompositeOperation = 'source-over'
  // connective spine
  ctx.strokeStyle = rgba(PAL.goldDark, 0.9)
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.moveTo(run.headX, run.headY)
  for (const s of segs) ctx.lineTo(s.x, s.y)
  ctx.stroke()

  // segments tail → head so the head overlaps
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i]
    const bornScale = s.born > 0 ? 0.4 + 0.6 * easeOutQuad(1 - s.born / 0.35) : 1
    blit(ctx, segmentSprite(s.kind, s.tier, SERPENT.segR + 2), s.x, s.y, s.ang + Math.PI / 2, bornScale)
    const hpFrac = s.hp / s.maxHp
    if (hpFrac < 0.999) {
      // damage arc under the plate
      ctx.lineWidth = 2.5
      ctx.strokeStyle = hpFrac < 0.35 ? rgba(PAL.danger, 0.9) : rgba(PAL.gold, 0.55)
      ctx.beginPath()
      ctx.arc(s.x, s.y, SERPENT.segR + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hpFrac)
      ctx.stroke()
      // mending shimmer
      if (s.sinceHit > 3 && hpFrac < 1) {
        ctx.globalCompositeOperation = 'lighter'
        ctx.globalAlpha = 0.25 + 0.2 * Math.sin(time * 7 + i)
        ctx.strokeStyle = PAL.heal
        ctx.beginPath()
        ctx.arc(s.x, s.y, SERPENT.segR + 9, time * 3 + i, time * 3 + i + 1.2)
        ctx.stroke()
        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = 'source-over'
      }
    }
    if (s.flash > 0) {
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = s.flash * 0.7
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(s.x, s.y, SERPENT.segR + 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
    }
  }

  // head
  const blink = run.iframes > 0 && Math.sin(time * 26) > 0
  if (!blink) {
    if (run.surging) {
      ctx.globalCompositeOperation = 'lighter'
      blit(ctx, glow(PAL.gold, 46, 0.3), run.headX, run.headY, 0, 1, 0.55)
      // speed streaks
      ctx.strokeStyle = rgba(PAL.gold, 0.4)
      ctx.lineWidth = 2
      for (let k = 0; k < 3; k++) {
        const off = (k - 1) * 10
        const bx = run.headX - Math.cos(run.headAng) * (26 + k * 9) + Math.cos(run.headAng + Math.PI / 2) * off
        const by = run.headY - Math.sin(run.headAng) * (26 + k * 9) + Math.sin(run.headAng + Math.PI / 2) * off
        ctx.beginPath()
        ctx.moveTo(bx, by)
        ctx.lineTo(bx - Math.cos(run.headAng) * 18, by - Math.sin(run.headAng) * 18)
        ctx.stroke()
      }
      ctx.globalCompositeOperation = 'source-over'
    }
    blit(ctx, headSprite(SERPENT.headR + 2), run.headX, run.headY, run.headAng)
  }
}

function drawShells(ctx: CanvasRenderingContext2D, run: Run) {
  for (const sh of run.shells) {
    const t = sh.t / sh.time
    const x = sh.x0 + (sh.x1 - sh.x0) * t
    const y = sh.y0 + (sh.y1 - sh.y0) * t
    const h = Math.sin(Math.PI * t) * 90
    // landing reticle
    ctx.strokeStyle = rgba(PAL.ember, 0.25 + t * 0.4)
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.arc(sh.x1, sh.y1, sh.splash * (0.4 + 0.6 * t), 0, Math.PI * 2)
    ctx.stroke()
    // shadow
    ctx.fillStyle = rgba('#000000', 0.28 * (1 - h / 130))
    ctx.beginPath()
    ctx.ellipse(x, y, 7, 3.5, 0, 0, Math.PI * 2)
    ctx.fill()
    // shell
    ctx.globalCompositeOperation = 'lighter'
    blit(ctx, glow(PAL.ember, 14, 0.4), x, y - h, 0, 1, 0.9)
    ctx.fillStyle = '#ffd9a8'
    ctx.beginPath()
    ctx.arc(x, y - h, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
  }
}

function drawBullets(ctx: CanvasRenderingContext2D, run: Run) {
  ctx.globalCompositeOperation = 'lighter'
  for (const b of run.bullets) {
    if (b.fromEnemy) {
      blit(ctx, glow(PAL.spitter, 11, 0.4), b.x, b.y, 0, 1, 0.8)
      ctx.fillStyle = '#e9c2ff'
      ctx.beginPath()
      ctx.arc(b.x, b.y, 3.2, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.strokeStyle = rgba(PAL.fang, 0.75)
      ctx.lineWidth = 2.6
      ctx.beginPath()
      ctx.moveTo(b.x - b.vx * 0.035, b.y - b.vy * 0.035)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
      ctx.fillStyle = '#fff2d5'
      ctx.beginPath()
      ctx.arc(b.x, b.y, 2.6, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.globalCompositeOperation = 'source-over'
}

function drawArcs(ctx: CanvasRenderingContext2D, run: Run) {
  if (run.arcs.length === 0) return
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineJoin = 'round'
  for (const a of run.arcs) {
    const alpha = clamp(a.life / 0.16, 0, 1)
    ctx.strokeStyle = rgba(PAL.storm, 0.35 * alpha)
    ctx.lineWidth = 5
    ctx.beginPath()
    a.pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
    ctx.stroke()
    ctx.strokeStyle = rgba('#ffffff', 0.8 * alpha)
    ctx.lineWidth = 1.6
    ctx.stroke()
  }
  ctx.globalCompositeOperation = 'source-over'
}

function drawVoidEdge(ctx: CanvasRenderingContext2D, hpFrac: number, time: number) {
  // the void creeps inward as the star dims
  const inner = 640 + 360 * hpFrac
  const g = ctx.createRadialGradient(CENTER.x, CENTER.y, inner * 0.72, CENTER.x, CENTER.y, inner * 1.45)
  g.addColorStop(0, 'rgba(2,1,6,0)')
  g.addColorStop(1, `rgba(2,1,6,${0.5 + 0.35 * (1 - hpFrac)})`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, WORLD.w, WORLD.h)

  if (hpFrac < 0.35) {
    const a = (0.35 - hpFrac) * 0.35 * (0.6 + 0.4 * Math.sin(time * 2.4))
    ctx.fillStyle = rgba('#8a0f22', a * 0.35)
    ctx.fillRect(0, 0, WORLD.w, WORLD.h)
  }
}

function drawCinematics(ctx: CanvasRenderingContext2D, run: Run) {
  if (run.phase === 'dawn') {
    const t = clamp(run.cineT / 3.2, 0, 1)
    ctx.globalCompositeOperation = 'lighter'
    const r = 80 + easeOutQuad(t) * 2100
    const g = ctx.createRadialGradient(CENTER.x, CENTER.y, 0, CENTER.x, CENTER.y, r)
    g.addColorStop(0, rgba('#fff7e0', 0.9 * t))
    g.addColorStop(0.55, rgba(PAL.starGlow, 0.55 * t))
    g.addColorStop(1, rgba(PAL.starGlow, 0))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, WORLD.w, WORLD.h)
    ctx.globalCompositeOperation = 'source-over'
  } else if (run.phase === 'nightfall') {
    const t = clamp(run.cineT / 3.0, 0, 1)
    ctx.fillStyle = `rgba(1,0,4,${t * 0.92})`
    ctx.fillRect(0, 0, WORLD.w, WORLD.h)
  }
}

function drawFrame(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = rgba(PAL.goldDeep, 0.28)
  ctx.lineWidth = 1.5
  ctx.strokeRect(5, 5, WORLD.w - 10, WORLD.h - 10)
  // corner marks
  ctx.strokeStyle = rgba(PAL.goldDeep, 0.5)
  ctx.lineWidth = 2
  const L = 26
  for (const [cx, cy, sx, sy] of [
    [5, 5, 1, 1], [WORLD.w - 5, 5, -1, 1], [5, WORLD.h - 5, 1, -1], [WORLD.w - 5, WORLD.h - 5, -1, -1],
  ] as const) {
    ctx.beginPath()
    ctx.moveTo(cx + sx * L, cy)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx, cy + sy * L)
    ctx.stroke()
  }
}

/** boss beam / maw windup — telegraph line for the MAW's charge */
export function drawMawTelegraph(ctx: CanvasRenderingContext2D, e: Enemy) {
  if (e.kind !== 'maw' || e.state !== 'windup') return
  ctx.strokeStyle = rgba(PAL.boss, 0.4)
  ctx.lineWidth = e.r * 1.4
  ctx.setLineDash([18, 12])
  ctx.beginPath()
  ctx.moveTo(e.x, e.y)
  ctx.lineTo(e.x + e.dirX * ECLIPSE.orbitRadius * 3, e.y + e.dirY * ECLIPSE.orbitRadius * 3)
  ctx.stroke()
  ctx.setLineDash([])
}
