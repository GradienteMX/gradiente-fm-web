'use client'

import { useEffect, useState, type MouseEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/useAuth'
import { canAssignRoles } from '@/lib/permissions'
import type { ContentItem } from '@/lib/types'

// ── PortadaToggle — admin one-click portada lever ───────────────────────────
//
// Renders nothing unless the viewer is an admin. Three seats, one gesture:
//   · chip    — inside a card's chip row on the feed («⌖ PORTADA»)
//   · hero    — the carousel kicker («QUITAR DE PORTADA» only; never «subir»)
//   · overlay — the overlay header, beside ELIMINAR
// Click never bubbles (cards and the hero open the overlay on click). On
// success the router refreshes so the server re-ranks: the piece moves from
// the mosaic into the carousel (or back) without a manual reload.

const FOCUS =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

export function PortadaToggle({
  item,
  variant,
}: {
  item: ContentItem
  variant: 'chip' | 'hero' | 'overlay'
}) {
  const { currentUser } = useAuth()
  const router = useRouter()
  const [pinned, setPinned] = useState(!!item.pinned)
  const [busy, setBusy] = useState(false)
  useEffect(() => setPinned(!!item.pinned), [item.id, item.pinned])

  if (!canAssignRoles(currentUser) || item._draftState || item.type === 'franja') return null
  // On the hero the piece is already in portada (or is the unpinned fallback
  // standing in) — the only sensible key is removal, never «subir».
  if (variant === 'hero' && !pinned) return null

  const toggle = async (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (busy) return
    const next = !pinned
    setBusy(true)
    setPinned(next)
    try {
      const res = await fetch(`/api/admin/items/${encodeURIComponent(item.id)}/portada`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pinned: next }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      router.refresh()
    } catch (err) {
      console.error('[portada] toggle failed', err)
      setPinned(!next)
    } finally {
      setBusy(false)
    }
  }

  const title = pinned ? 'Quitar de portada (admin)' : 'Subir a portada (admin)'

  if (variant === 'chip') {
    return (
      <button
        type="button"
        onClick={toggle}
        onKeyDown={(e) => e.stopPropagation()}
        aria-pressed={pinned}
        aria-label={title}
        title={title}
        disabled={busy}
        className={`inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none tracking-widest transition-colors disabled:opacity-60 ${
          pinned
            ? 'border-sys-red-paper bg-sys-red-paper text-paper-raised hover:bg-paper-raised hover:text-sys-red-paper'
            : 'border-ink-faint bg-paper-raised text-ink-faint hover:border-sys-red-paper hover:text-sys-red-paper'
        } ${FOCUS}`}
      >
        ⌖ {busy ? '…' : 'PORTADA'}
      </button>
    )
  }

  const label = busy ? '…' : pinned ? 'QUITAR DE PORTADA' : 'SUBIR A PORTADA'
  return (
    <button
      type="button"
      onClick={toggle}
      onKeyDown={(e) => e.stopPropagation()}
      aria-pressed={pinned}
      title={title}
      disabled={busy}
      className={`${variant === 'overlay' ? 'hidden sm:flex' : 'flex'} min-h-${variant === 'hero' ? '8' : '11'} items-center gap-1.5 border px-2.5 font-mono text-d11 font-bold tracking-widest transition-colors disabled:opacity-60 ${
        pinned
          ? 'border-sys-red-paper text-sys-red-paper hover:bg-sys-red-paper hover:text-paper-raised'
          : 'border-ink text-ink hover:bg-ink hover:text-paper'
      } ${FOCUS}`}
    >
      ⌖ {label}
    </button>
  )
}
