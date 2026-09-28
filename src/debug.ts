// Debug & autopilot. Enabled with ?debug=1 — used for automated playtesting
// and screenshot verification. The autopilot also drives the title-screen
// attract demo (always available, no flag needed).

import { CENTER, SERPENT, STAR } from './config'
import { keyPressed } from './input'
import { tryMolt, type SteerOverride } from './serpent'
import { spawnEnemy } from './enemies'
import { dropMote } from './motes'
import type { Run } from './types'
import { dist, dist2, rand } from './util'

export const debugState = {
  enabled: false,
  god: false,
  bot: false,
  timescale: 1,
  panel: null as HTMLElement | null,
}

export function initDebug() {
  const params = new URLSearchParams(location.search)
  debugState.enabled = params.get('debug') === '1'
  debugState.bot = params.get('bot') === '1'
  if (!debugState.enabled) return
  const el = document.createElement('div')
  el.id = 'debug-panel'
  document.getElementById('stage')!.appendChild(el)
  debugState.panel = el
}

export function debugKeys(run: Run | null, onWin: () => void, onSkipHour: () => void) {
  if (!debugState.enabled) return
  if (keyPressed('f1')) debugState.god = !debugState.god
  if (keyPressed('f7')) debugState.bot = !debugState.bot
  if (keyPressed('f8')) debugState.timescale = debugState.timescale === 1 ? 4 : 1
  if (!run) return
  if (keyPressed('f2')) onSkipHour()
  if (keyPressed('f3')) {
    for (let i = 0; i < 5; i++) dropMote(run, run.headX + (rand() - 0.5) * 200, run.headY + (rand() - 0.5) * 200)
  }
  if (keyPressed('f4')) spawnEnemy(run, 'maw', 100, 100)
  if (keyPressed('f5')) onWin()
  if (keyPressed('f6')) run.star.hp = 0
}

export function debugApply(run: Run) {
  if (!debugState.enabled || !debugState.god) return
  run.headHp = run.headMaxHp
  run.star.hp = Math.max(run.star.hp, run.star.maxHp * 0.5)
}

export function debugPanel(fps: number, run: Run | null) {
  const p = debugState.panel
  if (!p) return
  if (!run) {
    p.textContent = `fps ${fps.toFixed(0)}`
    return
  }
  p.textContent =
    `fps ${fps.toFixed(0)}  x${debugState.timescale}${debugState.god ? '  GOD' : ''}${debugState.bot ? '  BOT' : ''}\n` +
    `hour ${run.hour} t=${run.hourT.toFixed(1)}/${run.hourDuration} phase=${run.phase}\n` +
    `enemies ${run.enemies.length}  bullets ${run.bullets.length}  motes ${run.motes.length}\n` +
    `segs ${run.segments.length}  star ${run.star.hp.toFixed(0)}  head ${run.headHp}  score ${run.score}\n` +
    `F1 god F2 skip F3 motes F4 boss F5 win F6 lose F7 bot F8 speed`
}

// ---------------------------------------------------------------------------
// autopilot: eats motes, orbits the star, dodges stingers, molts when swarmed
// ---------------------------------------------------------------------------
export function computeBot(run: Run, time: number): SteerOverride {
  const hx = run.headX
  const hy = run.headY

  // threat: nearest stinger heading for us
  let threat: { x: number; y: number } | null = null
  let threatD2 = 260 * 260
  for (const e of run.enemies) {
    if (e.kind !== 'stinger') continue
    const d2 = dist2(hx, hy, e.x, e.y)
    if (d2 < threatD2) {
      threatD2 = d2
      threat = e
    }
  }

  // molt if the star is swarmed
  if (run.moltCd <= 0 && run.segments.length >= SERPENT.moltMinSegments + 3) {
    let near = 0
    for (const e of run.enemies) {
      if (dist2(e.x, e.y, CENTER.x, CENTER.y) < 300 * 300) near++
    }
    if (near >= 9 && dist(hx, hy, CENTER.x, CENTER.y) < 420) tryMolt(run)
  }

  // target: best mote, else orbit the star
  let tx: number
  let ty: number
  let surge = false
  let bestScore = -Infinity
  let bestMote: { x: number; y: number } | null = null
  for (const m of run.motes) {
    const d = dist(hx, hy, m.x, m.y)
    if (d > 780) continue
    const starD = dist(m.x, m.y, CENTER.x, CENTER.y)
    const s = -d - starD * 0.35 + (m.life < 4 ? -120 : 0)
    if (s > bestScore) {
      bestScore = s
      bestMote = m
    }
  }
  if (bestMote) {
    tx = bestMote.x
    ty = bestMote.y
  } else {
    // orbit at a defensive radius, biased toward the densest cluster of foes
    const orbitR = 215
    const a = Math.atan2(hy - CENTER.y, hx - CENTER.x) + 0.55
    tx = CENTER.x + Math.cos(a) * orbitR
    ty = CENTER.y + Math.sin(a) * orbitR
  }

  if (threat) {
    // steer perpendicular away from the threat and surge through if lined up
    const ax = hx - (threat.x - hx)
    const ay = hy - (threat.y - hy)
    tx = (tx + ax * 2) / 3
    ty = (ty + ay * 2) / 3
    surge = run.stamina > 45
  }

  // unstick from walls
  const margin = 90
  if (hx < margin || hx > 1760 - margin || hy < margin || hy > 990 - margin) {
    tx = CENTER.x + Math.cos(time * 0.7) * 200
    ty = CENTER.y + Math.sin(time * 0.7) * 200
  }

  return { x: tx, y: ty, surge }
}

/** for the attract demo: auto-pick a draft card + keep the demo alive */
export function demoKeepAlive(run: Run) {
  if (run.star.hp < STAR.hp * 0.45) run.star.hp = STAR.hp * 0.45
  if (run.headHp < 2) run.headHp = run.headMaxHp
}
