'use client'

import { useIsItemSaved } from '@/lib/saves'

// ── SavedBadge ─────────────────────────────────────────────────────────────
//
// Small star chip on the card's art plate when the user has bookmarked the
// item. Renders nothing when the item isn't saved, so it adds zero chrome to
// the unsaved feed. Pairs with the GUARDAR action in the overlay header
// (SaveItemButton).
//
// Paper grammar (fase B): ink-bordered ★ on paper-raised plus an acid
// dot-badge — solid dot ≥8px with a 1px ink outline, the whitelisted
// `dot-badge` acid use (ACID_LEGAL_USES in lib/dashboard/palette.ts). Acid
// never renders as text or border; the ★ stays ink.

export function SavedBadge({ itemId }: { itemId: string }) {
  const saved = useIsItemSaved(itemId)
  if (!saved) return null
  return (
    <span
      aria-label="Guardado"
      title="Guardado"
      className="pointer-events-none inline-flex items-center gap-1 border border-ink bg-paper-raised px-1.5 py-1 font-mono text-[10px] leading-none tracking-widest text-ink"
    >
      ★
      <span
        aria-hidden
        className="h-2 w-2 rounded-full border border-ink bg-acid"
      />
    </span>
  )
}
