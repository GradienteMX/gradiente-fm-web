'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePlayer, type Track } from '@/lib/store/player'
import { useItems, useNow } from '@/lib/store/world'
import { currentHp } from '@/lib/curation'
import { mixTrack, preferredSource, tempoOf } from '@/lib/audio/sources'
import { restSenal, senal, stepSenal } from '@/lib/audio/senal'
import { onCaptureEnded } from '@/lib/audio/captura'
import { setFieldAudio } from '@/components/stage/api'

/** Queue cap — the twelve most alive playable mixes. Metadata only. */
const QUEUE_CAP = 12
/** A source that hasn't answered in this long is said to be silent. */
const WATCHDOG_MS = 20_000

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduced(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

/**
 * The field's queue: every playable mix in the world, ordered by current HL,
 * capped. Global like the mosaic — nobody gets a personal order.
 */
export function useCola() {
  const items = useItems()
  const now = useNow()
  const ambient = useMemo(() => {
    const out: Array<{ t: Track; hl: number }> = []
    for (const i of items) {
      if (i.type !== 'mix' || !preferredSource(i)) continue
      const t = mixTrack(i)
      if (t) out.push({ t, hl: currentHp(i, now) })
    }
    return out
      .sort((a, b) => b.hl - a.hl)
      .slice(0, QUEUE_CAP)
      .map((x) => x.t)
  }, [items, now])
  useEffect(() => {
    usePlayer.getState().setAmbient(ambient)
  }, [ambient])
}

/** The tempo the current audio honestly carries (catalog BPM), or null. */
export function useTempo(track: Track | null): number | null {
  const items = useItems()
  return useMemo(() => {
    if (!track) return null
    return tempoOf(items.find((i) => i.id === track.itemId), track.entry)
  }, [items, track])
}

/**
 * The listening loop: while something plays (or capture is live, or the
 * pulse is still settling) it advances the shared signal and feeds the
 * field. Stops itself when everything is at rest.
 */
export function useSenalLoop(bpm: number | null, reduced: boolean) {
  const bpmRef = useRef(bpm)
  bpmRef.current = bpm
  const reducedRef = useRef(reduced)
  reducedRef.current = reduced

  useEffect(() => {
    let raf = 0
    let running = false
    let last = 0
    const frame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
      last = now
      const s = usePlayer.getState()
      const playing = s.playing && !s.loading
      const moving = stepSenal(dt, { playing, bpm: bpmRef.current, reduced: reducedRef.current })
      // Reduced motion: the field stays still — no pulse, no audio drive.
      if (reducedRef.current) setFieldAudio(0, 0, 0, 0)
      else setFieldAudio(senal.field.low, senal.field.mid, senal.field.high, senal.field.level)
      if (moving) raf = requestAnimationFrame(frame)
      else {
        running = false
        setFieldAudio(0, 0, 0, 0)
      }
    }
    const wake = () => {
      if (running) return
      running = true
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }
    wake()
    const unsub = usePlayer.subscribe((s, p) => {
      if (s.playing !== p.playing || s.loading !== p.loading || s.capture !== p.capture) wake()
    })
    onCaptureEnded(() => {
      const P = usePlayer.getState()
      P.setCapture('idle')
      P.setCaptureNote('Dejaste de compartir la pestaña.')
    })
    return () => {
      unsub()
      onCaptureEnded(null)
      cancelAnimationFrame(raf)
      running = false
      restSenal()
      setFieldAudio(0, 0, 0, 0)
    }
  }, [])
}

/** A load that never answers becomes an honest fault instead of an eternal CARGANDO. */
export function useVigia() {
  useEffect(() => {
    let timer = 0
    const arm = () => {
      window.clearTimeout(timer)
      const s = usePlayer.getState()
      if (!s.loading || !s.track) return
      const track = s.track
      timer = window.setTimeout(() => {
        const n = usePlayer.getState()
        if (n.loading && n.track === track) n.report({ fault: n.transports[track.source.platform] ? 'SIN RESPUESTA' : 'SIN CONEXIÓN', loading: false, playing: false })
      }, WATCHDOG_MS)
    }
    const unsub = usePlayer.subscribe((s, p) => {
      if (s.loading !== p.loading || s.track !== p.track) arm()
    })
    return () => {
      unsub()
      window.clearTimeout(timer)
    }
  }, [])
}

/**
 * Calls `cb(time, duration)` every frame while playing (gliding between the
 * bridge's reports) and once on every change otherwise. No React renders.
 */
export function usePosicion(cb: (t: number, d: number) => void) {
  const ref = useRef(cb)
  ref.current = cb
  useEffect(() => {
    let raf = 0
    const read = () => {
      const s = usePlayer.getState()
      let t = s.time
      if (s.playing && !s.loading) t += (performance.now() - s.timeAt) / 1000
      if (s.duration > 0) t = Math.min(t, s.duration)
      ref.current(Math.max(0, t), s.duration)
    }
    const loop = () => {
      read()
      raf = requestAnimationFrame(loop)
    }
    const sync = () => {
      cancelAnimationFrame(raf)
      const s = usePlayer.getState()
      if (s.playing && !s.loading) raf = requestAnimationFrame(loop)
      else read()
    }
    sync()
    const unsub = usePlayer.subscribe((s, p) => {
      if (s.playing !== p.playing || s.loading !== p.loading || s.time !== p.time || s.duration !== p.duration || s.track !== p.track) sync()
    })
    return () => {
      unsub()
      cancelAnimationFrame(raf)
    }
  }, [])
}
