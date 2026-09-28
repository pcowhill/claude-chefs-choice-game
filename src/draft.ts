// Between-hour draft: the Star offers three boons; pick one.

import type { DraftCardDef, Run } from './types'
import { healStar } from './star'
import { rand } from './util'

export const CARDS: DraftCardDef[] = [
  // --- fang -----------------------------------------------------------------
  { id: 'whettedFangs', name: 'Whetted Fangs', rarity: 'common', maxStacks: 3, requires: 'fang', icon: 'fang',
    desc: 'Fang damage +25%.', flavor: 'Every scale a spearpoint.' },
  { id: 'rapidFangs', name: 'Rain of Fangs', rarity: 'common', maxStacks: 2, requires: 'fang', icon: 'fang',
    desc: 'Fang fire rate +20%.', flavor: 'The night bristles with gold.' },
  // --- storm ----------------------------------------------------------------
  { id: 'chargedStorm', name: 'Charged Storm', rarity: 'common', maxStacks: 3, requires: 'storm', icon: 'storm',
    desc: 'Storm damage +25%.', flavor: 'Thunder remembers.' },
  { id: 'forkedStorm', name: 'Forked Storm', rarity: 'rare', maxStacks: 2, requires: 'storm', icon: 'storm',
    desc: 'Storm arcs chain to +1 enemy.', flavor: 'One bolt, many graves.' },
  { id: 'tidalLightning', name: 'Tidal Lightning', rarity: 'epic', maxStacks: 1, requires: 'storm', icon: 'storm',
    desc: 'Storm hits slow enemies for 1s.', flavor: 'The sky drags them under.' },
  // --- frost ----------------------------------------------------------------
  { id: 'deepRime', name: 'Deep Rime', rarity: 'rare', maxStacks: 2, requires: 'frost', icon: 'frost',
    desc: 'Rime slows +12% and reaches +18% further.', flavor: 'Cold beyond patience.' },
  { id: 'bitingRime', name: 'Biting Rime', rarity: 'common', maxStacks: 2, requires: 'frost', icon: 'frost',
    desc: 'Rime auras also deal damage over time.', flavor: 'The frost grows teeth.' },
  // --- ember ----------------------------------------------------------------
  { id: 'siegeEmbers', name: 'Siege Embers', rarity: 'common', maxStacks: 3, requires: 'ember', icon: 'ember',
    desc: 'Ember damage +25%.', flavor: 'A falling season of fire.' },
  { id: 'clusterEmbers', name: 'Cluster Embers', rarity: 'rare', maxStacks: 2, requires: 'ember', icon: 'ember',
    desc: 'Ember blast radius +35%.', flavor: 'Nowhere to stand.' },
  // --- prism ----------------------------------------------------------------
  { id: 'burningFocus', name: 'Burning Focus', rarity: 'common', maxStacks: 3, requires: 'prism', icon: 'prism',
    desc: 'Prism damage +25%.', flavor: 'Light, sharpened.' },
  { id: 'lensArray', name: 'Lens Array', rarity: 'rare', maxStacks: 2, requires: 'prism', icon: 'prism',
    desc: 'Prisms merge at wider angles; merged rays +15%.', flavor: 'Straighten the spine. Become the blade.' },
  // --- serpent --------------------------------------------------------------
  { id: 'quickCoils', name: 'Quick Coils', rarity: 'common', maxStacks: 2, icon: 'wyrm',
    desc: 'Move 7% faster, turn 12% tighter.', flavor: 'The river does not ask the stone.' },
  { id: 'ancientScales', name: 'Ancient Scales', rarity: 'rare', maxStacks: 2, icon: 'wyrm',
    desc: 'Segments +30% health and mend sooner.', flavor: 'Older than the dark.' },
  { id: 'starlitBlood', name: 'Starlit Blood', rarity: 'rare', maxStacks: 2, icon: 'wyrm',
    desc: '+1 head heart and fully heal.', flavor: 'What the Star loves, it keeps.' },
  { id: 'longPatience', name: 'Long Patience', rarity: 'common', maxStacks: 2, icon: 'wyrm',
    desc: 'Motes last 4s longer; +40% pickup reach.', flavor: 'All light returns to the coil.' },
  { id: 'deepMolt', name: 'Deep Molt', rarity: 'rare', maxStacks: 1, icon: 'molt',
    desc: 'Molt recharges 25% faster and blasts 40% harder.', flavor: 'Shed the past. Detonate it.' },
  { id: 'overflow2', name: 'Overflowing Light', rarity: 'epic', maxStacks: 1, icon: 'wyrm',
    desc: 'At full length, each mote upgrades TWO segments.', flavor: 'The cup runs over; the coil runs gold.' },
  { id: 'secondDawn', name: 'Second Dawn', rarity: 'epic', maxStacks: 1, icon: 'star',
    desc: 'Once: survive a killing blow.', flavor: 'Even night must blink.' },
  // --- star -----------------------------------------------------------------
  { id: 'solarFont', name: 'Solar Font', rarity: 'rare', maxStacks: 2, icon: 'star',
    desc: 'The Star sheds motes 45% more often.', flavor: 'It burns brighter for you.' },
  { id: 'starWard', name: 'Star Ward', rarity: 'rare', maxStacks: 2, icon: 'star',
    desc: 'Star +20 max integrity and restore 20.', flavor: 'A promise, renewed.' },
]

const RARITY_W = { common: 0.62, rare: 0.3, epic: 0.08 }

export function rollDraft(run: Run): DraftCardDef[] {
  const epicBonus = Math.min(0.14, run.hour * 0.012)
  const have = new Set(run.segments.map((s) => s.kind))
  const eligible = CARDS.filter((c) => {
    if ((run.upgrades[c.id] ?? 0) >= c.maxStacks) return false
    if (c.requires && !have.has(c.requires)) return false
    return true
  })
  const picks: DraftCardDef[] = []
  let guard = 0
  while (picks.length < 3 && guard++ < 200 && eligible.length > picks.length) {
    const roll = rand()
    const wantRarity = roll < RARITY_W.epic + epicBonus ? 'epic' : roll < RARITY_W.epic + epicBonus + RARITY_W.rare ? 'rare' : 'common'
    let pool = eligible.filter((c) => c.rarity === wantRarity && !picks.includes(c))
    if (pool.length === 0) pool = eligible.filter((c) => !picks.includes(c))
    if (pool.length === 0) break
    picks.push(pool[Math.floor(rand() * pool.length)])
  }
  return picks
}

export function applyCard(run: Run, card: DraftCardDef) {
  run.upgrades[card.id] = (run.upgrades[card.id] ?? 0) + 1
  switch (card.id) {
    case 'starlitBlood':
      run.headMaxHp += 1
      run.headHp = run.headMaxHp
      break
    case 'starWard':
      run.star.maxHp += 20
      healStar(run, 20)
      break
  }
}
