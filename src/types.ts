// Central game-state data model. Pure data + factory — no behavior here.

import type { EnemyKind, TurretKind } from './config'
import { ENEMIES, HOURS, SERPENT, STAR } from './config'

export type MoteKind = TurretKind | 'sun'

export interface PathPoint { x: number; y: number }

export interface Segment {
  kind: TurretKind
  tier: 1 | 2 | 3
  x: number
  y: number
  /** tangent angle along the spine (direction of travel) */
  ang: number
  hp: number
  maxHp: number
  /** turret cooldown */
  cd: number
  /** time since last damaged (for regen) */
  sinceHit: number
  /** white hit-flash timer */
  flash: number
  /** spawn-in scale animation */
  born: number
}

export type EnemyState = 'seek' | 'gnaw' | 'gnawStar' | 'flee' | 'windup' | 'charge' | 'orbit' | 'dive'

export interface Enemy {
  kind: EnemyKind
  x: number
  y: number
  vx: number
  vy: number
  hp: number
  maxHp: number
  r: number
  speed: number
  state: EnemyState
  /** 0..1 slow amount applied this frame (from frost) */
  slow: number
  /** slow applied by storm's Tidal Lightning card */
  shockSlowT: number
  /** which segment index it is gnawing (-1 none) */
  gnawIdx: number
  attackCd: number
  flash: number
  born: number
  /** decoy taunt: while >0, path to tauntX/Y */
  tauntT: number
  tauntX: number
  tauntY: number
  /** generic per-kind timers (bosses, spitters) */
  t1: number
  t2: number
  phase: number
  /** charge/dive direction */
  dirX: number
  dirY: number
  spin: number
  desperate: boolean
}

export interface Bullet {
  kind: 'fang' | 'spit'
  x: number
  y: number
  vx: number
  vy: number
  dmg: number
  r: number
  life: number
  fromEnemy: boolean
}

export interface Shell {
  // ember mortar shell — travels on a faked arc for `time`, then bursts
  x0: number; y0: number
  x1: number; y1: number
  t: number
  time: number
  dmg: number
  splash: number
}

export interface Mote {
  kind: MoteKind
  x: number
  y: number
  vx: number
  vy: number
  life: number
  seed: number
}

export interface Decoy {
  x: number
  y: number
  t: number // counts down to blast
}

/** transient — rebuilt every frame by turrets for rendering */
export interface BeamVis {
  x: number; y: number
  ang: number
  len: number
  width: number
  color: string
  power: number // >1 for merged groups
}

export interface ArcVis {
  // storm lightning render data (short-lived)
  pts: { x: number; y: number }[]
  life: number
}

export interface SpawnTelegraph {
  x: number
  y: number
  t: number
  kind: EnemyKind
}

export interface Toast {
  msg: string
  t: number
  total: number
}

export interface Stats {
  kills: number
  killsByKind: Partial<Record<EnemyKind, number>>
  dmgByTurret: Record<TurretKind, number>
  dmgMolt: number
  dmgRam: number
  motesEaten: number
  molts: number
  peakLength: number
  timePlayed: number
}

export type RunPhase =
  | 'hour'        // wave in progress
  | 'draft'       // between hours, picking a card (world frozen)
  | 'banner'      // "HOUR N" splash before the wave starts
  | 'dawn'        // victory cinematic
  | 'nightfall'   // defeat cinematic
  | 'over'        // end screen is up

export interface DraftCardDef {
  id: string
  name: string
  rarity: 'common' | 'rare' | 'epic'
  desc: string
  flavor: string
  maxStacks: number
  /** which turret kind it requires on the body (undefined = always available) */
  requires?: TurretKind
  icon: TurretKind | 'star' | 'wyrm' | 'molt'
}

export interface Run {
  phase: RunPhase
  hour: number // 1-based
  hourT: number // elapsed seconds in current hour
  hourDuration: number
  endless: boolean
  time: number
  score: number

  // serpent
  path: PathPoint[] // head-first history of positions
  pathLen: number // total polyline length
  headX: number
  headY: number
  headAng: number
  headHp: number
  headMaxHp: number
  iframes: number
  stamina: number
  surging: boolean
  surgeRegenWait: number
  speedBoostT: number
  moltCd: number
  segments: Segment[]

  // world
  enemies: Enemy[]
  bullets: Bullet[]
  shells: Shell[]
  motes: Mote[]
  decoys: Decoy[]
  telegraphs: SpawnTelegraph[]
  beams: BeamVis[]
  arcs: ArcVis[]

  star: { hp: number; maxHp: number; hurtT: number; pulseT: number; trickleT: number }

  // spawner
  budget: number
  budgetSpent: number
  budgetTotal: number
  pulseT: number
  bossSpawned: boolean
  bossRef: Enemy | null
  /** accumulates ENEMIES[kind].moteValue; each whole point drops a mote */
  moteCredit: number

  // draft
  draftChoices: DraftCardDef[]
  upgrades: Record<string, number> // cardId -> stacks

  // cinematics
  cineT: number
  victory: boolean

  bannerT: number
  bannerText: string
  bannerSub: string

  toasts: Toast[]
  tutorialSeen: Record<string, boolean>

  stats: Stats

  // fx / misc
  freeze: number // hit-stop timer (seconds of frozen sim)
  usedSecondDawn: boolean
}

export function newStats(): Stats {
  return {
    kills: 0,
    killsByKind: {},
    dmgByTurret: { fang: 0, storm: 0, frost: 0, ember: 0, prism: 0 },
    dmgMolt: 0,
    dmgRam: 0,
    motesEaten: 0,
    molts: 0,
    peakLength: 0,
    timePlayed: 0,
  }
}

export function newRun(): Run {
  return {
    phase: 'banner',
    hour: 1,
    hourT: 0,
    hourDuration: HOURS[0].duration,
    endless: false,
    time: 0,
    score: 0,

    path: [],
    pathLen: 0,
    headX: 0,
    headY: 0,
    headAng: 0,
    headHp: SERPENT.headMaxHp,
    headMaxHp: SERPENT.headMaxHp,
    iframes: 0,
    stamina: SERPENT.stamina,
    surging: false,
    surgeRegenWait: 0,
    speedBoostT: 0,
    moltCd: 0,
    segments: [],

    enemies: [],
    bullets: [],
    shells: [],
    motes: [],
    decoys: [],
    telegraphs: [],
    beams: [],
    arcs: [],

    star: { hp: STAR.hp, maxHp: STAR.hp, hurtT: 0, pulseT: 0, trickleT: 0 },

    budget: 0,
    budgetSpent: 0,
    budgetTotal: 0,
    pulseT: 2.5,
    bossSpawned: false,
    bossRef: null,
    moteCredit: 0,

    draftChoices: [],
    upgrades: {},

    cineT: 0,
    victory: false,

    bannerT: 0,
    bannerText: '',
    bannerSub: '',

    toasts: [],
    tutorialSeen: {},

    stats: newStats(),

    freeze: 0,
    usedSecondDawn: false,
  }
}

/** effective enemy hp at a given hour */
export function scaledHp(kind: EnemyKind, hour: number, scaleCoef: number, scalePow: number): number {
  const base = ENEMIES[kind].hp
  return base * (1 + scaleCoef * Math.pow(Math.max(0, hour - 1), scalePow))
}
