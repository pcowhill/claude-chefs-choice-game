// The Star — the thing you are keeping alive.

import { audio } from './audio'
import { CENTER, PAL, STAR } from './config'
import { addShake, burst, ring } from './particles'
import { dropMote } from './motes'
import type { Run } from './types'
import { rand, randRange } from './util'

export function damageStar(run: Run, dmg: number) {
  if (run.phase !== 'hour') return
  run.star.hp = Math.max(0, run.star.hp - dmg)
  run.star.hurtT = 0.5
  audio.play('starHurt')
  addShake(Math.min(0.5, 0.18 + dmg * 0.02))
  burst(CENTER.x + randRange(-20, 20), CENTER.y + randRange(-20, 20), PAL.starGlow, 10, 200, 0.6)
  ring(CENTER.x, CENTER.y, PAL.danger, STAR.r * 2.6, 0.5)
}

export function healStar(run: Run, amount: number) {
  run.star.hp = Math.min(run.star.maxHp, run.star.hp + amount)
  ring(CENTER.x, CENTER.y, PAL.heal, STAR.r * 2.4, 0.7)
}

export function updateStar(run: Run, dt: number) {
  run.star.hurtT = Math.max(0, run.star.hurtT - dt)
  run.star.pulseT += dt

  // the Star sheds motes of light for its guardian
  if (run.phase === 'hour') {
    const rate = 1 + 0.45 * (run.upgrades['solarFont'] ?? 0)
    run.star.trickleT += dt * rate
    if (run.star.trickleT >= STAR.trickleInterval) {
      run.star.trickleT = 0
      const a = rand() * Math.PI * 2
      const d = randRange(STAR.r + 40, STAR.trickleDist)
      dropMote(run, CENTER.x + Math.cos(a) * d, CENTER.y + Math.sin(a) * d)
    }
  }
}
