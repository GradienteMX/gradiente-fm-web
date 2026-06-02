// noveltySim.mjs — multi-axis novelty-weighted HP contribution + spread tuning.
//
// Box-breaking under the hood (no UI): the HP a user grants is scaled by how
// novel the content is to THEM, across three axes — genre, content-type, vibe.
// Reads stay global (No Algorithm intact); only the write-weight is personal.
//
//   familiarity_axis φ_a ∈ [0,1]  = how much of the user's recent attention on
//                                    that axis has gone to this item's value(s)
//   composite φ = wG·φ_genre + wT·φ_type + wV·φ_vibe        (axis weights sum 1)
//   multiplier m = clamp( M_MIN + (M_MAX - M_MIN)·(1 - φ)^GAMMA , M_MIN, M_MAX )
//
// Blending FAMILIARITIES (not multiplying per-axis multipliers) keeps m bounded
// in [M_MIN, M_MAX] regardless of axis count — adding axes refines, never explodes.
//
// Run: node scripts/noveltySim.mjs

const AXIS_WEIGHTS = { genre: 0.5, type: 0.2, vibe: 0.3 } // genre is the strongest "box"

// Candidate spreads. "gentle" = a real but subtle thumb on the scale; the
// familiar interaction is barely discounted, the novel one mildly rewarded.
// SHIPPED: "gentle" — these constants are mirrored in record_hp_event()
// (supabase/migrations/0025_novelty_weighting.sql). Keep the two in lockstep;
// re-tune here against production affinity data, then update the migration.
const PRESETS = {
  gentle:   { M_MIN: 0.6, M_MAX: 1.5, GAMMA: 1.0 }, // ← live
  moderate: { M_MIN: 0.5, M_MAX: 1.7, GAMMA: 1.3 },
  hot:      { M_MIN: 0.4, M_MAX: 2.0, GAMMA: 1.5 },
}

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)) }

// A user's recent-attention shares on each axis (each axis sums to ~1).
const USERS = {
  'house-head': {
    genre: { house: 0.85, techno: 0.12, jazz: 0.03 },
    type:  { mix: 0.55, evento: 0.35, review: 0.07, editorial: 0.03 },
    vibe:  { high: 0.75, mid: 0.20, low: 0.05 },
  },
  'eclectic': {
    genre: { house: 0.30, techno: 0.25, jazz: 0.25, dub: 0.20 },
    type:  { mix: 0.25, evento: 0.25, review: 0.25, editorial: 0.25 },
    vibe:  { high: 0.34, mid: 0.33, low: 0.33 },
  },
}

// Items by axis values. vibeBand: low 0-3 / mid 4-6 / high 7-10.
const ITEMS = {
  'echo      (house · mix · vibe-high)':      { genres: ['house'], type: 'mix',       vibe: 'high' },
  'partial   (house · editorial · vibe-low)': { genres: ['house'], type: 'editorial', vibe: 'low'  },
  'crossover (jazz · editorial · vibe-low)':  { genres: ['jazz'],  type: 'editorial', vibe: 'low'  },
}

function familiarity(user, item) {
  const fG = item.genres.reduce((a, g) => a + (user.genre[g] ?? 0), 0) / item.genres.length
  const fT = user.type[item.type] ?? 0
  const fV = user.vibe[item.vibe] ?? 0
  return AXIS_WEIGHTS.genre * fG + AXIS_WEIGHTS.type * fT + AXIS_WEIGHTS.vibe * fV
}
function multiplier(user, item, p) {
  const phi = familiarity(user, item)
  return clamp(p.M_MIN + (p.M_MAX - p.M_MIN) * Math.pow(1 - phi, p.GAMMA), p.M_MIN, p.M_MAX)
}

console.log('\nMulti-axis novelty — house-head interacting with three items, by spread')
console.log(`axis weights: genre ${AXIS_WEIGHTS.genre} · type ${AXIS_WEIGHTS.type} · vibe ${AXIS_WEIGHTS.vibe}\n`)
const u = USERS['house-head']
for (const [pName, p] of Object.entries(PRESETS)) {
  console.log(`■ ${pName.padEnd(9)} (M_MIN ${p.M_MIN} · M_MAX ${p.M_MAX} · GAMMA ${p.GAMMA})`)
  let echoM = 1, crossM = 1
  for (const [label, item] of Object.entries(ITEMS)) {
    const m = multiplier(u, item, p)
    if (label.startsWith('echo')) echoM = m
    if (label.startsWith('crossover')) crossM = m
    console.log(`    ${label.padEnd(42)} ${m.toFixed(2)}×`)
  }
  console.log(`    → crossover vs echo HP ratio (same raw interactions): ${(crossM / echoM).toFixed(2)}×\n`)
}
console.log('Reading: "echo" = the user doing exactly what they always do (discounted).')
console.log('"crossover" = novel on all 3 axes (rewarded). "partial" = familiar genre, new')
console.log('format+vibe. The ratio is how much harder a crossover interaction pushes than an')
console.log('echo one. Pick the gentlest spread whose ratio still feels like it matters.\n')
