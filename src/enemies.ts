// Enemy behaviors: steering, gnawing segments and the Star, the head-hunting
// stinger, spitter artillery, splitter chain deaths, both bosses, decoy taunts.

import { audio } from './audio'
import {
  CENTER, ECLIPSE, ENEMIES, MAW, PAL, SCALE, SERPENT, SPIT, STAR, STINGER_HIT,
  type EnemyKind, type TurretKind,
} from './config'
import { addFreeze, addShake, burst, ring, shardBurst, spawn as spawnParticle } from './particles'
import { damageHead, damageSegment } from './serpent'
import { dropMote } from './motes'
import { damageStar } from './star'
import type { Enemy, Run } from './types'
import { scaledHp } from './types'
import { angleTo, clamp, dist, dist2, rand, randRange } from './util'

let chargeHits = new WeakSet<object>()

export function spawnEnemy(run: Run, kind: EnemyKind, x: number, y: number): Enemy {
  const def = ENEMIES[kind]
  const hp = kind === 'maw' || kind === 'eclipse'
    ? def.hp * (run.endless ? Math.pow(1.35, Math.max(0, run.hour - 12) / 3) : 1)
    : scaledHp(kind, run.hour, SCALE.coef, SCALE.pow)
  const e: Enemy = {
    kind,
    x, y,
    vx: 0, vy: 0,
    hp, maxHp: hp,
    r: def.r,
    speed: def.speed * randRange(0.92, 1.08),
    state: kind === 'eclipse' ? 'orbit' : 'seek',
    slow: 0,
    shockSlowT: 0,
    gnawIdx: -1,
    attackCd: randRange(0.2, 0.8),
    flash: 0,
    born: 0.5,
    tauntT: 0, tauntX: 0, tauntY: 0,
    t1: kind === 'maw' ? MAW.chargeInterval * 0.7 : kind === 'eclipse' ? ECLIPSE.beamInterval * 0.6 : randRange(0, 1.5),
    t2: kind === 'eclipse' ? ECLIPSE.diveInterval : 0,
    phase: rand() * Math.PI * 2,
    dirX: 0, dirY: 0,
    spin: randRange(-1, 1),
    desperate: false,
  }
  run.enemies.push(e)
  if (kind === 'maw' || kind === 'eclipse') {
    run.bossRef = e
    audio.play('bossRoar')
    addShake(0.5)
  }
  return e
}

// ---------------------------------------------------------------------------
// damage & death
// ---------------------------------------------------------------------------
export function damageEnemy(run: Run, e: Enemy, dmg: number, src: TurretKind | 'molt' | 'ram'): boolean {
  if (e.hp <= 0) return false
  e.hp -= dmg
  e.flash = 1
  if (src === 'molt') run.stats.dmgMolt += dmg
  else if (src === 'ram') run.stats.dmgRam += dmg
  else run.stats.dmgByTurret[src] += dmg
  if ((run.upgrades['tidalLightning'] ?? 0) > 0 && src === 'storm') e.shockSlowT = 1
  if (e.hp <= 0) {
    kill(run, e)
    return true
  }
  return false
}

function kill(run: Run, e: Enemy) {
  const def = ENEMIES[e.kind]
  run.stats.kills++
  run.stats.killsByKind[e.kind] = (run.stats.killsByKind[e.kind] ?? 0) + 1
  run.score += def.score
  const color = enemyColor(e.kind)
  burst(e.x, e.y, color, e.kind === 'mite' ? 8 : 14, 180, 0.5)
  shardBurst(e.x, e.y, color, e.kind === 'mite' ? 4 : 8, 210)

  if (e.kind === 'splitter') {
    audio.play('bigDie')
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + rand()
      const m = spawnEnemy(run, 'mite', e.x + Math.cos(a) * 16, e.y + Math.sin(a) * 16, )
      m.vx = Math.cos(a) * 140
      m.vy = Math.sin(a) * 140
    }
  } else if (e.kind === 'maw' || e.kind === 'eclipse') {
    audio.play('bigDie')
    addShake(0.7)
    addFreeze(e.kind === 'eclipse' ? 0.3 : 0.16)
    ring(e.x, e.y, PAL.sun, 220, 0.9)
    burst(e.x, e.y, PAL.sun, 46, 320, 1.1, 4)
    // bosses shower the field with light
    for (let i = 0; i < 4; i++) dropMote(run, e.x + randRange(-60, 60), e.y + randRange(-60, 60))
    dropMote(run, e.x, e.y, 'sun')
    dropMote(run, e.x + 40, e.y - 30, 'sun')
    if (run.bossRef === e) run.bossRef = null
  } else if (e.kind === 'stinger') {
    audio.play('stingerDie')
  } else {
    audio.play('enemyDie')
  }

  // mote economy
  run.moteCredit += def.moteValue
  while (run.moteCredit >= 1) {
    run.moteCredit -= 1
    dropMote(run, e.x + randRange(-14, 14), e.y + randRange(-14, 14))
  }

  const idx = run.enemies.indexOf(e)
  if (idx >= 0) run.enemies.splice(idx, 1)
}

export function enemyColor(kind: EnemyKind): string {
  switch (kind) {
    case 'mite': return PAL.enemy
    case 'stinger': return PAL.stinger
    case 'spitter': return PAL.spitter
    case 'splitter': return PAL.splitter
    case 'husk': return PAL.husk
    case 'maw': case 'eclipse': return PAL.boss
  }
}

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------
export function updateEnemies(run: Run, dt: number, time: number) {
  // decoys tick + explode
  for (let i = run.decoys.length - 1; i >= 0; i--) {
    const d = run.decoys[i]
    d.t -= dt
    if (d.t <= 0) {
      const blastMul = run.upgrades['deepMolt'] ? 1.4 : 1
      const radius = SERPENT.moltBlastRadius * blastMul
      const dmg = SERPENT.moltBlastDamage * blastMul
      for (let j = run.enemies.length - 1; j >= 0; j--) {
        const e = run.enemies[j]
        const dd = dist(d.x, d.y, e.x, e.y)
        if (dd < radius + e.r) {
          const a = angleTo(d.x, d.y, e.x, e.y)
          e.vx += Math.cos(a) * 420
          e.vy += Math.sin(a) * 420
          e.shockSlowT = Math.max(e.shockSlowT, 1.4)
          damageEnemy(run, e, dmg, 'molt')
        }
      }
      audio.play('moltBoom')
      addShake(0.42)
      addFreeze(0.06)
      ring(d.x, d.y, PAL.gold, radius * 2, 0.6)
      burst(d.x, d.y, PAL.gold, 36, 340, 0.8, 4)
      burst(d.x, d.y, '#ffffff', 12, 200, 0.4, 3)
      run.decoys.splice(i, 1)
      continue
    }
    // taunt pulse
    if (Math.floor(d.t * 3) !== Math.floor((d.t + dt) * 3)) {
      ring(d.x, d.y, PAL.gold, 60, 0.35)
    }
    for (const e of run.enemies) {
      if (e.kind === 'stinger' || e.kind === 'maw' || e.kind === 'eclipse') continue
      if (dist2(d.x, d.y, e.x, e.y) < SERPENT.moltTauntRadius * SERPENT.moltTauntRadius) {
        e.tauntT = 0.25
        e.tauntX = d.x
        e.tauntY = d.y
      }
    }
  }

  const headVx = Math.cos(run.headAng) * SERPENT.speed
  const headVy = Math.sin(run.headAng) * SERPENT.speed

  for (let i = run.enemies.length - 1; i >= 0; i--) {
    const e = run.enemies[i]
    e.flash = Math.max(0, e.flash - dt * 5)
    e.born = Math.max(0, e.born - dt)
    e.attackCd -= dt
    e.tauntT = Math.max(0, e.tauntT - dt)
    e.shockSlowT = Math.max(0, e.shockSlowT - dt)

    const slowTotal = clamp(e.slow + (e.shockSlowT > 0 ? 0.25 : 0), 0, 0.72)
    const speedNow = e.speed * (1 - slowTotal) * (e.desperate ? 1.35 : 1)

    switch (e.kind) {
      case 'mite':
      case 'husk':
      case 'splitter':
        updateGnawer(run, e, dt, speedNow)
        break
      case 'stinger':
        updateStinger(run, e, dt, speedNow, time, headVx, headVy)
        break
      case 'spitter':
        updateSpitter(run, e, dt, speedNow, time)
        break
      case 'maw':
        updateMaw(run, e, dt, speedNow)
        break
      case 'eclipse':
        updateEclipse(run, e, dt, time)
        break
    }

    // separation (skip bosses)
    if (e.kind !== 'maw' && e.kind !== 'eclipse') {
      for (let j = 0; j < run.enemies.length; j++) {
        if (j === i) continue
        const o = run.enemies[j]
        const rr = e.r + o.r
        const d2 = dist2(e.x, e.y, o.x, o.y)
        if (d2 < rr * rr && d2 > 0.01) {
          const d = Math.sqrt(d2)
          const push = ((rr - d) / rr) * 46 * dt
          e.x += ((e.x - o.x) / d) * push
          e.y += ((e.y - o.y) / d) * push
        }
      }
    }

    // integrate residual impulse velocity (knockbacks)
    e.x += e.vx * dt
    e.y += e.vy * dt
    e.vx *= 1 - 4.5 * dt
    e.vy *= 1 - 4.5 * dt

    // keep on the field
    e.x = clamp(e.x, -60, 1820)
    e.y = clamp(e.y, -60, 1050)

    // ambient void smoke
    if (rand() < dt * (e.kind === 'maw' || e.kind === 'eclipse' ? 14 : 2.2)) {
      spawnParticle('smoke', e.x + randRange(-e.r, e.r) * 0.5, e.y + randRange(-e.r, e.r) * 0.5, {
        vx: randRange(-10, 10), vy: randRange(-10, 10),
        life: randRange(0.4, 0.9), size: e.r * 0.5, color: '#12040e', additive: false,
      })
    }

    // head contact
    resolveHeadContact(run, e)

    e.slow = 0 // re-applied by frost next frame
  }
}

function seekPoint(e: Enemy, x: number, y: number, speed: number, dt: number) {
  const a = angleTo(e.x, e.y, x, y)
  e.x += Math.cos(a) * speed * dt
  e.y += Math.sin(a) * speed * dt
}

/** returns index of a serpent segment in contact, else -1 */
function touchingSegment(run: Run, e: Enemy, slack = 2): number {
  const rr = e.r + SERPENT.segR + slack
  for (let i = 0; i < run.segments.length; i++) {
    const s = run.segments[i]
    if (dist2(e.x, e.y, s.x, s.y) < rr * rr) return i
  }
  return -1
}

function updateGnawer(run: Run, e: Enemy, dt: number, speed: number) {
  const def = ENEMIES[e.kind]
  // taunted → run at the decoy
  const tx = e.tauntT > 0 ? e.tauntX : CENTER.x
  const ty = e.tauntT > 0 ? e.tauntY : CENTER.y

  if (e.state === 'gnaw') {
    const idx = e.gnawIdx
    const seg = run.segments[idx]
    if (!seg || dist2(e.x, e.y, seg.x, seg.y) > Math.pow(e.r + SERPENT.segR + 30, 2) || e.tauntT > 0) {
      e.state = 'seek'
      e.gnawIdx = -1
    } else {
      // chew
      if (e.attackCd <= 0) {
        e.attackCd = def.segBiteT
        damageSegment(run, idx, def.segDmg)
        const a = angleTo(e.x, e.y, seg.x, seg.y)
        e.vx -= Math.cos(a) * 60
        e.vy -= Math.sin(a) * 60
      }
      return
    }
  }
  if (e.state === 'gnawStar') {
    if (dist2(e.x, e.y, CENTER.x, CENTER.y) > Math.pow(STAR.r + e.r + 26, 2) || e.tauntT > 0) {
      e.state = 'seek'
    } else {
      if (e.attackCd <= 0) {
        e.attackCd = def.starBiteT
        damageStar(run, def.starDmg)
      }
      return
    }
  }

  // seeking
  seekPoint(e, tx, ty, speed, dt)
  const segIdx = touchingSegment(run, e)
  if (segIdx >= 0 && e.tauntT <= 0) {
    e.state = 'gnaw'
    e.gnawIdx = segIdx
    e.attackCd = Math.min(e.attackCd, 0.35)
    return
  }
  if (e.tauntT <= 0 && dist2(e.x, e.y, CENTER.x, CENTER.y) < Math.pow(STAR.r + e.r + 4, 2)) {
    e.state = 'gnawStar'
    e.attackCd = Math.min(e.attackCd, 0.3)
  }
}

function updateStinger(run: Run, e: Enemy, dt: number, speed: number, time: number, hvx: number, hvy: number) {
  // hunt the head with light prediction and a serpentine wobble
  const px = run.headX + hvx * 0.22
  const py = run.headY + hvy * 0.22
  const a = angleTo(e.x, e.y, px, py) + Math.sin(time * 6 + e.phase) * 0.35
  e.x += Math.cos(a) * speed * dt
  e.y += Math.sin(a) * speed * dt
  e.dirX = Math.cos(a)
  e.dirY = Math.sin(a)
  // thin trail
  if (rand() < dt * 30) {
    spawnParticle('spark', e.x, e.y, { life: 0.25, size: 2.2, color: PAL.stinger })
  }
}

function updateSpitter(run: Run, e: Enemy, dt: number, speed: number, time: number) {
  // nearest segment (or the star) is the target; hold range and lob bolts
  let tx = CENTER.x
  let ty = CENTER.y
  let bestD2 = Infinity
  for (const s of run.segments) {
    const d2 = dist2(e.x, e.y, s.x, s.y)
    if (d2 < bestD2) {
      bestD2 = d2
      tx = s.x
      ty = s.y
    }
  }
  const dStar = dist(e.x, e.y, CENTER.x, CENTER.y)
  if (Math.sqrt(bestD2) > 640) {
    tx = CENTER.x
    ty = CENTER.y
    bestD2 = dStar * dStar
  }
  const d = Math.sqrt(bestD2)
  const a = angleTo(e.x, e.y, tx, ty)
  const strafe = Math.sin(time * 0.8 + e.phase) * 0.55
  if (e.tauntT > 0) {
    seekPoint(e, e.tauntX, e.tauntY, speed, dt)
  } else if (d > SPIT.range * 0.92) {
    e.x += Math.cos(a + strafe) * speed * dt
    e.y += Math.sin(a + strafe) * speed * dt
  } else if (d < SPIT.range * 0.55) {
    e.x -= Math.cos(a) * speed * 0.8 * dt
    e.y -= Math.sin(a) * speed * 0.8 * dt
  } else {
    e.x += Math.cos(a + Math.PI / 2) * speed * 0.5 * strafe * dt
    e.y += Math.sin(a + Math.PI / 2) * speed * 0.5 * strafe * dt
  }
  e.dirX = Math.cos(a)
  e.dirY = Math.sin(a)
  // fire
  if (e.attackCd <= 0 && d < SPIT.range * 1.05 && e.born <= 0) {
    e.attackCd = SPIT.cooldown * randRange(0.9, 1.15)
    const aim = angleTo(e.x, e.y, tx, ty)
    run.bullets.push({
      kind: 'spit',
      x: e.x + Math.cos(aim) * e.r,
      y: e.y + Math.sin(aim) * e.r,
      vx: Math.cos(aim) * SPIT.boltSpeed,
      vy: Math.sin(aim) * SPIT.boltSpeed,
      dmg: SPIT.boltDmgSeg,
      r: 5,
      life: 3.2,
      fromEnemy: true,
    })
    audio.play('spit')
  }
}

function updateMaw(run: Run, e: Enemy, dt: number, speed: number) {
  e.t1 -= dt
  e.t2 -= dt
  switch (e.state) {
    case 'seek':
      seekPoint(e, CENTER.x, CENTER.y, speed, dt)
      if (dist(e.x, e.y, CENTER.x, CENTER.y) < STAR.r + e.r + 6) {
        const def = ENEMIES.maw
        if (e.attackCd <= 0) {
          e.attackCd = def.starBiteT
          damageStar(run, def.starDmg)
        }
      }
      if (e.t1 <= 0) {
        e.state = 'windup'
        e.t1 = MAW.chargeTelegraph
        const a = angleTo(e.x, e.y, CENTER.x, CENTER.y) + randRange(-0.35, 0.35)
        e.dirX = Math.cos(a)
        e.dirY = Math.sin(a)
        chargeHits = new WeakSet()
      }
      if (e.t2 <= 0) {
        e.t2 = MAW.spawnInterval
        for (let k = 0; k < MAW.spawnCount; k++) {
          const a = rand() * Math.PI * 2
          spawnEnemy(run, 'mite', e.x + Math.cos(a) * (e.r + 14), e.y + Math.sin(a) * (e.r + 14))
        }
        ring(e.x, e.y, PAL.boss, e.r * 2.6, 0.5)
      }
      break
    case 'windup': {
      // shudder in place
      e.x += randRange(-1.5, 1.5)
      e.y += randRange(-1.5, 1.5)
      if (e.t1 <= 0) {
        e.state = 'charge'
        e.t1 = 1.2 // max charge time
        audio.play('bossRoar')
      }
      break
    }
    case 'charge': {
      const chargeSlow = 1 - clamp(e.slow, 0, 0.35)
      e.x += e.dirX * MAW.chargeSpeed * chargeSlow * dt
      e.y += e.dirY * MAW.chargeSpeed * chargeSlow * dt
      // plow through segments
      for (let i = run.segments.length - 1; i >= 0; i--) {
        const s = run.segments[i]
        if (chargeHits.has(s)) continue
        if (dist2(e.x, e.y, s.x, s.y) < Math.pow(e.r + SERPENT.segR, 2)) {
          chargeHits.add(s)
          damageSegment(run, i, MAW.chargeDamageSeg)
        }
      }
      // star slam
      if (dist(e.x, e.y, CENTER.x, CENTER.y) < STAR.r + e.r) {
        damageStar(run, MAW.starHit)
        addShake(0.5)
        e.state = 'seek'
        e.t1 = MAW.chargeInterval
      }
      if (e.t1 <= 0 || e.x < 40 || e.x > 1720 || e.y < 40 || e.y > 950) {
        e.state = 'seek'
        e.t1 = MAW.chargeInterval
      }
      break
    }
    default:
      e.state = 'seek'
  }
}

function updateEclipse(run: Run, e: Enemy, dt: number, time: number) {
  e.t1 -= dt // beam cycle
  e.t2 -= dt // dive cycle
  e.phase += ECLIPSE.orbitSpeed * dt

  if (e.state === 'orbit') {
    const tx = CENTER.x + Math.cos(e.phase) * ECLIPSE.orbitRadius
    const ty = CENTER.y + Math.sin(e.phase) * ECLIPSE.orbitRadius
    // ease toward orbit point
    e.x += (tx - e.x) * Math.min(1, 1.6 * dt)
    e.y += (ty - e.y) * Math.min(1, 1.6 * dt)

    if (e.t2 <= 0) {
      e.state = 'dive'
      e.t2 = ECLIPSE.diveInterval
      const a = angleTo(e.x, e.y, CENTER.x, CENTER.y)
      e.dirX = Math.cos(a)
      e.dirY = Math.sin(a)
      audio.play('bossRoar')
    }
  } else if (e.state === 'dive') {
    e.x += e.dirX * ECLIPSE.diveSpeed * dt
    e.y += e.dirY * ECLIPSE.diveSpeed * dt
    for (let i = run.segments.length - 1; i >= 0; i--) {
      const s = run.segments[i]
      if (dist2(e.x, e.y, s.x, s.y) < Math.pow(e.r + SERPENT.segR, 2) && rand() < 12 * dt) {
        damageSegment(run, i, 16)
      }
    }
    if (dist(e.x, e.y, CENTER.x, CENTER.y) < STAR.r + e.r * 0.7) {
      damageStar(run, ECLIPSE.starHit)
      addShake(0.55)
      e.state = 'orbit'
      // resume orbit from current angular position
      e.phase = angleTo(CENTER.x, CENTER.y, e.x, e.y)
    }
  }

  // sweeping beam: telegraph then burn (aimed from eclipse through the star)
  const cycle = ECLIPSE.beamInterval + ECLIPSE.beamTelegraph + ECLIPSE.beamDuration
  if (e.t1 <= 0) e.t1 = cycle
  const tIn = cycle - e.t1
  const beamActive = tIn > ECLIPSE.beamTelegraph && tIn < ECLIPSE.beamTelegraph + ECLIPSE.beamDuration && e.state === 'orbit'
  if (beamActive) {
    const a = angleTo(e.x, e.y, CENTER.x, CENTER.y)
    const bx = Math.cos(a)
    const by = Math.sin(a)
    // hurt segments near the beam line (past the star it continues)
    for (let i = run.segments.length - 1; i >= 0; i--) {
      const s = run.segments[i]
      const px = s.x - e.x
      const py = s.y - e.y
      const t = px * bx + py * by
      if (t < 0 || t > 1400) continue
      const dx = px - bx * t
      const dy = py - by * t
      if (dx * dx + dy * dy < 26 * 26) {
        if (rand() < 10 * dt) damageSegment(run, i, ECLIPSE.beamDps / 3)
      }
    }
    const hx = run.headX - e.x
    const hy = run.headY - e.y
    const t = hx * bx + hy * by
    if (t > 0 && t < 1400) {
      const dx = hx - bx * t
      const dy = hy - by * t
      if (dx * dx + dy * dy < 30 * 30) {
        if (damageHead(run, ECLIPSE.beamHeadPips)) run.headHp = 0
      }
    }
  }

  // spawn escorts
  if (Math.floor((time + dt) / ECLIPSE.spawnInterval) !== Math.floor(time / ECLIPSE.spawnInterval)) {
    const kinds: EnemyKind[] = ['mite', 'mite', 'stinger', 'spitter']
    const k = kinds[Math.floor(rand() * kinds.length)]
    const a = rand() * Math.PI * 2
    spawnEnemy(run, k, e.x + Math.cos(a) * (e.r + 20), e.y + Math.sin(a) * (e.r + 20))
  }
}

/** beam geometry for rendering (mirrors updateEclipse) */
export function eclipseBeam(e: Enemy): { active: boolean; telegraph: boolean; a: number } {
  const cycle = ECLIPSE.beamInterval + ECLIPSE.beamTelegraph + ECLIPSE.beamDuration
  const tIn = cycle - e.t1
  const a = angleTo(e.x, e.y, CENTER.x, CENTER.y)
  if (e.state !== 'orbit') return { active: false, telegraph: false, a }
  return {
    active: tIn > ECLIPSE.beamTelegraph && tIn < ECLIPSE.beamTelegraph + ECLIPSE.beamDuration,
    telegraph: tIn > 0 && tIn <= ECLIPSE.beamTelegraph,
    a,
  }
}

function resolveHeadContact(run: Run, e: Enemy) {
  const rr = e.r + SERPENT.headR
  if (dist2(run.headX, run.headY, e.x, e.y) > rr * rr) return

  const small = e.kind === 'mite' || e.kind === 'stinger' || e.kind === 'spitter' || e.kind === 'splitter'
  if (run.surging && small) {
    // ram through the chaff
    damageEnemy(run, e, SERPENT.ramDamage, 'ram')
    audio.play('ram')
    burst(run.headX, run.headY, PAL.gold, 8, 200, 0.35)
    return
  }
  if (e.kind === 'stinger') {
    if (damageHead(run, STINGER_HIT)) run.headHp = 0
    kill(run, e)
    return
  }
  if (e.kind === 'mite') {
    // harmless shove
    const a = angleTo(run.headX, run.headY, e.x, e.y)
    e.vx += Math.cos(a) * 160
    e.vy += Math.sin(a) * 160
    return
  }
  // heavies hurt
  if (run.iframes <= 0) {
    if (damageHead(run, e.kind === 'maw' || e.kind === 'eclipse' ? 2 : 1)) run.headHp = 0
    const a = angleTo(e.x, e.y, run.headX, run.headY)
    run.headX += Math.cos(a) * 26
    run.headY += Math.sin(a) * 26
  }
}

/** find nearest living enemy to (x,y) within range; optional filter */
export function nearestEnemy(run: Run, x: number, y: number, range: number, filter?: (e: Enemy) => boolean): Enemy | null {
  let best: Enemy | null = null
  let bestD2 = range * range
  for (const e of run.enemies) {
    if (e.born > 0.15) continue
    if (filter && !filter(e)) continue
    const d2 = dist2(x, y, e.x, e.y)
    if (d2 < bestD2) {
      bestD2 = d2
      best = e
    }
  }
  return best
}

export function enemiesInRange(run: Run, x: number, y: number, range: number, out: Enemy[]): Enemy[] {
  out.length = 0
  const r2 = range * range
  for (const e of run.enemies) {
    if (e.born > 0.15) continue
    if (dist2(x, y, e.x, e.y) < r2) out.push(e)
  }
  return out
}
