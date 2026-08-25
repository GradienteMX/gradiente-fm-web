// HL bracket — the ONE shared copy for the dashboard rebuild.
//
// The same logic currently lives twice in legacy code (ContentCard.tsx
// HL_TIERS and HarvestConfirmModal.tsx hlBracket, boundaries 5/15/30/60);
// this module matches those copies exactly so no third drift-prone variant
// appears. Boundaries are "loose, to be tuned" per the legacy comment —
// tune here AND in both legacy copies in lockstep until they migrate.
//
// Brackets are the only HL representation ever visible on shared screens:
// words, never the raw scalar (the identity spine's PRIVADO block is the
// sole numeric exception).

export const HL_BRACKET_LABELS = [
  'DÉBIL',
  'MODESTO',
  'NOTABLE',
  'FUERTE',
  'PLENO',
] as const
export type HlBracketLabel = (typeof HL_BRACKET_LABELS)[number]

// Exclusive upper bounds of the first four brackets; PLENO is open-ended.
export const HL_BRACKET_BOUNDS = [5, 15, 30, 60] as const

export function hlBracket(hp: number): HlBracketLabel {
  if (hp < 5) return 'DÉBIL'
  if (hp < 15) return 'MODESTO'
  if (hp < 30) return 'NOTABLE'
  if (hp < 60) return 'FUERTE'
  return 'PLENO'
}
