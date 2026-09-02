'use client'

import { useEffect, useState } from 'react'
import { Link2 } from 'lucide-react'
import type { ContentItem } from '@/lib/types'

// Click-to-copy for the deep link of an open overlay item.
// Visual-only feedback — no toast library, just a transient inline state.
//
// Variants (fase C/F) — paper only; the legacy dark branch was deleted in
// fase F together with FranjaOverlay's dark chassis, its sole consumer.
//   paper (default) — desktop header chip: bordered ink chip, copied state
//     flips to an ink-filled «ENLACE COPIADO». Hidden < sm.
//   bar — full-width cell in OverlayShell's mobile bottom bar (≥44px target;
//     the shell owns the cell borders).

const FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

export function ShareButton({
  item,
  variant = 'paper',
}: {
  item: ContentItem
  variant?: 'paper' | 'bar'
}) {
  const [copied, setCopied] = useState(false)

  // Auto-clear the success state.
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1800)
    return () => clearTimeout(t)
  }, [copied])

  const handle = async () => {
    if (typeof window === 'undefined') return
    // Build absolute URL with the slug param. Uses current origin so it
    // round-trips on the user's deployment.
    const url = `${window.location.origin}/?item=${encodeURIComponent(item.slug)}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Fallback — old browsers / non-secure context. Stuff into a temp
      // textarea + execCommand.
      try {
        const ta = document.createElement('textarea')
        ta.value = url
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      } catch {
        return
      }
    }
    setCopied(true)
  }

  const seatClass =
    variant === 'bar'
      ? `flex min-h-[44px] w-full items-center justify-center gap-1.5 px-2 font-mono text-d11 font-bold tracking-widest transition-colors ${
          copied ? 'bg-ink text-paper' : 'text-ink active:bg-ink active:text-paper'
        }`
      : `hidden min-h-11 shrink-0 items-center gap-1.5 border border-ink px-2.5 font-mono text-d11 font-bold tracking-widest transition-colors sm:flex ${
          copied ? 'bg-ink text-paper' : 'text-ink hover:bg-ink hover:text-paper'
        }`

  return (
    <button
      type="button"
      onClick={handle}
      aria-label="Copiar enlace"
      title="Copiar enlace"
      className={`${seatClass} ${FOCUS_RING}`}
    >
      <Link2 size={11} />
      <span>{copied ? 'ENLACE COPIADO' : 'COPIAR ENLACE'}</span>
    </button>
  )
}
