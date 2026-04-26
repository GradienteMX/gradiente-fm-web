'use client'

import type { ContentItem } from '@/lib/types'
import { useIsItemSaved, toggleSavedItem } from '@/lib/saves'
import { useAuth } from '@/components/auth/useAuth'

// ── SaveItemButton ─────────────────────────────────────────────────────────
//
// `★ GUARDAR / ★ GUARDADO` chip in the overlay header. Mirrors the pattern
// used by the comment-level GUARDAR button in CommentList: login-gated,
// orange-when-active, click toggles. Lives next to ShareButton.

export function SaveItemButton({ item }: { item: ContentItem }) {
  const { currentUser, openLogin } = useAuth()
  const saved = useIsItemSaved(item.id)

  const onClick = () => {
    if (!currentUser) {
      openLogin()
      return
    }
    toggleSavedItem(item.id)
  }

  const color = saved ? '#F97316' : '#888888'
  const border = saved ? '#F97316' : '#242424'
  const bg = saved ? 'rgba(249,115,22,0.08)' : 'rgba(0,0,0,0.4)'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? 'Quitar de guardados' : 'Guardar publicación'}
      title={saved ? 'GUARDADO' : 'GUARDAR'}
      className="hidden items-center gap-1.5 border px-2.5 py-1.5 font-mono text-[10px] tracking-widest transition-colors hover:border-white/60 hover:text-primary sm:flex"
      style={{ color, borderColor: border, backgroundColor: bg }}
    >
      <span aria-hidden>{saved ? '★' : '☆'}</span>
      <span>{saved ? 'GUARDADO' : 'GUARDAR'}</span>
    </button>
  )
}
