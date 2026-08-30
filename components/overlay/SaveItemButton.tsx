'use client'

import type { ContentItem } from '@/lib/types'
import { useIsItemSaved, toggleSavedItem } from '@/lib/saves'
import { useAuth } from '@/components/auth/useAuth'

// ── SaveItemButton ─────────────────────────────────────────────────────────
//
// «☆ GUARDAR / ★ GUARDADO» chip — paper grammar (fase C). Login-gated via
// openLogin(); click toggles through lib/saves (optimistic local write with
// rollback + recordHpEvent('save') on success — that logic lives in
// lib/saves, untouched; this file is presentation only).
//
// Two seats:
//   header (default) — the OverlayShell desktop header chip. Hidden < sm;
//     phones reach save via the bar seat instead.
//   bar — full-width cell in OverlayShell's mobile bottom bar (≥44px target;
//     the shell owns the cell borders).
//
// Saved state pairs the ★ glyph with the acid dot-badge (≥8px, 1px ink
// outline — the whitelisted acid use on paper) so the state flip is never
// hue-only.

const FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

export function SaveItemButton({
  item,
  seat = 'header',
}: {
  item: ContentItem
  seat?: 'header' | 'bar'
}) {
  const { currentUser, openLogin } = useAuth()
  const saved = useIsItemSaved(item.id)

  const onClick = () => {
    if (!currentUser) {
      openLogin()
      return
    }
    toggleSavedItem(item.id)
  }

  const seatClass =
    seat === 'bar'
      ? 'flex min-h-[44px] w-full items-center justify-center gap-1.5 px-2 font-mono text-d11 font-bold tracking-widest text-ink transition-colors active:bg-ink active:text-paper'
      : 'hidden min-h-11 shrink-0 items-center gap-1.5 border border-ink px-2.5 font-mono text-d11 font-bold tracking-widest text-ink transition-colors hover:bg-ink hover:text-paper sm:flex'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? 'Quitar de guardados' : 'Guardar publicación'}
      title={saved ? 'GUARDADO' : 'GUARDAR'}
      className={`${seatClass} ${FOCUS_RING}`}
    >
      {saved && (
        // Acid dot-badge: ≥8px + 1px ink outline — the whitelisted acid use.
        // Legal on the inverted (ink-filled) hover/active grounds too.
        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full border border-ink bg-acid" />
      )}
      <span aria-hidden>{saved ? '★' : '☆'}</span>
      <span>{saved ? 'GUARDADO' : 'GUARDAR'}</span>
    </button>
  )
}
