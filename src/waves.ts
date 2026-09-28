// The twelve hours of the night: budget-driven pulse spawner, spawn
// telegraphs, boss entrances, hour transitions into the draft.

import { audio } from './audio'
import { CENTER, ECLIPSE as ECLIPSE_CFG, ENDLESS, ENEMIES, HOURS, SCORE, SPAWN, WORLD, type EnemyKind, type HourDef } from './config'
import { rollDraft } from './draft'
import { spawnEnemy } from './enemies'
import { dropMote } from './motes'
import { fullHealSegments } from './serpent'
import type { Run } from './types'
import { pickWeighted, rand, randRange, roman } from './util'

export function hourDef(run: Run): HourDef {
  if (run.hour <= 12 && !run.endless) return HOURS[run.hour - 1]
  const past = run.hour - 12
  const boss = past % ENDLESS.mawEvery === 0 ? 'maw' as const : undefined
  return {
    duration: ENDLESS.duration,
    budgetPerSec: ENDLESS.budgetBase * Math.pow(ENDLESS.budgetGrowth, past),
    weights: ENDLESS.weights,
    boss,
    title: 'NIGHT ETERNAL',
  }
}

export function startHour(run: Run, hour: number) {
  run.hour = hour
  const def = hourDef(run)
  run.hourT = 0
  run.hourDuration = def.duration
  run.budget = 2 // a little opening pressure
  run.budgetSpent = 0
  run.budgetTotal = def.duration * def.budgetPerSec
  run.pulseT = 2.2
  run.bossSpawned = false
  run.phase = 'banner'
  run.bannerT = 2.2
  run.bannerText = `HOUR ${roman(hour)}`
  run.bannerSub = def.title
  fullHealSegments(run)
}

function edgePoint(): { x: number; y: number } {
  const p = SPAWN.edgePad
  const w = WORLD.w
  const h = WORLD.h
  const perim = 2 * (w + h)
  let d = rand() * perim
  if (d < w) return { x: p + (w - 2 * p) * (d / w), y: p }
  d -= w
  if (d < w) return { x: p + (w - 2 * p) * (d / w), y: h - p }
  d -= w
  if (d < h) return { x: p, y: p + (h - 2 * p) * (d / h) }
  d -= h
  return { x: w - p, y: p + (h - 2 * p) * (d / h) }
}

export function updateWaves(run: Run, dt: number) {
  if (run.phase === 'banner') {
    run.bannerT -= dt
    if (run.bannerT <= 0) {
      run.phase = 'hour'
      audio.play('waveHorn')
    }
    return
  }
  if (run.phase !== 'hour') return

  const def = hourDef(run)
  run.hourT += dt

  // hour-1 welcome gifts near the star
  if (run.hour === 1 && !run.endless) {
    if (crossed(run.hourT, dt, 1.2) || crossed(run.hourT, dt, 3.2)) {
      const a = rand() * Math.PI * 2
      dropMote(run, CENTER.x + Math.cos(a) * 150, CENTER.y + Math.sin(a) * 150)
    }
  }

  // boss entrance
  if (def.boss && !run.bossSpawned && run.hourT >= 2.5) {
    run.bossSpawned = true
    if (def.boss === 'maw') {
      const p = edgePoint()
      run.telegraphs.push({ x: p.x, y: p.y, t: SPAWN.telegraph * 2, kind: 'maw' })
    } else {
      run.telegraphs.push({ x: CENTER.x, y: CENTER.y - ECLIPSE_CFG.orbitRadius, t: SPAWN.telegraph * 2, kind: 'eclipse' })
    }
  }

  // budget accrual while the hour lasts
  if (run.hourT < def.duration) {
    run.budget += def.budgetPerSec * dt
  } else {
    // stragglers get desperate
    for (const e of run.enemies) e.desperate = true
  }

  // pulse spending
  run.pulseT -= dt
  if (run.pulseT <= 0 && run.hourT < def.duration) {
    run.pulseT = randRange(SPAWN.pulseMin, SPAWN.pulseMax) * (def.boss ? 1.25 : 1)
    spendBudget(run, def)
  }

  // telegraphs → spawns
  for (let i = run.telegraphs.length - 1; i >= 0; i--) {
    const t = run.telegraphs[i]
    t.t -= dt
    if (t.t <= 0) {
      spawnEnemy(run, t.kind, t.x, t.y)
      run.telegraphs.splice(i, 1)
    }
  }

  // --- hour end ---------------------------------------------------------------
  const bossAlive = !!run.bossRef
  const done = run.hourT >= def.duration && run.enemies.length === 0 && run.telegraphs.length === 0 && !bossAlive
  const isFinale = run.hour === 12 && !run.endless
  const finaleWon = isFinale && run.bossSpawned && !bossAlive && run.telegraphs.length === 0

  if (finaleWon) {
    run.victory = true
    run.phase = 'dawn'
    run.cineT = 0
    run.score += Math.round(run.star.hp * SCORE.starHpBonusMul)
    run.score += SCORE.hourClear * 12
    audio.play('dawn')
    audio.setMode('dawn')
    return
  }

  if (done) {
    run.score += SCORE.hourClear * Math.min(run.hour, 20)
    audio.play('hourClear')
    fullHealSegments(run)
    run.draftChoices = rollDraft(run)
    run.phase = 'draft'
  }
}

function crossed(t: number, dt: number, mark: number): boolean {
  return t >= mark && t - dt < mark
}

const MAX_FIELD = 120

function spendBudget(run: Run, def: HourDef) {
  // spawn in 1–3 clusters
  const clusters = 1 + Math.floor(rand() * Math.min(3, 1 + run.hour / 3))
  const points = Array.from({ length: clusters }, edgePoint)
  let spent = 0
  let guard = 0
  while (run.budget >= 1 && guard++ < 200) {
    if (run.enemies.length + run.telegraphs.length >= MAX_FIELD) break
    const kind = pickWeighted(def.weights) as EnemyKind
    const cost = ENEMIES[kind].cost
    if (cost > run.budget) {
      // afford at least a mite if possible
      if (run.budget >= 1 && (def.weights.mite ?? 0) > 0) {
        emit(run, points, 'mite')
        run.budget -= 1
        spent += 1
        continue
      }
      break
    }
    run.budget -= cost
    spent += cost
    emit(run, points, kind)
  }
  run.budgetSpent += spent
}

function emit(run: Run, points: { x: number; y: number }[], kind: EnemyKind) {
  const p = points[Math.floor(rand() * points.length)]
  const jx = randRange(-70, 70)
  const jy = randRange(-70, 70)
  run.telegraphs.push({
    x: Math.min(Math.max(p.x + jx, 20), WORLD.w - 20),
    y: Math.min(Math.max(p.y + jy, 20), WORLD.h - 20),
    t: SPAWN.telegraph + rand() * 0.5,
    kind,
  })
}
