'use client'

// ── MiniTransport — the pinned transport strip (FINAL_SPEC §3.4) ────────────
//
// When audio is playing AND the REPRODUCTOR widget is offscreen
// (IntersectionObserver on the widget's root, registered through the anchor
// store below), a 40px ink strip pins to the viewport bottom: marquee title,
// play/pause, next, «IR AL PANEL» scroll-to. It unmounts the moment the
// widget re-enters view or playback stops. Mount + unmount are hard cuts —
// no exit animation (motion constitution §6).
//
// Both this strip and the widget's TransportCore are VIEWS over the ONE
// AudioPlayerProvider — no playback state is duplicated here. z-[45], NOT
// z-50: OverlayShell's root is z-50 and must win (WP1 integration note).

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Pause, Play, SkipForward } from 'lucide-react'
import { useAudioPlayer } from '@/components/audio/AudioPlayerProvider'
import { MarqueeText } from '@/components/audio/NowPlayingHud'

// Focus ring for controls ON THE INK STRIP — WidgetFrame's FOCUS_RING outlines
// in ink, invisible on the panel ground; this is the panel-text counterpart.
const PANEL_FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-text'

// ── Anchor store ────────────────────────────────────────────────────────────
// ReproductorWidget registers its root element here on mount (null on
// unmount). Module-level so the two surfaces coordinate without threading
// refs through the grid; subscription-backed so remounts (layout edits,
// OCULTOS restore) re-arm the IntersectionObserver.

let anchorEl: HTMLElement | null = null
const anchorListeners = new Set<() => void>()

export function setReproductorAnchor(el: HTMLElement | null): void {
  if (anchorEl === el) return
  anchorEl = el
  anchorListeners.forEach((fn) => fn())
}

function subscribeAnchor(fn: () => void): () => void {
  anchorListeners.add(fn)
  return () => {
    anchorListeners.delete(fn)
  }
}

function getAnchor(): HTMLElement | null {
  return anchorEl
}

// ── The strip ───────────────────────────────────────────────────────────────

export function MiniTransport() {
  const audio = useAudioPlayer()
  const anchor = useSyncExternalStore(subscribeAnchor, getAnchor, () => null)

  // Widget visibility. Starts true so the strip never flashes in before the
  // observer's first callback settles; a missing anchor (widget hidden via
  // the OCULTOS tray) counts as offscreen so playback stays controllable.
  const [widgetVisible, setWidgetVisible] = useState(true)
  useEffect(() => {
    if (!anchor) {
      setWidgetVisible(false)
      return
    }
    setWidgetVisible(true)
    const observer = new IntersectionObserver(
      (observed) => {
        const entry = observed[0]
        if (entry) setWidgetVisible(entry.isIntersecting)
      },
      { threshold: 0 },
    )
    observer.observe(anchor)
    return () => observer.disconnect()
  }, [anchor])

  const item = audio.currentItem
  // Pin ONLY while audio plays and the widget is offscreen (§3.4). Pausing
  // from the strip therefore unmounts it — spec-literal: «unmounts when the
  // widget re-enters view or playback stops».
  if (!audio.isPlaying || widgetVisible || !item) return null

  const scrollToPanel = () => {
    const target = getAnchor()
    if (!target) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
  }

  return (
    <div
      role="region"
      aria-label="Transporte de reproducción"
      className="fixed inset-x-0 bottom-0 z-[45] flex h-10 items-center gap-3 border-t border-ink bg-panel px-4 text-panel-text"
    >
      {/* Playing marker — acid on panel (sanctioned use). */}
      <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-acid" />

      <div className="min-w-0 flex-1">
        <MarqueeText
          text={[item.title, item.author].filter(Boolean).join(' — ')}
          className="font-mono text-d13 text-panel-text"
        />
      </div>

      <button
        type="button"
        onClick={() => audio.toggle()}
        aria-label={audio.isPlaying ? 'Pausar' : 'Reproducir'}
        data-cue="tick"
        className={`flex h-10 w-10 shrink-0 items-center justify-center text-panel-text ${PANEL_FOCUS_RING}`}
      >
        {audio.isPlaying ? (
          <Pause size={14} fill="currentColor" />
        ) : (
          <Play size={14} fill="currentColor" />
        )}
      </button>

      <button
        type="button"
        onClick={() => audio.next()}
        disabled={!audio.hasNext}
        aria-label={audio.hasNext ? 'Siguiente pista' : 'Siguiente pista — fin de la cola'}
        title={audio.hasNext ? 'SIGUIENTE' : 'FIN DE LA COLA'}
        data-cue="tick"
        className={`flex h-10 w-10 shrink-0 items-center justify-center text-panel-text disabled:cursor-not-allowed disabled:opacity-30 ${PANEL_FOCUS_RING}`}
      >
        <SkipForward size={14} />
      </button>

      {anchor && (
        <button
          type="button"
          onClick={scrollToPanel}
          data-cue="tick"
          className={`shrink-0 whitespace-nowrap font-mono text-d13 uppercase tracking-widest text-panel-text underline-offset-4 hover:underline ${PANEL_FOCUS_RING}`}
        >
          IR AL PANEL
        </button>
      )}
    </div>
  )
}
