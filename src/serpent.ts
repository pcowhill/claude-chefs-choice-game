// The serpent: steering, the path-follow body, growth, molt, damage, regen.

import { CENTER, SERPENT, WORLD, type TurretKind } from './config'
import { audio } from './audio'
import { input, keyDown, keyPressed } from './input'
import { addShake, burst, floatText, ring, shardBurst } from './particles'
import type { Run, Segment } from './types'
import { angleTo, clamp, dist, pick, rand, turnToward } from './util'
import { PAL } from './config'

export function initSerpent(run: Run) {
  run.headX = CENTER.x
  run.headY = CENTER.y + 250
  run.headAng = 0
  // seed the path straight back behind the head
  run.path.length = 0
  run.pathLen = 0
  const need = (SERPENT.maxSegments + 3) * SERPENT.spacing
  const steps = Math.ceil(need / SERPENT.pathStep)
  for (let i = steps; i >= 0; i--) {
    run.path.push({ x: run.headX - i * SERPENT.pathStep, y: run.headY })
  }
  run.pathLen = steps * SERPENT.pathStep
  run.segments.length = 0
  for (const kind of SERPENT.startBody) {
    appendSegment(run, kind)
  }
  positionSegments(run)
}

function appendSegment(run: Run, kind: TurretKind) {
  const maxHp = SERPENT.segHp
  const seg: Segment = {
    kind,
    tier: 1,
    x: run.headX,
    y: run.headY,
    ang: run.headAng,
    hp: maxHp,
    maxHp,
    cd: rand() * 0.4,
    sinceHit: 99,
    flash: 0,
    born: 0.35,
  }
  run.segments.push(seg)
}

/** eat-driven growth. Returns a short description of what happened (for FX). */
export function grow(run: Run, kind: TurretKind): 'grown' | 'upgraded' | 'overflow' {
  if (run.segments.length < maxSegments(run)) {
    appendSegment(run, kind)
    positionSegments(run)
    const tail = run.segments[run.segments.length - 1]
    burst(tail.x, tail.y, PAL[kind], 10, 120, 0.5)
    ring(tail.x, tail.y, PAL[kind], 40, 0.4)
    run.stats.peakLength = Math.max(run.stats.peakLength, run.segments.length)
    return 'grown'
  }
  // overflow: promote an existing segment of the same kind
  const upgradeCount = run.upgrades['overflow2'] ? 2 : 1
  let did = false
  for (let n = 0; n < upgradeCount; n++) {
    const candidates = run.segments.filter((s) => s.kind === kind && s.tier < 3)
    if (candidates.length === 0) break
    const seg = pick(candidates)
    seg.tier = (seg.tier + 1) as 1 | 2 | 3
    seg.maxHp = SERPENT.segHp + SERPENT.segHpPerTier * (seg.tier - 1)
    seg.hp = seg.maxHp
    floatText(seg.x, seg.y - 18, `TIER ${['I', 'II', 'III'][seg.tier - 1]}`, PAL[kind], 15)
    burst(seg.x, seg.y, PAL[kind], 14, 150, 0.6)
    did = true
  }
  if (did) {
    audio.play('upgrade')
    return 'upgraded'
  }
  run.score += 150
  return 'overflow'
}

export function maxSegments(_run: Run): number {
  return SERPENT.maxSegments
}

export interface SteerOverride {
  x: number
  y: number
  surge: boolean
}

export function updateSerpent(run: Run, dt: number, steer?: SteerOverride | null) {
  const inp = input()

  // --- steering -------------------------------------------------------------
  const speedMulCard = 1 + 0.07 * (run.upgrades['quickCoils'] ?? 0)
  const turnMulCard = 1 + 0.12 * (run.upgrades['quickCoils'] ?? 0)

  let turnRate = SERPENT.turnRate * turnMulCard
  let speed = SERPENT.speed * speedMulCard
  if (run.surging) {
    speed *= SERPENT.surgeSpeedMul
    turnRate *= SERPENT.surgeTurnMul
  }
  if (run.speedBoostT > 0) {
    run.speedBoostT -= dt
    speed *= SERPENT.moltSpeedBoost
  }

  const keyLeft = keyDown('a', 'arrowleft')
  const keyRight = keyDown('d', 'arrowright')
  if (steer) {
    const d = dist(run.headX, run.headY, steer.x, steer.y)
    if (d > 20) {
      const want = angleTo(run.headX, run.headY, steer.x, steer.y)
      run.headAng = turnToward(run.headAng, want, turnRate * dt)
    }
  } else if (keyLeft || keyRight) {
    run.headAng += (keyRight ? 1 : 0) * turnRate * dt - (keyLeft ? 1 : 0) * turnRate * dt
  } else if (inp.mouseFresh && inp.mouseInside) {
    const d = dist(run.headX, run.headY, inp.mouseX, inp.mouseY)
    if (d > 26) {
      const want = angleTo(run.headX, run.headY, inp.mouseX, inp.mouseY)
      run.headAng = turnToward(run.headAng, want, turnRate * dt)
    }
  }

  // --- surge ------------------------------------------------------------------
  const wantSurge = steer ? steer.surge : keyDown('shift') || inp.rmb
  if (wantSurge && !run.surging && run.stamina > SERPENT.surgeMinStart) run.surging = true
  if (run.surging) {
    run.stamina -= SERPENT.surgeDrain * dt
    if (!wantSurge || run.stamina <= 0) {
      run.surging = false
      run.surgeRegenWait = SERPENT.surgeRegenDelay
    }
  } else {
    run.surgeRegenWait -= dt
    if (run.surgeRegenWait <= 0) run.stamina += SERPENT.surgeRegen * dt
  }
  run.stamina = clamp(run.stamina, 0, SERPENT.stamina)
  audio.setSurge(run.surging)

  // --- move head --------------------------------------------------------------
  run.headX += Math.cos(run.headAng) * speed * dt
  run.headY += Math.sin(run.headAng) * speed * dt
  const pad = SERPENT.headR + 4
  run.headX = clamp(run.headX, pad, WORLD.w - pad)
  run.headY = clamp(run.headY, pad, WORLD.h - pad)

  // record path
  const last = run.path[run.path.length - 1]
  const step = dist(last.x, last.y, run.headX, run.headY)
  if (step >= SERPENT.pathStep) {
    run.path.push({ x: run.headX, y: run.headY })
    run.pathLen += step
    const need = (run.segments.length + 2) * SERPENT.spacing + 80
    while (run.path.length > 2 && run.pathLen - dist(run.path[0].x, run.path[0].y, run.path[1].x, run.path[1].y) > need) {
      const removed = run.path.shift()!
      run.pathLen -= dist(removed.x, removed.y, run.path[0].x, run.path[0].y)
    }
  }

  positionSegments(run)

  // --- molt ---------------------------------------------------------------------
  run.moltCd -= dt
  if (!steer && (keyPressed(' ') || keyPressed('e')) && run.phase === 'hour') {
    tryMolt(run)
  }

  // --- timers ---------------------------------------------------------------------
  run.iframes = Math.max(0, run.iframes - dt)
  const regenDelay = SERPENT.segRegenDelay - (run.upgrades['ancientScales'] ? 1 : 0)
  const hpMul = 1 + 0.3 * (run.upgrades['ancientScales'] ?? 0)
  for (const s of run.segments) {
    s.cd -= dt
    s.flash = Math.max(0, s.flash - dt * 5)
    s.born = Math.max(0, s.born - dt)
    s.sinceHit += dt
    const effMax = (SERPENT.segHp + SERPENT.segHpPerTier * (s.tier - 1)) * hpMul
    s.maxHp = effMax
    if (s.sinceHit > regenDelay && s.hp < s.maxHp && s.hp > 0) {
      s.hp = Math.min(s.maxHp, s.hp + SERPENT.segRegenRate * dt)
    }
  }
}

/** place segments along the recorded path, spaced by arc length from the head */
export function positionSegments(run: Run) {
  const pts = run.path
  let iPt = pts.length - 1
  let walked = 0
  // distance from head (which is beyond the last path point) to last point:
  let prevX = run.headX
  let prevY = run.headY
  let segIdx = 0
  let target = SERPENT.spacing * 1.15 // first segment sits a bit behind the head

  while (segIdx < run.segments.length && iPt >= 0) {
    const p = pts[iPt]
    const d = dist(prevX, prevY, p.x, p.y)
    while (segIdx < run.segments.length && walked + d >= target) {
      const t = d > 0.0001 ? (target - walked) / d : 0
      const seg = run.segments[segIdx]
      seg.x = prevX + (p.x - prevX) * t
      seg.y = prevY + (p.y - prevY) * t
      seg.ang = Math.atan2(prevY - p.y, prevX - p.x) // tangent pointing head-ward
      segIdx++
      target += SERPENT.spacing
    }
    walked += d
    prevX = p.x
    prevY = p.y
    iPt--
  }
  // if the path ran out (start of run), stack remaining segments at the end
  for (; segIdx < run.segments.length; segIdx++) {
    const seg = run.segments[segIdx]
    seg.x = prevX
    seg.y = prevY
    seg.ang = run.headAng
  }
}

export function tryMolt(run: Run): boolean {
  if (run.moltCd > 0) return false
  if (run.segments.length < SERPENT.moltMinSegments) {
    floatText(run.headX, run.headY - 30, 'TOO SHORT TO MOLT', PAL.boneDim, 14)
    return false
  }
  const shed = run.segments.splice(run.segments.length - SERPENT.moltShed, SERPENT.moltShed)
  const cx = shed.reduce((a, s) => a + s.x, 0) / shed.length
  const cy = shed.reduce((a, s) => a + s.y, 0) / shed.length
  run.decoys.push({ x: cx, y: cy, t: SERPENT.moltFuse })
  const cdMul = run.upgrades['deepMolt'] ? 0.75 : 1
  run.moltCd = SERPENT.moltCooldown * cdMul
  run.speedBoostT = SERPENT.moltSpeedBoostT
  run.stats.molts++
  for (const s of shed) {
    burst(s.x, s.y, PAL.gold, 12, 140, 0.5)
  }
  ring(cx, cy, PAL.gold, 90, 0.6)
  audio.play('molt')
  audio.play('decoyWarble')
  addShake(0.18)
  return true
}

/** damage one segment; true if it was destroyed */
export function damageSegment(run: Run, idx: number, dmg: number): boolean {
  const seg = run.segments[idx]
  if (!seg) return false
  seg.hp -= dmg
  seg.sinceHit = 0
  seg.flash = 1
  audio.play('segHurt')
  if (seg.hp <= 0) {
    run.segments.splice(idx, 1)
    shardBurst(seg.x, seg.y, PAL.goldDeep, 10, 190)
    burst(seg.x, seg.y, PAL[seg.kind], 12, 160, 0.5)
    ring(seg.x, seg.y, PAL.danger, 55, 0.45)
    floatText(seg.x, seg.y - 16, 'COIL BROKEN', PAL.danger, 14)
    audio.play('segLost')
    addShake(0.22)
    positionSegments(run)
    return true
  }
  return false
}

/** damage the head. Returns true if this was a killing blow (after Second Dawn). */
export function damageHead(run: Run, pips: number): boolean {
  if (run.iframes > 0) return false
  run.headHp -= pips
  run.iframes = SERPENT.headIframes
  audio.play('headHurt')
  addShake(0.4)
  burst(run.headX, run.headY, PAL.danger, 18, 220, 0.6)
  ring(run.headX, run.headY, PAL.danger, 70, 0.5)
  if (run.headHp <= 0) {
    if ((run.upgrades['secondDawn'] ?? 0) > 0 && !run.usedSecondDawn) {
      run.usedSecondDawn = true
      run.headHp = 2
      run.iframes = 2.5
      floatText(run.headX, run.headY - 34, 'SECOND DAWN', PAL.sun, 22)
      burst(run.headX, run.headY, PAL.sun, 40, 260, 0.9)
      audio.play('dawn')
      return false
    }
    return true
  }
  return false
}

export function fullHealSegments(run: Run) {
  for (const s of run.segments) {
    s.hp = s.maxHp
    s.sinceHit = 99
  }
}
