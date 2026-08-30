'use client'

import { usePathname } from 'next/navigation'
import { useAudioPlayer } from '@/components/audio/AudioPlayerProvider'
import { useOverlay } from '@/components/overlay/useOverlay'
import { isPaperRoute } from '@/lib/chrome/paperRoutes'

// ── AhoraChip — the masthead's now-playing readout ──────────────────────────
//
// A self-contained subscriber leaf: it is the ONLY chrome component that
// reads useAudioPlayer(), so transport ticks re-render this chip alone and
// never the whole Navigation strip. Renders null while nothing is loaded —
// no fake status copy, the chip exists only when there is a real signal.
//
// Dual-stamped like the masthead (via isPaperRoute — no prop drilling). The
// acid state dot is legal on BOTH grounds: bare on the ink strip (acid on
// panel), 1px-ink-outlined ≥8px dot-badge on paper. Solid = playing; hollow
// = paused (acid outline on ink, ink outline on paper — acid without its ink
// outline is not legible on paper). Click reopens the loaded piece's overlay
// (contained-surface rule — overlay, not a route).

const FOCUS_ON_PANEL =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-text'
const FOCUS_ON_PAPER =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

export function AhoraChip() {
  const { currentItem, isPlaying } = useAudioPlayer()
  const { open } = useOverlay()
  const paper = isPaperRoute(usePathname())

  if (!currentItem) return null

  const openItem = () => {
    // cue()'d items always carry a slug today, but the guard keeps a bad
    // payload from opening an empty overlay.
    if (!currentItem.slug) return
    open(currentItem.slug)
  }

  return (
    <button
      type="button"
      onClick={openItem}
      aria-label={`Ahora: ${currentItem.title}. Abrir pieza`}
      className={`flex min-h-11 items-center gap-2 border px-3 ${
        paper
          ? `border-ink text-ink hover:bg-ink hover:text-paper ${FOCUS_ON_PAPER}`
          : `border-panel-text/60 text-panel-text hover:bg-panel-text hover:text-panel ${FOCUS_ON_PANEL}`
      }`}
    >
      {/* 8px state dot — solid = playing, hollow = paused. On paper the acid
          fill carries its mandatory 1px ink outline (dot-badge law). */}
      <span
        aria-hidden
        className={`h-2 w-2 shrink-0 ${
          paper
            ? isPlaying
              ? 'border border-ink bg-acid'
              : 'border border-ink'
            : isPlaying
              ? 'bg-acid'
              : 'border border-acid'
        }`}
      />
      <span className="max-w-[22ch] truncate font-mono text-d11 uppercase tracking-widest">
        AHORA · {currentItem.title}
      </span>
    </button>
  )
}
