// DOM overlay screens: title, how-to-play, pause, the between-hour draft,
// and the end-of-run screen. Styling lives in style.css.

import { audio } from './audio'
import { ENEMY_INFO, PAL, TURRET_INFO, type EnemyKind, type TurretKind } from './config'
import { ENEMIES } from './config'
import { enemySprite, headSprite, decoySprite, moteSprite, segmentSprite, spriteDataURL } from './sprites'
import type { DraftCardDef, Run } from './types'
import { fmt, fmtTime, roman } from './util'

export interface Records {
  bestScore: number
  bestHour: number
  dawns: number
  nights: number
}

export interface ScreenHandlers {
  onStart(): void
  onResume(): void
  onRestart(): void
  onQuitToTitle(): void
  onPickCard(idx: number): void
  onContinueEndless(): void
}

let rootEl: HTMLElement
let handlers: ScreenHandlers
let current: string | null = null

export function initScreens(el: HTMLElement, h: ScreenHandlers) {
  rootEl = el
  handlers = h
}

export function currentScreen(): string | null {
  return current
}

export function hideAll() {
  current = null
  rootEl.innerHTML = ''
  rootEl.classList.add('hidden')
}

function show(name: string, html: string) {
  current = name
  rootEl.classList.remove('hidden')
  rootEl.innerHTML = html
  bindSounds()
}

function bindSounds() {
  for (const b of Array.from(rootEl.querySelectorAll('button, .card'))) {
    b.addEventListener('mouseenter', () => audio.play('uiHover'))
  }
}

function on(sel: string, fn: () => void) {
  const el = rootEl.querySelector(sel)
  el?.addEventListener('click', (e) => {
    e.stopPropagation()
    audio.unlock()
    audio.play('uiClick')
    fn()
  })
}

// ---------------------------------------------------------------------------
// audio controls (shared by title + pause)
// ---------------------------------------------------------------------------
function audioControlsHTML(): string {
  const s = audio.settings
  return `
    <div class="audio-controls">
      <button class="mute-btn" id="mute-btn" title="Mute (M)">${s.muted ? '🕨' : '🕪'}</button>
      <label>MUSIC<input type="range" id="vol-music" min="0" max="100" value="${Math.round(s.music * 100)}"></label>
      <label>SOUND<input type="range" id="vol-sfx" min="0" max="100" value="${Math.round(s.sfx * 100)}"></label>
    </div>
  `
}

function bindAudioControls() {
  const music = rootEl.querySelector<HTMLInputElement>('#vol-music')
  const sfx = rootEl.querySelector<HTMLInputElement>('#vol-sfx')
  const mute = rootEl.querySelector<HTMLButtonElement>('#mute-btn')
  music?.addEventListener('input', () => {
    audio.unlock()
    audio.settings.music = Number(music.value) / 100
    audio.applySettings()
  })
  sfx?.addEventListener('input', () => {
    audio.unlock()
    audio.settings.sfx = Number(sfx.value) / 100
    audio.applySettings()
    audio.play('eat')
  })
  mute?.addEventListener('click', () => {
    audio.unlock()
    audio.settings.muted = !audio.settings.muted
    audio.applySettings()
    mute.textContent = audio.settings.muted ? '🕨' : '🕪'
  })
}

// ---------------------------------------------------------------------------
// title
// ---------------------------------------------------------------------------
export function showTitle(records: Records) {
  const recordLine = records.bestScore > 0
    ? `BEST — HOUR ${roman(Math.max(1, records.bestHour))} · ${fmt(records.bestScore)}${records.dawns > 0 ? ` &nbsp;✦&nbsp; DAWNS SEEN ${records.dawns}` : ''}`
    : 'THE FIRST NIGHT AWAITS'
  show('title', `
    <div class="screen title-screen">
      <div class="title-block">
        <div class="title-eyebrow">THE VOID HAS COME FOR THE LAST STAR</div>
        <h1 class="title-word">WYRMLIGHT</h1>
        <div class="title-rule"><span>—— ✦ ——</span></div>
        <p class="title-sub">You are the serpent of light. Your body is the fortress.<br>
        Coil. Grow. Blaze. Survive until dawn.</p>
        <div class="menu">
          <button class="menu-btn" id="btn-start">E M B A R K</button>
          <button class="menu-btn small" id="btn-help">HOW TO PLAY</button>
        </div>
        <div class="title-records">${recordLine}</div>
      </div>
      <div class="title-controls">
        <span><b>MOUSE</b> steer</span><span class="dot">·</span>
        <span><b>SHIFT</b> surge</span><span class="dot">·</span>
        <span><b>SPACE</b> molt</span><span class="dot">·</span>
        <span><b>ESC</b> pause</span>
      </div>
      ${audioControlsHTML()}
    </div>
  `)
  on('#btn-start', handlers.onStart)
  on('#btn-help', () => showHelp('title'))
  bindAudioControls()
}

// ---------------------------------------------------------------------------
// help
// ---------------------------------------------------------------------------
const TURRET_KINDS: TurretKind[] = ['fang', 'storm', 'frost', 'ember', 'prism']
const ENEMY_KINDS: EnemyKind[] = ['mite', 'stinger', 'spitter', 'splitter', 'husk', 'maw']

export function showHelp(backTo: 'title' | 'pause') {
  const turretRows = TURRET_KINDS.map((k) => `
    <div class="help-row">
      <img src="${spriteDataURL(segmentSprite(k, 2, 13))}" alt="">
      <div><b style="color:${PAL[k]}">${TURRET_INFO[k].title}</b><span>${TURRET_INFO[k].blurb}</span></div>
    </div>`).join('')
  const enemyRows = ENEMY_KINDS.map((k) => `
    <div class="help-row">
      <img src="${spriteDataURL(enemySprite(k, Math.min(ENEMIES[k].r + 4, 20)))}" alt="">
      <div><b class="foe">${ENEMY_INFO[k].title}</b><span>${ENEMY_INFO[k].blurb}</span></div>
    </div>`).join('')

  show('help', `
    <div class="screen help-screen">
      <h2 class="screen-title">HOW TO PLAY</h2>
      <div class="help-cols">
        <div class="help-col">
          <h3>THE NIGHT</h3>
          <ul class="help-list">
            <li><b>Guard the Star.</b> If its light dies, the night wins.</li>
            <li><b>You are the wall.</b> Enemies gnaw your coils to reach it — block them, and mend when safe.</li>
            <li><b>Eat starlight, grow cannon.</b> Every mote grows a segment of its colour. Your body is your arsenal — <i>which</i> mote you eat is your build.</li>
            <li><b>Shape is a weapon.</b> Coil to focus fire; straighten aligned <b style="color:${PAL.prism}">PRISMS</b> to merge their rays.</li>
            <li><b>Molt</b> (SPACE) sheds your tail as a decoy bomb — spend growth to survive.</li>
            <li><b>Survive 12 hours</b> of night. Between hours, the Star offers a boon. At Hour XII… the ECLIPSE.</li>
          </ul>
          <h3>CONTROLS</h3>
          <div class="controls-grid">
            <span>MOUSE / A·D / ◀▶</span><span>steer the wyrm</span>
            <span>SHIFT or RIGHT-CLICK</span><span>surge (ram the small ones)</span>
            <span>SPACE</span><span>molt: decoy + blast</span>
            <span>ESC / P</span><span>pause</span>
            <span>M</span><span>mute</span>
          </div>
        </div>
        <div class="help-col">
          <h3>THE ARSENAL</h3>
          ${turretRows}
          <h3>THE VOID</h3>
          ${enemyRows}
        </div>
      </div>
      <div class="menu"><button class="menu-btn small" id="btn-back">RETURN</button></div>
      <div class="help-credits">Everything you see and hear is drawn &amp; synthesized in code · type set in Cinzel &amp; Alegreya Sans (SIL OFL)</div>
    </div>
  `)
  on('#btn-back', () => {
    if (backTo === 'title') handlers.onQuitToTitle()
    else showPause()
  })
}

// ---------------------------------------------------------------------------
// pause
// ---------------------------------------------------------------------------
export function showPause() {
  show('pause', `
    <div class="screen pause-screen">
      <h2 class="screen-title">THE NIGHT HOLDS ITS BREATH</h2>
      <div class="pause-sub">PAUSED</div>
      <div class="menu">
        <button class="menu-btn" id="btn-resume">RESUME</button>
        <button class="menu-btn small" id="btn-help2">HOW TO PLAY</button>
        <button class="menu-btn small" id="btn-restart">RESTART THE NIGHT</button>
        <button class="menu-btn small" id="btn-quit">ABANDON TO TITLE</button>
      </div>
      ${audioControlsHTML()}
    </div>
  `)
  on('#btn-resume', handlers.onResume)
  on('#btn-help2', () => showHelp('pause'))
  on('#btn-restart', handlers.onRestart)
  on('#btn-quit', handlers.onQuitToTitle)
  bindAudioControls()
}

// ---------------------------------------------------------------------------
// draft
// ---------------------------------------------------------------------------
function cardIcon(card: DraftCardDef): string {
  switch (card.icon) {
    case 'star': return `<img src="${spriteDataURL(moteSprite('sun'))}" alt="">`
    case 'wyrm': return `<img src="${spriteDataURL(headSprite(15))}" alt="">`
    case 'molt': return `<img src="${spriteDataURL(decoySprite(18))}" alt="">`
    default: return `<img src="${spriteDataURL(segmentSprite(card.icon, 3, 15))}" alt="">`
  }
}

export function showDraft(run: Run) {
  const comp = summarizeBody(run)
  const cards = run.draftChoices.map((c, i) => `
    <div class="card rarity-${c.rarity}" data-idx="${i}" tabindex="0">
      <div class="card-rarity">${c.rarity.toUpperCase()}</div>
      <div class="card-icon">${cardIcon(c)}</div>
      <div class="card-name">${c.name}</div>
      <div class="card-desc">${c.desc}</div>
      <div class="card-flavor">${c.flavor}</div>
      <div class="card-key">${i + 1}</div>
    </div>`).join('')

  show('draft', `
    <div class="screen draft-screen">
      <div class="draft-head">
        <div class="draft-eyebrow">HOUR ${roman(run.hour)} SURVIVED</div>
        <h2 class="screen-title">THE STAR OFFERS A BOON</h2>
      </div>
      <div class="cards">${cards}</div>
      <div class="draft-body">${comp}</div>
    </div>
  `)
  for (const el of Array.from(rootEl.querySelectorAll<HTMLElement>('.card'))) {
    el.addEventListener('click', () => {
      audio.play('draftPick')
      handlers.onPickCard(Number(el.dataset.idx))
    })
  }
}

function summarizeBody(run: Run): string {
  const counts: Partial<Record<TurretKind, { n: number; tiers: number }>> = {}
  for (const s of run.segments) {
    const c = (counts[s.kind] ??= { n: 0, tiers: 0 })
    c.n++
    c.tiers += s.tier
  }
  const bits = TURRET_KINDS.filter((k) => counts[k]).map((k) => {
    const c = counts[k]!
    return `<span class="comp" style="color:${PAL[k]}">${TURRET_INFO[k].title} ×${c.n}</span>`
  })
  return `YOUR COIL — ${run.segments.length} SEGMENTS &nbsp; ${bits.join(' &nbsp; ')}`
}

// ---------------------------------------------------------------------------
// end screen
// ---------------------------------------------------------------------------
export function showEnd(run: Run, records: Records, newBest: boolean, cause: 'victory' | 'star' | 'head') {
  const s = run.stats
  const title = cause === 'victory' ? 'THE DAWN COMES' : cause === 'star' ? 'THE LAST LIGHT DIES' : 'THE WYRM IS SLAIN'
  const epitaph = cause === 'victory'
    ? (run.endless ? 'And still the wyrm coils, in the long gold morning.' : 'Twelve hours of night, and you were the wall that held.')
    : cause === 'star'
      ? 'The void closes over the place where the light was.'
      : 'The coils fall dark and scatter among the stars.'

  const dmg = [
    ['FANG', s.dmgByTurret.fang, PAL.fang],
    ['STORM', s.dmgByTurret.storm, PAL.storm],
    ['RIME', s.dmgByTurret.frost, PAL.frost],
    ['EMBER', s.dmgByTurret.ember, PAL.ember],
    ['PRISM', s.dmgByTurret.prism, PAL.prism],
    ['MOLT', s.dmgMolt, PAL.gold],
    ['RAM', s.dmgRam, PAL.bone],
  ] as const
  const maxDmg = Math.max(1, ...dmg.map((d) => d[1]))
  const dmgRows = dmg.filter((d) => d[1] > 0.5).map(([name, v, color]) => `
    <div class="dmg-row">
      <span class="dmg-name" style="color:${color}">${name}</span>
      <div class="dmg-bar"><div style="width:${Math.max(2, (v / maxDmg) * 100)}%;background:${color}"></div></div>
      <span class="dmg-val">${fmt(v)}</span>
    </div>`).join('')

  show('end', `
    <div class="screen end-screen ${cause === 'victory' ? 'victorious' : ''}">
      <div class="end-eyebrow">${cause === 'victory' ? '✦ VICTORY ✦' : 'THE NIGHT PREVAILS'}</div>
      <h2 class="end-title">${title}</h2>
      <div class="end-epitaph">${epitaph}</div>
      ${newBest ? '<div class="new-best">✦ NEW BEST ✦</div>' : ''}
      <div class="end-grid">
        <div class="stat"><span class="stat-v">${fmt(run.score)}</span><span class="stat-k">SCORE</span></div>
        <div class="stat"><span class="stat-v">${cause === 'victory' && !run.endless ? 'XII' : roman(run.hour)}</span><span class="stat-k">HOUR</span></div>
        <div class="stat"><span class="stat-v">${fmt(s.kills)}</span><span class="stat-k">SLAIN</span></div>
        <div class="stat"><span class="stat-v">${s.peakLength}</span><span class="stat-k">PEAK COILS</span></div>
        <div class="stat"><span class="stat-v">${fmt(s.motesEaten)}</span><span class="stat-k">MOTES EATEN</span></div>
        <div class="stat"><span class="stat-v">${s.molts}</span><span class="stat-k">MOLTS</span></div>
        <div class="stat"><span class="stat-v">${fmtTime(s.timePlayed)}</span><span class="stat-k">TIME</span></div>
        <div class="stat"><span class="stat-v">${Math.ceil(run.star.hp)}</span><span class="stat-k">STAR LIGHT LEFT</span></div>
      </div>
      <div class="dmg-table">${dmgRows}</div>
      <div class="menu horiz">
        <button class="menu-btn" id="btn-again">${cause === 'victory' ? 'A NEW NIGHT' : 'ONCE MORE'}</button>
        ${cause === 'victory' && !run.endless ? '<button class="menu-btn" id="btn-endless">INTO THE ENDLESS NIGHT</button>' : ''}
        <button class="menu-btn small" id="btn-title">TITLE</button>
      </div>
      <div class="end-records">BEST — HOUR ${roman(Math.max(1, records.bestHour))} · ${fmt(records.bestScore)} &nbsp;✦&nbsp; DAWNS ${records.dawns} · NIGHTS ${records.nights}</div>
    </div>
  `)
  on('#btn-again', handlers.onRestart)
  on('#btn-title', handlers.onQuitToTitle)
  if (cause === 'victory' && !run.endless) on('#btn-endless', handlers.onContinueEndless)
}
