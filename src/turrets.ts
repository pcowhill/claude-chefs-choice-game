// Turret behaviors for each segment kind — including the signature mechanic:
// prism segments fire beams perpendicular to your spine, and prisms aligned
// along a straight run of body MERGE into amplified rays.

import { audio } from './audio'
import { PAL, TIER_MUL, TURRETS } from './config'
import { damageEnemy, enemiesInRange, nearestEnemy } from './enemies'
import { burst, spawn as spawnParticle } from './particles'
import type { Enemy, Run, Segment } from './types'
import { angDiff, dist, rand } from './util'

const scratch: Enemy[] = []

export function updateTurrets(run: Run, dt: number) {
  run.beams.length = 0
  for (let i = run.arcs.length - 1; i >= 0; i--) {
    run.arcs[i].life -= dt
    if (run.arcs[i].life <= 0) run.arcs.splice(i, 1)
  }

  const up = run.upgrades
  const fangDmgMul = 1 + 0.25 * (up['whettedFangs'] ?? 0)
  const fangRofMul = 1 + 0.2 * (up['rapidFangs'] ?? 0)
  const stormDmgMul = 1 + 0.25 * (up['chargedStorm'] ?? 0)
  const stormChains = TURRETS.storm.chains + (up['forkedStorm'] ?? 0)
  const rimeSlowAdd = 0.12 * (up['deepRime'] ?? 0)
  const rimeRadiusMul = 1 + 0.18 * (up['deepRime'] ?? 0)
  const rimeDps = 6 * (up['bitingRime'] ?? 0)
  const emberDmgMul = 1 + 0.25 * (up['siegeEmbers'] ?? 0)
  const emberSplashMul = 1 + 0.35 * (up['clusterEmbers'] ?? 0)
  const prismDmgMul = 1 + 0.25 * (up['burningFocus'] ?? 0)
  const lens = up['lensArray'] ?? 0
  const mergeAngle = TURRETS.prism.mergeAngle + 0.14 * lens

  // --- prism groups ---------------------------------------------------------
  const prisms: { idx: number; seg: Segment }[] = []
  for (let i = 0; i < run.segments.length; i++) {
    if (run.segments[i].kind === 'prism') prisms.push({ idx: i, seg: run.segments[i] })
  }
  const groups: { members: Segment[]; sumX: number; sumY: number; dirX: number; dirY: number }[] = []
  for (const p of prisms) {
    const g = groups[groups.length - 1]
    const prev = g ? prisms[prisms.indexOf(p) - 1] : undefined
    let joined = false
    if (g && prev && p.idx - prev.idx <= TURRETS.prism.mergeGap + 1) {
      const meanAng = Math.atan2(g.dirY, g.dirX)
      if (Math.abs(angDiff(meanAng, p.seg.ang)) <= mergeAngle) {
        g.members.push(p.seg)
        g.sumX += p.seg.x
        g.sumY += p.seg.y
        g.dirX += Math.cos(p.seg.ang)
        g.dirY += Math.sin(p.seg.ang)
        joined = true
      }
    }
    if (!joined) {
      groups.push({
        members: [p.seg],
        sumX: p.seg.x,
        sumY: p.seg.y,
        dirX: Math.cos(p.seg.ang),
        dirY: Math.sin(p.seg.ang),
      })
    }
  }

  let prismHitSomething = false
  for (const g of groups) {
    const n = g.members.length
    const cx = g.sumX / n
    const cy = g.sumY / n
    const ang = Math.atan2(g.dirY, g.dirX)
    const tierSum = g.members.reduce((a, s) => a + TIER_MUL[s.tier - 1], 0)
    const avgTier = g.members.reduce((a, s) => a + s.tier, 0) / n
    const groupBonus = Math.pow(n, TURRETS.prism.mergePow - 1) * (n >= 2 ? Math.pow(1.15, lens) : 1)
    const dps = TURRETS.prism.dps * tierSum * groupBonus * prismDmgMul
    const len = TURRETS.prism.length * (1 + 0.12 * (avgTier - 1)) + (n - 1) * 40
    const width = TURRETS.prism.width * (1 + 0.45 * (n - 1))

    for (const side of [1, -1]) {
      const beamAng = ang + (Math.PI / 2) * side
      const bx = Math.cos(beamAng)
      const by = Math.sin(beamAng)
      run.beams.push({ x: cx, y: cy, ang: beamAng, len, width, color: PAL.prism, power: n })
      // damage enemies near the beam line
      for (const e of run.enemies) {
        if (e.born > 0.15) continue
        const px = e.x - cx
        const py = e.y - cy
        const t = px * bx + py * by
        if (t < 0 || t > len) continue
        const dx = px - bx * t
        const dy = py - by * t
        const w = width / 2 + e.r
        if (dx * dx + dy * dy < w * w) {
          damageEnemy(run, e, dps * dt, 'prism')
          prismHitSomething = true
          if (rand() < dt * 14) {
            spawnParticle('spark', e.x - dx * 0.5, e.y - dy * 0.5, {
              vx: dx * 3, vy: dy * 3, life: 0.28, size: 2.6, color: PAL.prism,
            })
          }
        }
      }
    }
  }
  if (prismHitSomething) audio.play('prismOn')

  // --- per-segment turrets ----------------------------------------------------
  for (let i = 0; i < run.segments.length; i++) {
    const s = run.segments[i]
    if (s.born > 0.1) continue
    const tierMul = TIER_MUL[s.tier - 1]

    switch (s.kind) {
      case 'fang': {
        if (s.cd > 0) break
        const range = TURRETS.fang.range
        const target = nearestEnemy(run, s.x, s.y, range)
        if (!target) break
        s.cd = 1 / (TURRETS.fang.rof * fangRofMul)
        const lead = dist(s.x, s.y, target.x, target.y) / TURRETS.fang.bulletSpeed
        // crude lead using the target's current drift toward the star/center
        const aim = Math.atan2(target.y + target.vy * lead - s.y, target.x + target.vx * lead - s.x)
        run.bullets.push({
          kind: 'fang',
          x: s.x + Math.cos(aim) * 10,
          y: s.y + Math.sin(aim) * 10,
          vx: Math.cos(aim) * TURRETS.fang.bulletSpeed,
          vy: Math.sin(aim) * TURRETS.fang.bulletSpeed,
          dmg: TURRETS.fang.dmg * tierMul * fangDmgMul,
          r: 3.5,
          life: range / TURRETS.fang.bulletSpeed + 0.15,
          fromEnemy: false,
        })
        spawnParticle('spark', s.x + Math.cos(aim) * 12, s.y + Math.sin(aim) * 12, {
          vx: Math.cos(aim) * 60, vy: Math.sin(aim) * 60, life: 0.15, size: 3, color: PAL.fang,
        })
        audio.play('shoot')
        break
      }
      case 'storm': {
        if (s.cd > 0) break
        const first = nearestEnemy(run, s.x, s.y, TURRETS.storm.range)
        if (!first) break
        s.cd = 1 / TURRETS.storm.rof
        const hitSet: Enemy[] = [first]
        let from: Enemy = first
        for (let c = 1; c < stormChains; c++) {
          const next = nearestEnemy(run, from.x, from.y, TURRETS.storm.chainRadius, (e) => !hitSet.includes(e))
          if (!next) break
          hitSet.push(next)
          from = next
        }
        const pts = [{ x: s.x, y: s.y }]
        let px = s.x
        let py = s.y
        hitSet.forEach((e, ci) => {
          // jittered midpoint for the lightning look
          const mx = (px + e.x) / 2 + (rand() - 0.5) * 30
          const my = (py + e.y) / 2 + (rand() - 0.5) * 30
          pts.push({ x: mx, y: my }, { x: e.x, y: e.y })
          px = e.x
          py = e.y
          damageEnemy(run, e, TURRETS.storm.dmg * tierMul * stormDmgMul * Math.pow(0.82, ci), 'storm')
          burst(e.x, e.y, PAL.storm, 3, 90, 0.25)
        })
        run.arcs.push({ pts, life: 0.16 })
        audio.play('zap')
        break
      }
      case 'frost': {
        const radius = TURRETS.frost.radius * (1 + 0.12 * (s.tier - 1)) * rimeRadiusMul
        const slow = Math.min(0.72, TURRETS.frost.slow + 0.05 * (s.tier - 1) + rimeSlowAdd)
        enemiesInRange(run, s.x, s.y, radius, scratch)
        for (const e of scratch) {
          e.slow = Math.max(e.slow, slow)
          if (rimeDps > 0) damageEnemy(run, e, rimeDps * tierMul * dt, 'frost')
          if (rand() < dt * 2.5) {
            spawnParticle('spark', e.x + (rand() - 0.5) * e.r * 2, e.y + (rand() - 0.5) * e.r * 2, {
              vy: -18, life: 0.5, size: 2, color: PAL.frost,
            })
          }
        }
        break
      }
      case 'ember': {
        if (s.cd > 0) break
        const min = TURRETS.ember.rangeMin
        const target = nearestEnemy(run, s.x, s.y, TURRETS.ember.rangeMax, (e) => dist(s.x, s.y, e.x, e.y) > min)
        if (!target) break
        s.cd = 1 / TURRETS.ember.rof
        run.shells.push({
          x0: s.x, y0: s.y,
          x1: target.x, y1: target.y,
          t: 0,
          time: TURRETS.ember.shellTime,
          dmg: TURRETS.ember.dmg * tierMul * emberDmgMul,
          splash: TURRETS.ember.splash * emberSplashMul,
        })
        audio.play('emberLaunch')
        break
      }
      case 'prism':
        break // handled by groups above
    }
  }
}
