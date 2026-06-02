// hpSim.mjs — POPULATION tier simulation for HP engagement-weight tuning.
//
// Why population, not single-item: score = (hp / peakForType) * typeMult, and
// peakForType is the hottest item of that type in the WHOLE feed. A single item
// is trivially its own peak (→ always lg), which is misleading. What actually
// matters is an item's HP *relative to its competition*, and how much crowd
// engagement can dilute editorial's fixed spawn head-start (50 vs 20) — spawn is
// an additive floor that does NOT scale with the weights, so larger weights make
// engagement matter more relative to the editorial lever.
//
// Mirrors the real math (lib/curation.ts + apply_hp_rollup):
//   decay: hp *= exp(-ln2 * Δt / halfLife);  rollup adds Σ(weight) per tick
//   score = (hp / max hp of type) * typeMult;  lg ≥ 1.0, md ≥ 0.5, else sm
//
// Run: node scripts/hpSim.mjs

const LN2 = Math.log(2)

const WEIGHTS = {
  conservative: { click: 0.5, open: 1.0, save: 3.0, comment: 2.0 },
  balanced:     { click: 0.5, open: 1.5, save: 4.0, comment: 3.0 },
  aggressive:   { click: 0.5, open: 2.5, save: 6.0, comment: 4.0 },
}

const TYPE = { name: 'mix', halfLifeHours: 504, typeMult: 1.0 }
const DAYS = 14

// Daily interaction profiles, expressed at "growth" scale. A VOLUME multiplier
// scales them down to realistic 100-user beta traffic vs a larger audience.
const COLD    = { click: 0,  open: 0,  save: 0, comment: 0 }
const LOW     = { click: 2,  open: 1,  save: 0, comment: 0 }
const WARM    = { click: 8,  open: 3,  save: 1, comment: 1 }
const POPULAR = { click: 18, open: 8,  save: 3, comment: 2 }
const VOLUMES = { 'beta (~0.15×)': 0.15, 'growth (1×)': 1.0 }

// The feed: 4 tracked items + filler to make peak[type] realistic.
function buildPopulation() {
  const pop = [
    { id: 'EDITORIAL · tended',     editorial: true,  profile: WARM },
    { id: 'EDITORIAL · neglected',  editorial: true,  profile: LOW },
    { id: 'non-ed · crowd favorite', editorial: false, profile: POPULAR },
    { id: 'non-ed · cold',          editorial: false, profile: COLD },
  ]
  // 18 filler non-editorial items, deterministic spread of low engagement so
  // the peak isn't defined solely by our tracked items.
  let seed = 1234567
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  for (let i = 0; i < 18; i++) {
    const r = rand()
    const profile = r < 0.6 ? LOW : r < 0.9 ? WARM : POPULAR
    pop.push({ id: `filler${i}`, editorial: r < 0.15, profile, hidden: true })
  }
  return pop
}

function dailyDelta(weights, p, vol) {
  return vol * (weights.click * p.click + weights.open * p.open + weights.save * p.save + weights.comment * p.comment)
}
function tierOf(score) { return score >= 1.0 ? 'lg' : score >= 0.5 ? 'md' : 'sm' }

function simulate(weights, vol) {
  const dayDecay = Math.exp((-LN2 * 24) / TYPE.halfLifeHours)
  const items = buildPopulation().map((it) => ({ ...it, hp: it.editorial ? 50 : 20 }))
  for (let day = 1; day <= DAYS; day++) {
    for (const it of items) it.hp = it.hp * dayDecay + dailyDelta(weights, it.profile, vol)
  }
  const peak = Math.max(...items.map((it) => it.hp))
  for (const it of items) {
    it.score = (it.hp / peak) * TYPE.typeMult
    it.tier = tierOf(it.score)
  }
  return items
}

console.log(`\nPopulation HP simulation — type: ${TYPE.name} (half-life ${TYPE.halfLifeHours}h), `
  + `${DAYS} days, 22 items competing for peak\n`)
console.log('Tracking 4 items: editorial-tended, editorial-neglected, non-ed-favorite, non-ed-cold')
console.log('Desired: favorite can pass neglected-editorial; tended-editorial stays high; cold stays sm.\n')
console.log('volume          weights        ed-tended   ed-neglect   favorite     cold     verdict')
console.log('─'.repeat(92))
for (const [vName, vol] of Object.entries(VOLUMES)) {
  for (const [wName, weights] of Object.entries(WEIGHTS)) {
    const items = simulate(weights, vol)
    const get = (id) => items.find((i) => i.id === id)
    const t = get('EDITORIAL · tended'), n = get('EDITORIAL · neglected')
    const f = get('non-ed · crowd favorite'), c = get('non-ed · cold')
    const cell = (it) => `${it.tier}(${it.score.toFixed(2)})`
    const verdict = f.score > n.score ? `fav +${(f.score - n.score).toFixed(2)}` : `ed +${(n.score - f.score).toFixed(2)}`
    console.log(
      `${vName.padEnd(15)} ${wName.padEnd(13)} ${cell(t).padStart(10)}  ${cell(n).padStart(10)}  ` +
      `${cell(f).padStart(10)}  ${cell(c).padStart(8)}  ${verdict}`,
    )
  }
  console.log('─'.repeat(92))
}
console.log('\ncell = tier(score). Note how little the verdict moves across weight columns —')
console.log('magnitude is nearly a no-op; volume regime and decay balance are the real levers.\n')
