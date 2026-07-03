// WYRMLIGHT — boot, app state machine, fixed-timestep loop.

import './style.css'
import '@fontsource/cinzel/600.css'
import '@fontsource/cinzel/700.css'
import '@fontsource/cinzel/800.css'
import '@fontsource/cinzel/900.css'
import '@fontsource/alegreya-sans/400.css'
import '@fontsource/alegreya-sans/500.css'
import '@fontsource/alegreya-sans/700.css'
import '@fontsource/alegreya-sans-sc/500.css'
import '@fontsource/alegreya-sans-sc/700.css'

import { audio } from './audio'
import { WORLD } from './config'
import { computeBot, debugApply, debugKeys, debugPanel, debugState, demoKeepAlive, initDebug } from './debug'
import { applyCard } from './draft'
import { updateEnemies } from './enemies'
import { updateBullets } from './bullets'
import { endFrame, initInput, keyPressed, setViewport, tickInput } from './input'
import { initBanner, initHud, initToasts, resetHudCache, toast, updateBanner, updateHud, updateToasts } from './hud'
import { updateMotes } from './motes'
import { clearParticles, consumeFreeze, setQuality, shakeOffset, updateParticles } from './particles'
import { drawWorld } from './render'
import { initScreens, hideAll, showDraft, showEnd, showPause, showTitle, currentScreen, type Records } from './screens'
import { initSerpent, updateSerpent } from './serpent'
import { updateStar } from './star'
import { updateTurrets } from './turrets'
import { newRun, type Run } from './types'
import { clamp, pick, rand } from './util'
import { startHour, updateWaves } from './waves'
import { grow } from './serpent'

// ---------------------------------------------------------------------------
// DOM + canvas setup
// ---------------------------------------------------------------------------
const stage = document.getElementById('stage') as HTMLDivElement
const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
const hudEl = document.getElementById('hud') as HTMLDivElement
const screensEl = document.getElementById('screens') as HTMLDivElement

initHud(hudEl)
initToasts(document.getElementById('toasts') as HTMLDivElement)
initBanner(document.getElementById('banner') as HTMLDivElement)
initInput(canvas)
initDebug()

let viewScale = 1
function resize() {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const scale = Math.min(vw / WORLD.w, vh / WORLD.h) * 0.985
  const dw = Math.floor(WORLD.w * scale)
  const dh = Math.floor(WORLD.h * scale)
  stage.style.width = `${dw}px`
  stage.style.height = `${dh}px`
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(dw * dpr)
  canvas.height = Math.round(dh * dpr)
  viewScale = (dw * dpr) / WORLD.w
  document.documentElement.style.setProperty('--u', `${dw / 100}px`)
}
resize()
window.addEventListener('resize', resize)

setViewport((sx, sy) => {
  const r = canvas.getBoundingClientRect()
  return {
    x: ((sx - r.left) / r.width) * WORLD.w,
    y: ((sy - r.top) / r.height) * WORLD.h,
  }
})

// ---------------------------------------------------------------------------
// records
// ---------------------------------------------------------------------------
const REC_KEY = 'wyrmlight.records'
function loadRecords(): Records {
  try {
    const raw = localStorage.getItem(REC_KEY)
    if (raw) return { bestScore: 0, bestHour: 0, dawns: 0, nights: 0, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return { bestScore: 0, bestHour: 0, dawns: 0, nights: 0 }
}
function saveRecords() {
  try { localStorage.setItem(REC_KEY, JSON.stringify(records)) } catch { /* ignore */ }
}
const records = loadRecords()

// ---------------------------------------------------------------------------
// app state
// ---------------------------------------------------------------------------
type AppState = 'title' | 'run'
let state: AppState = 'title'
let run: Run | null = null
let demo: Run | null = null
let time = 0
let endCause: 'victory' | 'star' | 'head' = 'star'
let recorded = false
let newBest = false
let prevPhase = ''

function newDemo(): Run {
  const d = newRun()
  initSerpent(d)
  // a seasoned demo serpent for the attract mode
  const kinds = ['fang', 'storm', 'frost', 'ember', 'prism', 'fang', 'prism', 'storm', 'prism', 'fang'] as const
  for (const k of kinds) grow(d, k)
  startHour(d, 4)
  d.phase = 'hour'
  d.bannerT = 0
  return d
}

function startGame() {
  run = newRun()
  initSerpent(run)
  startHour(run, 1)
  clearParticles()
  resetHudCache()
  hideAll()
  hudEl.classList.remove('hidden')
  audio.setMode('battle')
  state = 'run'
  recorded = false
  newBest = false
  endCause = 'star'
  demo = null
}

function quitToTitle() {
  state = 'title'
  run = null
  demo = newDemo()
  clearParticles()
  hudEl.classList.add('hidden')
  showTitle(records)
  audio.setMode('title')
}

function finalizeRun(r: Run) {
  if (recorded) return
  recorded = true
  const hourReached = endCause === 'victory' && !r.endless ? 12 : r.hour
  newBest = r.score > records.bestScore
  records.bestScore = Math.max(records.bestScore, r.score)
  records.bestHour = Math.max(records.bestHour, hourReached)
  records.nights += 1
  if (endCause === 'victory') records.dawns += 1
  saveRecords()
}

function pickCard(idx: number) {
  if (!run || run.phase !== 'draft') return
  const card = run.draftChoices[idx]
  if (!card) return
  applyCard(run, card)
  hideAll()
  startHour(run, run.hour + 1)
}

function continueEndless() {
  if (!run) return
  run.endless = true
  recorded = false
  hideAll()
  hudEl.classList.remove('hidden')
  audio.setMode('battle')
  startHour(run, 13)
}

function skipHour() {
  if (!run || run.phase !== 'hour') return
  run.enemies.length = 0
  run.telegraphs.length = 0
  run.bossRef = null
  run.bossSpawned = true
  run.hourT = run.hourDuration
  run.budget = 0
}

function forceWin() {
  if (!run) return
  run.victory = true
  run.phase = 'dawn'
  run.cineT = 0
  audio.play('dawn')
  audio.setMode('dawn')
}

initScreens(screensEl, {
  onStart: startGame,
  onResume: () => hideAll(),
  onRestart: startGame,
  onQuitToTitle: quitToTitle,
  onPickCard: pickCard,
  onContinueEndless: continueEndless,
})

// audio unlock on first gesture
const unlock = () => {
  audio.unlock()
  audio.setMode(state === 'title' ? 'title' : 'battle')
}
window.addEventListener('pointerdown', unlock, { once: false })
window.addEventListener('keydown', unlock, { once: false })

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'run' && run && (run.phase === 'hour' || run.phase === 'banner') && !currentScreen()) {
    showPause()
  }
})

// ---------------------------------------------------------------------------
// tutorial toasts
// ---------------------------------------------------------------------------
const TUTORIALS: { id: string; msg: string; cond: (r: Run) => boolean }[] = [
  { id: 'steer', msg: 'THE WYRM FOLLOWS YOUR CURSOR', cond: (r) => r.hour === 1 && r.hourT > 0.6 },
  { id: 'mote', msg: 'EAT THE STARLIGHT — EACH COLOUR GROWS A NEW WEAPON', cond: (r) => r.motes.length > 0 },
  { id: 'wall', msg: 'THE VOID COMES FOR THE STAR — BE THE WALL', cond: (r) => r.enemies.length > 0 },
  { id: 'stinger', msg: 'STINGERS HUNT YOUR HEAD — SURGE THROUGH THEM ⟨SHIFT⟩', cond: (r) => r.enemies.some((e) => e.kind === 'stinger') },
  { id: 'molt', msg: 'SPACE · MOLT YOUR TAIL INTO A DECOY BOMB', cond: (r) => r.segments.length >= 7 },
  { id: 'mend', msg: 'WOUNDED COILS MEND WHEN LEFT IN PEACE', cond: (r) => r.segments.some((s) => s.hp < s.maxHp * 0.55) },
  { id: 'prism', msg: 'STRAIGHTEN ALIGNED PRISMS TO MERGE THEIR RAYS', cond: (r) => r.segments.filter((s) => s.kind === 'prism').length >= 2 },
]

function tutorialTick(r: Run) {
  for (const t of TUTORIALS) {
    if (r.tutorialSeen[t.id]) continue
    if (t.cond(r)) {
      r.tutorialSeen[t.id] = true
      toast(r, t.msg, 4.2)
      break // one at a time
    }
  }
}

// ---------------------------------------------------------------------------
// simulation step
// ---------------------------------------------------------------------------
function simulate(r: Run, dt: number, isDemo: boolean) {
  updateWaves(r, dt)
  if (r.phase !== 'hour' && r.phase !== 'banner') return

  const steer = isDemo || debugState.bot ? computeBot(r, time) : null
  updateSerpent(r, dt, steer)
  updateTurrets(r, dt)
  updateEnemies(r, dt, r.time)
  updateBullets(r, dt)
  updateMotes(r, dt)
  updateStar(r, dt)
  r.time += dt
  r.stats.timePlayed += dt

  if (isDemo) {
    demoKeepAlive(r)
    return
  }
  debugApply(r)

  // defeat checks
  if (r.star.hp <= 0) {
    endCause = 'star'
    r.phase = 'nightfall'
    r.cineT = 0
    audio.play('defeat')
    audio.setMode('defeat')
  } else if (r.headHp <= 0) {
    endCause = 'head'
    r.phase = 'nightfall'
    r.cineT = 0
    audio.play('defeat')
    audio.setMode('defeat')
  }
}

function update(dt: number) {
  tickInput(time)

  // global keys
  if (keyPressed('m')) {
    audio.settings.muted = !audio.settings.muted
    audio.applySettings()
  }

  if (state === 'title') {
    if (!demo) demo = newDemo()
    simulate(demo, dt, true)
    if (demo.phase === 'draft') {
      const card = pick(demo.draftChoices)
      if (card) applyCard(demo, card)
      if (demo.hour >= 10) demo = newDemo()
      else startHour(demo, demo.hour + 1)
      if (demo) {
        demo.phase = 'hour'
        demo.bannerT = 0
      }
    } else if (demo.phase === 'dawn' || demo.phase === 'nightfall') {
      demo = newDemo()
    }
    updateParticles(dt)
    if (keyPressed('enter') && currentScreen() === 'title') startGame()
    endFrame()
    return
  }

  const r = run
  if (!r) {
    endFrame()
    return
  }

  debugKeys(r, forceWin, skipHour)

  // pause toggling
  if (keyPressed('escape', 'p')) {
    if (currentScreen() === 'pause') hideAll()
    else if (!currentScreen() && (r.phase === 'hour' || r.phase === 'banner')) showPause()
  }
  if (currentScreen() === 'pause' && keyPressed('r')) startGame()

  // draft keyboard picks
  if (r.phase === 'draft') {
    if (keyPressed('1')) pickCard(0)
    if (keyPressed('2')) pickCard(1)
    if (keyPressed('3')) pickCard(2)
  }

  const paused = currentScreen() === 'pause' || currentScreen() === 'help'
  if (!paused) {
    if (r.phase === 'hour' || r.phase === 'banner') {
      if (!consumeFreeze(dt)) {
        simulate(r, dt, false)
        tutorialTick(r)
      }
      updateParticles(dt)
    } else if (r.phase === 'dawn' || r.phase === 'nightfall') {
      r.cineT += dt
      updateParticles(dt * 0.5)
      // dawn dissolves the void; nightfall is swallowed by it
      if (r.phase === 'dawn' && r.enemies.length > 0 && rand() < 0.5) {
        const e = r.enemies.pop()!
        if (r.bossRef === e) r.bossRef = null
      }
      if (r.cineT > 3.4) {
        r.phase = 'over'
        finalizeRun(r)
        hudEl.classList.add('hidden')
        showEnd(r, records, newBest, endCause)
      }
    }
  }

  // music follows the night
  if (r.phase === 'hour' || r.phase === 'banner') {
    const boss = r.bossRef ? 1 : 0
    audio.intensity = clamp(0.22 + (Math.min(r.hour, 14) / 12) * 0.72 + boss * 0.3, 0.2, 1)
  } else if (r.phase === 'draft') {
    audio.intensity = 0.18
  }

  // phase-driven screens
  if (r.phase !== prevPhase) {
    if (r.phase === 'draft') showDraft(r)
    prevPhase = r.phase
  }

  updateHud(r, records.bestScore)
  updateToasts(r, dt)
  updateBanner(r)
  endFrame()
}

// ---------------------------------------------------------------------------
// render
// ---------------------------------------------------------------------------
function render() {
  const r = state === 'title' ? demo : run
  ctx.setTransform(viewScale, 0, 0, viewScale, 0, 0)
  if (!r) {
    ctx.fillStyle = '#060412'
    ctx.fillRect(0, 0, WORLD.w, WORLD.h)
    return
  }
  const sh = shakeOffset(time)
  if (sh.x !== 0 || sh.y !== 0) {
    ctx.translate(WORLD.w / 2 + sh.x, WORLD.h / 2 + sh.y)
    ctx.rotate(sh.r)
    ctx.translate(-WORLD.w / 2, -WORLD.h / 2)
  }
  drawWorld(ctx, r, time)
}

// ---------------------------------------------------------------------------
// main loop — fixed timestep sim, per-frame render
// ---------------------------------------------------------------------------
const STEP = 1 / 60
let acc = 0
let lastT = performance.now()
let fpsAvg = 60
let slowFrames = 0

function frame(now: number) {
  requestAnimationFrame(frame)
  let dt = (now - lastT) / 1000
  lastT = now
  fpsAvg = fpsAvg * 0.95 + (1 / Math.max(dt, 0.001)) * 0.05
  // adaptive particle quality
  if (dt > 0.022) {
    if (++slowFrames > 30) setQuality(0.5)
  } else if (slowFrames > 0) {
    slowFrames = Math.max(0, slowFrames - 2)
    if (slowFrames === 0) setQuality(1)
  }

  dt = Math.min(dt, 0.1) * debugState.timescale
  time += dt
  acc += dt
  let steps = 0
  while (acc >= STEP && steps < 6) {
    update(STEP)
    acc -= STEP
    steps++
  }
  if (steps === 6) acc = 0 // don't spiral after a long tab-away
  render()
  debugPanel(fpsAvg, run ?? demo)
}

// expose hooks for automated verification (?debug=1)
if (debugState.enabled) {
  ;(window as unknown as Record<string, unknown>).__game = {
    get state() { return state },
    get run() { return run },
    get demo() { return demo },
    startGame,
    skipHour,
    forceWin,
    forceLose: () => { if (run) run.star.hp = 0 },
    pickCard,
  }
}

quitToTitle()
requestAnimationFrame(frame)
