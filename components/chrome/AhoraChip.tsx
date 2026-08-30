'use client'

import { useAudioPlayer } from '@/components/audio/AudioPlayerProvider'
import { useOverlay } from '@/components/overlay/useOverlay'

// ── AhoraChip — the masthead's now-playing readout ──────────────────────────
//
// A self-contained subscriber leaf: it is the ONLY chrome component that
// reads useAudioPlayer(), so transport ticks re-render this chip alone and
// never the whole Navigation strip. Renders null while nothing is loaded —
// no fake status copy, the chip exists only when there is a real signal.
//
// Lives on the ink masthead (panel ground), so the acid dot is a sanctioned
// use: solid while playing, outline-only while paused. Click reopens the
// loaded piece's overlay (contained-surface rule — overlay, not a route).

const FOCUS_ON_PANEL =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-text'

export function AhoraChip() {
  const { currentItem, isPlaying } = useAudioPlayer()
  const { open } = useOverlay()

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
      className={`flex min-h-11 items-center gap-2 border border-panel-text/60 px-3 text-panel-text hover:bg-panel-text hover:text-panel ${FOCUS_ON_PANEL}`}
    >
      {/* 8px state dot — acid on panel (legal). Solid = playing, outline = paused. */}
      <span
        aria-hidden
        className={`h-2 w-2 shrink-0 ${isPlaying ? 'bg-acid' : 'border border-acid'}`}
      />
      <span className="max-w-[22ch] truncate font-mono text-d11 uppercase tracking-widest">
        AHORA · {currentItem.title}
      </span>
    </button>
  )
}
