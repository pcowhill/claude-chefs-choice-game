// In-game HUD (DOM overlay): star integrity, hour progress, score, hearts,
// stamina, molt cooldown, coil count, boss bar, toasts, hour banner.

import { ENEMY_INFO, SERPENT } from './config'
import type { Run } from './types'
import { fmt, roman } from './util'

let root: HTMLElement
let els: Record<string, HTMLElement> = {}
const last: Record<string, string | number> = {}

export function initHud(hudEl: HTMLElement) {
  root = hudEl
  root.innerHTML = `
    <div class="hud-top">
      <div class="hud-star">
        <div class="hud-label">THE STAR</div>
        <div class="bar star-bar"><div class="fill" id="hud-star-fill"></div></div>
        <div class="hud-sub" id="hud-star-num"></div>
      </div>
      <div class="hud-hour">
        <div class="hud-hour-title" id="hud-hour"></div>
        <div class="hud-hour-sub" id="hud-hour-sub"></div>
        <div class="bar hour-bar"><div class="fill" id="hud-hour-fill"></div></div>
        <div class="hud-boss" id="hud-boss">
          <div class="hud-boss-name" id="hud-boss-name"></div>
          <div class="bar boss-bar"><div class="fill" id="hud-boss-fill"></div></div>
        </div>
      </div>
      <div class="hud-score">
        <div class="hud-label">SCORE</div>
        <div class="hud-score-num" id="hud-score"></div>
        <div class="hud-sub" id="hud-best"></div>
      </div>
    </div>
    <div class="hud-bottom">
      <div class="hud-life">
        <div class="pips" id="hud-pips"></div>
        <div class="bar stamina-bar"><div class="fill" id="hud-stam-fill"></div></div>
        <div class="hud-sub">SHIFT · SURGE</div>
      </div>
      <div class="hud-molt">
        <div class="molt-ring" id="hud-molt-ring"><span id="hud-molt-icon">◈</span></div>
        <div class="hud-sub" id="hud-molt-label">SPACE · MOLT</div>
      </div>
      <div class="hud-coils">
        <div class="hud-label">COILS</div>
        <div class="hud-coils-num" id="hud-coils"></div>
        <div class="hud-sub" id="hud-kills"></div>
      </div>
    </div>
  `
  els = {}
  for (const el of Array.from(root.querySelectorAll('[id]'))) {
    els[el.id] = el as HTMLElement
  }
}

function setText(id: string, v: string) {
  if (last[id] !== v) {
    last[id] = v
    els[id].textContent = v
  }
}
function setWidth(id: string, pct: number) {
  const v = Math.round(pct * 1000) / 10
  if (last[id] !== v) {
    last[id] = v
    els[id].style.width = `${v}%`
  }
}

export function updateHud(run: Run, best: number) {
  const starFrac = run.star.hp / run.star.maxHp
  setWidth('hud-star-fill', starFrac)
  els['hud-star-fill'].classList.toggle('low', starFrac < 0.32)
  setText('hud-star-num', `${Math.ceil(run.star.hp)} / ${run.star.maxHp}`)

  setText('hud-hour', `HOUR ${roman(run.hour)}`)
  setText('hud-hour-sub', run.bannerSub)
  setWidth('hud-hour-fill', Math.min(1, run.hourT / run.hourDuration))

  setText('hud-score', fmt(run.score))
  setText('hud-best', best > 0 ? `BEST ${fmt(best)}` : '')

  // hearts
  const pipsKey = `${run.headHp}/${run.headMaxHp}`
  if (last['pips'] !== pipsKey) {
    last['pips'] = pipsKey
    els['hud-pips'].innerHTML = Array.from({ length: run.headMaxHp }, (_, i) =>
      `<span class="pip ${i < run.headHp ? 'on' : ''}">◆</span>`).join('')
  }

  setWidth('hud-stam-fill', run.stamina / SERPENT.stamina)

  // molt ring — conic sweep
  const moltReady = run.moltCd <= 0 && run.segments.length >= SERPENT.moltMinSegments
  const cdMul = run.upgrades['deepMolt'] ? 0.75 : 1
  const frac = run.moltCd > 0 ? 1 - run.moltCd / (SERPENT.moltCooldown * cdMul) : 1
  const ring = els['hud-molt-ring']
  const ringKey = `${Math.round(frac * 50)}|${moltReady}`
  if (last['molt'] !== ringKey) {
    last['molt'] = ringKey
    ring.style.background = `conic-gradient(var(--gold) ${frac * 360}deg, rgba(201,168,106,0.15) 0deg)`
    ring.classList.toggle('ready', moltReady)
  }
  setText('hud-molt-label', run.segments.length < SERPENT.moltMinSegments ? 'GROW TO MOLT' : 'SPACE · MOLT')

  setText('hud-coils', `${run.segments.length} / ${SERPENT.maxSegments}`)
  setText('hud-kills', `${fmt(run.stats.kills)} SLAIN`)

  // boss bar
  const boss = run.bossRef
  els['hud-boss'].classList.toggle('hidden', !boss)
  if (boss) {
    setText('hud-boss-name', ENEMY_INFO[boss.kind].title)
    setWidth('hud-boss-fill', Math.max(0, boss.hp / boss.maxHp))
  }
}

// --- toasts -----------------------------------------------------------------
let toastEl: HTMLElement
export function initToasts(el: HTMLElement) {
  toastEl = el
}

export function updateToasts(run: Run, dt: number) {
  let dirty = false
  for (let i = run.toasts.length - 1; i >= 0; i--) {
    const t = run.toasts[i]
    t.t -= dt
    if (t.t <= 0) {
      run.toasts.splice(i, 1)
      dirty = true
    }
  }
  const key = run.toasts.map((t) => t.msg).join('|')
  if (dirty || last['toasts'] !== key) {
    last['toasts'] = key
    toastEl.innerHTML = run.toasts
      .map((t) => {
        const a = Math.min(1, t.t / 0.4, (t.total - t.t) / 0.35)
        return `<div class="toast" style="opacity:${a.toFixed(2)}">${t.msg}</div>`
      })
      .join('')
  } else if (run.toasts.length > 0) {
    // update opacity only
    const nodes = toastEl.children
    run.toasts.forEach((t, i) => {
      const a = Math.min(1, t.t / 0.4, (t.total - t.t) / 0.35)
      ;(nodes[i] as HTMLElement | undefined)?.style.setProperty('opacity', a.toFixed(2))
    })
  }
}

export function toast(run: Run, msg: string, dur = 3.6) {
  run.toasts.push({ msg, t: dur, total: dur })
  if (run.toasts.length > 3) run.toasts.shift()
}

// --- hour banner --------------------------------------------------------------
let bannerEl: HTMLElement
export function initBanner(el: HTMLElement) {
  bannerEl = el
}

export function updateBanner(run: Run) {
  const show = run.phase === 'banner'
  const key = show ? `${run.bannerText}|${run.bannerSub}|${run.bannerT > 0.35}` : 'off'
  if (last['banner'] === key) return
  last['banner'] = key
  if (!show) {
    bannerEl.classList.add('hidden')
    return
  }
  bannerEl.classList.remove('hidden')
  bannerEl.classList.toggle('fading', run.bannerT <= 0.35)
  bannerEl.innerHTML = `
    <div class="banner-rule">✦ ✦ ✦</div>
    <div class="banner-title">${run.bannerText}</div>
    <div class="banner-sub">${run.bannerSub}</div>
  `
}

export function resetHudCache() {
  for (const k in last) delete last[k]
}
