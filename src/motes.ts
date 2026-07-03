// Starlight motes — the pickup/draft economy. Which mote you steer your head
// into decides what your next segment is: drafting by movement.

import { audio } from './audio'
import { MOTES, PAL, SCORE, SERPENT, STAR, type TurretKind } from './config'
import { burst, floatText, ring } from './particles'
import { grow } from './serpent'
import { healStar } from './star'
import type { MoteKind, Run } from './types'
import { angleTo, clamp, dist2, pickWeighted, rand, randRange } from './util'

const KINDS: TurretKind[] = ['fang', 'storm', 'frost', 'ember', 'prism']
const EAT_PITCH: Record<MoteKind, number> = { fang: 1, storm: 1.26, frost: 1.12, ember: 0.94, prism: 1.5, sun: 1.68 }

// early-run showcase queue per run
const showcase = new WeakMap<Run, TurretKind[]>()

function chooseKind(run: Run): MoteKind {
  let q = showcase.get(run)
  if (!q) {
    q = ['frost', 'ember', 'prism', 'fang', 'storm']
    showcase.set(run, q)
  }
  if (q.length > 0 && run.hour <= 2) return q.shift()!

  // weight toward what the player is already building, but keep variety
  const weights: Partial<Record<TurretKind, number>> = {}
  for (const k of KINDS) {
    const count = run.segments.filter((s) => s.kind === k).length
    weights[k] = 1 + Math.min(1.3, count * 0.22)
  }
  return pickWeighted(weights)
}

export function dropMote(run: Run, x: number, y: number, kind?: MoteKind) {
  const k = kind ?? chooseKind(run)
  run.motes.push({
    kind: k,
    x: clamp(x, 30, 1730),
    y: clamp(y, 30, 960),
    vx: randRange(-MOTES.drift, MOTES.drift),
    vy: randRange(-MOTES.drift, MOTES.drift),
    life: MOTES.life + 4 * (run.upgrades['longPatience'] ?? 0),
    seed: rand() * Math.PI * 2,
  })
}

export function updateMotes(run: Run, dt: number) {
  const magnet = SERPENT.magnetRadius * (1 + 0.4 * (run.upgrades['longPatience'] ?? 0))
  const magnet2 = magnet * magnet

  for (let i = run.motes.length - 1; i >= 0; i--) {
    const m = run.motes[i]
    m.life -= dt
    if (m.life <= 0) {
      run.motes.splice(i, 1)
      continue
    }
    m.x += m.vx * dt
    m.y += m.vy * dt
    m.vx *= 1 - 0.4 * dt
    m.vy *= 1 - 0.4 * dt

    // magnet toward the head
    const d2 = dist2(m.x, m.y, run.headX, run.headY)
    if (d2 < magnet2) {
      const a = angleTo(m.x, m.y, run.headX, run.headY)
      const pull = 620 * (1 - Math.sqrt(d2) / magnet)
      m.x += Math.cos(a) * pull * dt
      m.y += Math.sin(a) * pull * dt
    }

    // eat
    if (d2 < Math.pow(SERPENT.eatRadius, 2)) {
      run.motes.splice(i, 1)
      eat(run, m.kind, m.x, m.y)
    }
  }
}

function eat(run: Run, kind: MoteKind, x: number, y: number) {
  run.stats.motesEaten++
  run.score += SCORE.eatBonus
  if (kind === 'sun') {
    healStar(run, STAR.sunHealStar)
    run.headHp = Math.min(run.headMaxHp, run.headHp + STAR.sunHealHead)
    floatText(x, y - 20, 'SUNLIGHT', PAL.sun, 16)
    burst(x, y, PAL.sun, 22, 220, 0.8)
    audio.play('sunEat')
    return
  }
  const result = grow(run, kind)
  burst(x, y, PAL[kind], 12, 150, 0.5)
  ring(x, y, PAL[kind], 44, 0.35)
  audio.play('eat', { pitch: EAT_PITCH[kind] })
  if (result === 'overflow') {
    floatText(x, y - 20, '+150', PAL.gold, 14)
  }
}
