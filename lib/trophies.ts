// ── Trophy catalog ──────────────────────────────────────────────────────────
//
// Display metadata for the trophies whose unlock logic lives in migration
// 0019's apply_trophy_unlocks() function. The `key` field MUST stay aligned
// between this file and the SQL — it's the contract.
//
// Trophies are story-shaped (per [[project_user_hp_visibility]]) — names
// avoid numbers, leans toward presence/craft language. Sigils are short
// 1-2 char glyphs that fit the NGE-aesthetic chrome alongside existing
// chip patterns ([!], [?], [◆], [◇]).

export type TrophyKey =
  | 'versatile_voice'
  | 'signal_caster'
  | 'question_caster'
  | 'thread_anchor'
  | 'crowd_compass'
  | 'published_voice'
  | 'presence_logged'
  | 'presence_deep'
  | 'presence_persistent'
  | 'presence_insider_track'

export interface TrophyMeta {
  key: TrophyKey
  label: string         // Spanish, shown as the chip
  description: string   // Spanish, shown on hover / in detail
  sigil: string         // 1-2 char glyph
  color: string         // hex; matches the NGE palette
  family: 'craft' | 'reception' | 'community' | 'presence'
}

// Single source of truth — order matters for the trophy grid render order.
export const TROPHY_CATALOG: readonly TrophyMeta[] = [
  // ── craft (you made things) ─────────────────────────────────────────────
  {
    key: 'versatile_voice',
    label: 'VOZ VERSÁTIL',
    description: 'Publicaste en 5 tipos de contenido distintos.',
    sigil: '◈',
    color: '#22D3EE',  // cyan — scene voice
    family: 'craft',
  },
  {
    key: 'published_voice',
    label: 'PLUMA EN MARCHA',
    description: 'Cinco publicaciones acumuladas.',
    sigil: '✎',
    color: '#22D3EE',
    family: 'craft',
  },

  // ── reception (others responded) ────────────────────────────────────────
  {
    key: 'signal_caster',
    label: 'EMISORA',
    description: 'Tus comentarios han recibido 10 reacciones de señal [!].',
    sigil: '!',
    color: '#F87171',  // red-400 — matches detonador rank
    family: 'reception',
  },
  {
    key: 'question_caster',
    label: 'PUNZONERA',
    description: 'Tus comentarios han recibido 10 reacciones de duda [?].',
    sigil: '?',
    color: '#A78BFA',  // soft violet — matches enigma rank
    family: 'reception',
  },

  // ── community (you sparked something) ───────────────────────────────────
  {
    key: 'thread_anchor',
    label: 'ANCLA',
    description: 'Iniciaste un hilo en el foro que cruzó 20 respuestas.',
    sigil: '⚓',
    color: '#4ADE80',  // green — staff editorial color, reused for community
    family: 'community',
  },
  {
    key: 'crowd_compass',
    label: 'BRÚJULA',
    description: 'Has emitido 25 vibe checks.',
    sigil: '⊕',
    color: '#4ADE80',
    family: 'community',
  },

  // ── presence (sustained engagement) ─────────────────────────────────────
  // Names lean abstract — the four steps are a state of being, not a level.
  {
    key: 'presence_logged',
    label: 'PRESENCIA REGISTRADA',
    description: 'Tu presencia en el sistema fue registrada.',
    sigil: '·',
    color: '#9CA3AF',  // dim grey
    family: 'presence',
  },
  {
    key: 'presence_deep',
    label: 'PRESENCIA SOSTENIDA',
    description: 'Tu presencia ha cobrado peso.',
    sigil: '··',
    color: '#9CA3AF',
    family: 'presence',
  },
  {
    key: 'presence_persistent',
    label: 'PRESENCIA PERSISTENTE',
    description: 'Tu presencia se mantiene a través del tiempo.',
    sigil: '···',
    color: '#F97316',  // sys-orange
    family: 'presence',
  },
  {
    key: 'presence_insider_track',
    label: 'EN RADAR DE INSIDER',
    description: 'Tu actividad sostenida te ha puesto en el radar editorial.',
    sigil: '◉',
    color: '#F97316',
    family: 'presence',
  },
] as const

export function trophyByKey(key: string): TrophyMeta | undefined {
  return TROPHY_CATALOG.find((t) => t.key === key)
}
