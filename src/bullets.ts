// Projectiles: fang bolts, enemy spit, and ember mortar shells.

import { audio } from './audio'
import { CENTER, PAL, SERPENT, SPIT, STAR } from './config'
import { damageEnemy } from './enemies'
import { burst, ring } from './particles'
import { damageHead, damageSegment } from './serpent'
import { damageStar } from './star'
import type { Run } from './types'
import { dist2 } from './util'

export function updateBullets(run: Run, dt: number) {
  for (let i = run.bullets.length - 1; i >= 0; i--) {
    const b = run.bullets[i]
    b.life -= dt
    b.x += b.vx * dt
    b.y += b.vy * dt
    if (b.life <= 0 || b.x < -40 || b.x > 1800 || b.y < -40 || b.y > 1030) {
      run.bullets.splice(i, 1)
      continue
    }

    if (!b.fromEnemy) {
      // vs enemies
      let hit = false
      for (const e of run.enemies) {
        const rr = b.r + e.r
        if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
          damageEnemy(run, e, b.dmg, 'fang')
          burst(b.x, b.y, PAL.fang, 4, 120, 0.3)
          hit = true
          break
        }
      }
      if (hit) run.bullets.splice(i, 1)
    } else {
      // vs the serpent's head
      const hr = b.r + SERPENT.headR
      if (dist2(b.x, b.y, run.headX, run.headY) < hr * hr) {
        if (run.iframes <= 0) {
          if (damageHead(run, SPIT.boltDmgHead)) run.headHp = 0
        }
        run.bullets.splice(i, 1)
        continue
      }
      // vs segments
      let hit = false
      for (let s = 0; s < run.segments.length; s++) {
        const seg = run.segments[s]
        const rr = b.r + SERPENT.segR
        if (dist2(b.x, b.y, seg.x, seg.y) < rr * rr) {
          damageSegment(run, s, b.dmg)
          burst(b.x, b.y, PAL.spitter, 5, 130, 0.35)
          hit = true
          break
        }
      }
      if (hit) {
        run.bullets.splice(i, 1)
        continue
      }
      // vs the star
      if (dist2(b.x, b.y, CENTER.x, CENTER.y) < Math.pow(STAR.r + b.r, 2)) {
        damageStar(run, SPIT.boltDmgStar)
        run.bullets.splice(i, 1)
      }
    }
  }

  // mortar shells
  for (let i = run.shells.length - 1; i >= 0; i--) {
    const sh = run.shells[i]
    sh.t += dt
    if (sh.t >= sh.time) {
      // burst
      for (const e of run.enemies) {
        if (dist2(sh.x1, sh.y1, e.x, e.y) < Math.pow(sh.splash + e.r, 2)) {
          damageEnemy(run, e, sh.dmg, 'ember')
        }
      }
      audio.play('emberBoom')
      ring(sh.x1, sh.y1, PAL.ember, sh.splash * 2, 0.45)
      burst(sh.x1, sh.y1, PAL.ember, 20, 260, 0.55)
      burst(sh.x1, sh.y1, '#ffe6b0', 8, 140, 0.35)
      run.shells.splice(i, 1)
    }
  }
}
