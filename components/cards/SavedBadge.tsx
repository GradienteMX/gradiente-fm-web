'use client'

import { useIsItemSaved } from '@/lib/saves'

// ── SavedBadge ─────────────────────────────────────────────────────────────
//
// Small star chip that appears in a card's top-right corner when the user
// has bookmarked the item. Renders nothing when the item isn't saved, so
// it adds zero chrome to the unsaved feed. Pairs with the GUARDAR action
// in the overlay header (SaveItemButton).
//
// Color: orange — matches the rest of the user-engagement palette
// (GUARDAR / GUARDADO / pending / TÚ chip). Distinct from the red
// editorial mark which uses `bg-sys-red/90`.

export function SavedBadge({ itemId }: { itemId: string }) {
  const saved = useIsItemSaved(itemId)
  if (!saved) return null
  return (
    <span
      aria-label="Guardado"
      title="Guardado"
      className="pointer-events-none inline-flex items-center justify-center border bg-black/85 px-1.5 py-1 font-mono text-[10px] leading-none tracking-widest backdrop-blur-sm"
      style={{
        borderColor: '#F97316',
        color: '#F97316',
        backgroundColor: 'rgba(249,115,22,0.12)',
      }}
    >
      ★
    </span>
  )
}
