// ============================================================================
// WYRMLIGHT — all tuning constants live here.
// ============================================================================

export const WORLD = { w: 1760, h: 990 } as const
export const CENTER = { x: WORLD.w / 2, y: WORLD.h / 2 } as const

// ---------------------------------------------------------------------------
// Palette — deep night, gilt serpent, void enemies. One source of truth so the
// whole game reads as a single piece.
// ---------------------------------------------------------------------------
export const PAL = {
  bgTop: '#060412',
  bgMid: '#0a071e',
  bgBot: '#070516',
  starCore: '#fff3d6',
  starGlow: '#ffd27a',
  starDim: '#8a6a3a',
  gold: '#e8c476',
  goldDeep: '#c9a86a',
  goldDark: '#6b5426',
  bone: '#f2e7cf',
  boneDim: '#b9ab8d',
  serpentPlate: '#231b12',
  serpentRim: '#d8b878',
  fang: '#ffb84d',
  storm: '#7ce8ff',
  frost: '#9fd9ff',
  ember: '#ff8a3d',
  prism: '#e6d6ff',
  sun: '#fff0b3',
  enemy: '#ff4059',
  enemyDark: '#5c0d20',
  stinger: '#ff2fa0',
  spitter: '#c05cff',
  splitter: '#ff7040',
  husk: '#d92a4e',
  boss: '#ff2444',
  voidsmoke: '#1a0a14',
  danger: '#ff5f4a',
  heal: '#9dffb0',
} as const

// ---------------------------------------------------------------------------
// Serpent
// ---------------------------------------------------------------------------
export const SERPENT = {
  speed: 225,
  surgeSpeedMul: 1.55,
  turnRate: 3.7, // rad/s
  surgeTurnMul: 1.22,
  headR: 14,
  segR: 11.5,
  spacing: 21, // arc-length between segments
  pathStep: 3, // min px between recorded path points
  maxSegments: 34,
  startBody: ['fang', 'fang', 'storm'] as const,

  headMaxHp: 6,
  headIframes: 1.0,

  segHp: 44,
  segHpPerTier: 10,
  segRegenDelay: 3.5,
  segRegenRate: 11,

  stamina: 100,
  surgeDrain: 36,
  surgeRegen: 30,
  surgeRegenDelay: 0.5,
  surgeMinStart: 18,
  ramDamage: 32,

  moltMinSegments: 7,
  moltShed: 3,
  moltCooldown: 16,
  moltTauntRadius: 330,
  moltFuse: 2.6,
  moltBlastRadius: 175,
  moltBlastDamage: 120,
  moltSpeedBoost: 1.3,
  moltSpeedBoostT: 1.2,

  eatRadius: 30,
  magnetRadius: 95,
} as const

// ---------------------------------------------------------------------------
// Turrets (per segment kind). tierMul applies to damage-ish numbers.
// ---------------------------------------------------------------------------
export type TurretKind = 'fang' | 'storm' | 'frost' | 'ember' | 'prism'

export const TIER_MUL = [1, 1.7, 2.65] as const // tier 1..3

export const TURRETS = {
  fang: {
    name: 'Fang', color: PAL.fang,
    dmg: 6.5, rof: 2.2, range: 340, bulletSpeed: 560,
  },
  storm: {
    name: 'Storm', color: PAL.storm,
    dmg: 5, rof: 0.85, range: 250, chainRadius: 150, chains: 3,
  },
  frost: {
    name: 'Rime', color: PAL.frost,
    slow: 0.42, radius: 135, // slow fraction inside aura
  },
  ember: {
    name: 'Ember', color: PAL.ember,
    dmg: 20, rof: 0.5, rangeMin: 170, rangeMax: 540, splash: 85, shellTime: 0.85,
  },
  prism: {
    name: 'Prism', color: PAL.prism,
    dps: 10, length: 300, width: 7,
    mergeAngle: 0.24, // rad tolerance between tangents for merging
    mergeGap: 2, // max slot gap between prisms in a group
    mergePow: 1.38, // group dps = n^mergePow * base
  },
} as const

export const TURRET_INFO: Record<TurretKind, { title: string; blurb: string }> = {
  fang: { title: 'FANG', blurb: 'Swift bolts strike the nearest foe. The workhorse of the coil.' },
  storm: { title: 'STORM', blurb: 'Lightning arcs between clustered enemies. Herd them, then harvest.' },
  frost: { title: 'RIME', blurb: 'A freezing aura slows all it touches. Wall with it. Combos with everything.' },
  ember: { title: 'EMBER', blurb: 'Lobs blazing shells at distant foes. Blind up close — keep it deep in your coil.' },
  prism: { title: 'PRISM', blurb: 'Beams lance out from your flanks. ALIGN prisms in a straight run to merge them into one great ray.' },
}

// ---------------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------------
export type EnemyKind = 'mite' | 'stinger' | 'spitter' | 'splitter' | 'husk' | 'maw' | 'eclipse'

export interface EnemyDef {
  hp: number
  speed: number
  r: number
  cost: number // wave budget points
  moteValue: number // mote-drop credit
  starDmg: number
  starBiteT: number
  segDmg: number
  segBiteT: number
  score: number
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  mite:    { hp: 13,  speed: 86,  r: 8,  cost: 1,   moteValue: 0.15, starDmg: 2,  starBiteT: 1.1, segDmg: 6,  segBiteT: 1.0, score: 10 },
  stinger: { hp: 24,  speed: 188, r: 9,  cost: 2.2, moteValue: 0.4,  starDmg: 0,  starBiteT: 1,   segDmg: 0,  segBiteT: 1,   score: 25 },
  spitter: { hp: 48,  speed: 62,  r: 12, cost: 3.5, moteValue: 0.5,  starDmg: 0,  starBiteT: 1,   segDmg: 0,  segBiteT: 1,   score: 35 },
  splitter:{ hp: 65,  speed: 72,  r: 15, cost: 4,   moteValue: 0.55, starDmg: 4,  starBiteT: 1.3, segDmg: 9,  segBiteT: 1.2, score: 40 },
  husk:    { hp: 150, speed: 36,  r: 20, cost: 5,   moteValue: 0.75, starDmg: 9,  starBiteT: 1.6, segDmg: 18, segBiteT: 1.5, score: 60 },
  maw:     { hp: 2300, speed: 30, r: 36, cost: 0,   moteValue: 0,    starDmg: 10, starBiteT: 1.5, segDmg: 22, segBiteT: 1.4, score: 600 },
  eclipse: { hp: 5600, speed: 42, r: 46, cost: 0,   moteValue: 0,    starDmg: 15, starBiteT: 1.4, segDmg: 26, segBiteT: 1.3, score: 1500 },
}

export const ENEMY_INFO: Record<EnemyKind, { title: string; blurb: string }> = {
  mite: { title: 'MITE', blurb: 'Chaff of the Void. Swarms the Star and gnaws your coils.' },
  stinger: { title: 'STINGER', blurb: 'Hunts YOUR HEAD. Fast. Dodge it or surge through it.' },
  spitter: { title: 'SPITTER', blurb: 'Keeps its distance and spits void-bolts. Punishes a lazy coil.' },
  splitter: { title: 'SPLITTER', blurb: 'Bursts into mites when slain. Pop it away from the Star.' },
  husk: { title: 'HUSK', blurb: 'A slow siege engine. Chews through segments and Star alike.' },
  maw: { title: 'THE MAW', blurb: 'Charges the Star in telegraphed lunges. Feed it lightning.' },
  eclipse: { title: 'THE ECLIPSE', blurb: 'The night made flesh. Slay it and the dawn is yours.' },
}

// hp scale per hour: hp * (1 + coef * (hour-1)^pow)
export const SCALE = { coef: 0.105, pow: 1.3 }

export const SPIT = { range: 430, boltSpeed: 265, boltDmgSeg: 12, boltDmgStar: 5, boltDmgHead: 1, cooldown: 2.6 }

export const STINGER_HIT = 1 // head pips per stinger

// ---------------------------------------------------------------------------
// Bosses
// ---------------------------------------------------------------------------
export const MAW = {
  chargeInterval: 7.5,
  chargeTelegraph: 1.1,
  chargeSpeed: 620,
  chargeDamageSeg: 30,
  spawnInterval: 9,
  spawnCount: 4,
  starHit: 14,
}

export const ECLIPSE = {
  orbitRadius: 420,
  orbitSpeed: 0.24, // rad/s
  beamInterval: 8.5,
  beamTelegraph: 1.4,
  beamDuration: 2.6,
  beamDps: 26, // to segments crossing it
  beamHeadPips: 1, // per hit with iframes
  diveInterval: 14,
  diveSpeed: 540,
  starHit: 16,
  spawnInterval: 7,
}

// ---------------------------------------------------------------------------
// The Star
// ---------------------------------------------------------------------------
export const STAR = {
  hp: 100,
  r: 46,
  trickleInterval: 8.0, // seconds per free mote during waves
  trickleDist: 190, // motes land near the star
  sunHealStar: 8,
  sunHealHead: 1,
}

// ---------------------------------------------------------------------------
// Motes (pickups)
// ---------------------------------------------------------------------------
export const MOTES = {
  life: 11,
  blinkAt: 3,
  r: 9,
  drift: 14,
}

// ---------------------------------------------------------------------------
// Waves — the twelve hours of the night.
// ---------------------------------------------------------------------------
export interface HourDef {
  duration: number
  budgetPerSec: number
  weights: Partial<Record<EnemyKind, number>>
  boss?: 'maw' | 'eclipse'
  title: string
}

export const HOURS: HourDef[] = [
  { duration: 32, budgetPerSec: 0.95, weights: { mite: 1 }, title: 'DUSK' },
  { duration: 38, budgetPerSec: 1.35, weights: { mite: 0.8, stinger: 0.2 }, title: 'FIRST WATCH' },
  { duration: 42, budgetPerSec: 1.8, weights: { mite: 0.6, husk: 0.25, stinger: 0.15 }, title: 'GLOAMING' },
  { duration: 44, budgetPerSec: 2.3, weights: { mite: 0.5, husk: 0.22, stinger: 0.15, spitter: 0.13 }, title: 'MOONSET' },
  { duration: 48, budgetPerSec: 2.8, weights: { mite: 0.38, husk: 0.24, stinger: 0.15, spitter: 0.13, splitter: 0.1 }, title: 'DEEP NIGHT' },
  { duration: 60, budgetPerSec: 1.7, weights: { mite: 0.7, stinger: 0.3 }, boss: 'maw', title: 'THE MAW RISES' },
  { duration: 48, budgetPerSec: 3.4, weights: { mite: 0.34, husk: 0.24, stinger: 0.16, spitter: 0.14, splitter: 0.12 }, title: 'STARLESS HOUR' },
  { duration: 52, budgetPerSec: 3.9, weights: { mite: 0.26, husk: 0.34, stinger: 0.14, spitter: 0.14, splitter: 0.12 }, title: 'THE LONG DARK' },
  { duration: 52, budgetPerSec: 4.4, weights: { mite: 0.31, husk: 0.2, stinger: 0.19, spitter: 0.2, splitter: 0.1 }, title: 'HOWLING VOID' },
  { duration: 56, budgetPerSec: 5.0, weights: { mite: 0.24, husk: 0.22, stinger: 0.16, spitter: 0.14, splitter: 0.24 }, title: 'THE SWARM' },
  { duration: 58, budgetPerSec: 5.7, weights: { mite: 0.22, husk: 0.26, stinger: 0.18, spitter: 0.18, splitter: 0.16 }, title: 'LAST WATCH' },
  { duration: 75, budgetPerSec: 2.6, weights: { mite: 0.4, stinger: 0.25, spitter: 0.2, splitter: 0.15 }, boss: 'eclipse', title: 'THE ECLIPSE' },
]

export const ENDLESS = {
  duration: 55,
  budgetBase: 5.7,
  budgetGrowth: 1.13, // per hour past 12
  weights: { mite: 0.22, husk: 0.26, stinger: 0.18, spitter: 0.18, splitter: 0.16 } as Partial<Record<EnemyKind, number>>,
  mawEvery: 3,
}

export const INTERMISSION_BANNER = 1.6 // seconds of "HOUR N" banner

// pulses: spawner spends accumulated budget in bursts
export const SPAWN = {
  pulseMin: 5,
  pulseMax: 8.5,
  telegraph: 0.9,
  edgePad: 26, // spawn just inside the arena edge
  desperationSpeed: 1.35, // stragglers speed up after hour budget is done
}

// ---------------------------------------------------------------------------
// Score
// ---------------------------------------------------------------------------
export const SCORE = {
  hourClear: 120, // * hour number
  starHpBonusMul: 14, // * remaining star hp at end (victory)
  eatBonus: 5,
}

// ---------------------------------------------------------------------------
// FX budgets
// ---------------------------------------------------------------------------
export const FX = {
  maxParticles: 1300,
  shakeMax: 11,
}
