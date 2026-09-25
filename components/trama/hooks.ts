'use client'

import { useEffect, useRef, type RefObject } from 'react'
import { revelar, revelarImagen, type ImagenOpts, type RevelarOpts } from './api'

export type Trigger = 'load' | 'inview' | 'manual'

interface Common {
  trigger?: Trigger
  /** Replays the gesture whenever this value changes (e.g. the text). */
  replay?: unknown
}

function whenVisible(el: Element, go: () => void): () => void {
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect()
        go()
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
  )
  io.observe(el)
  return () => io.disconnect()
}

/**
 * Reveal the text of `ref` when it loads or enters the viewport. Render the
 * element with `data-trama="pendiente"` so it's hidden from the first paint.
 */
export function useRevelar(ref: RefObject<HTMLElement | null>, opts: RevelarOpts & Common = {}) {
  const latest = useRef(opts)
  latest.current = opts
  const trigger = opts.trigger ?? 'inview'
  useEffect(() => {
    const el = ref.current
    if (!el || trigger === 'manual') return
    let cancelled = false
    el.setAttribute('data-trama', 'pendiente')
    const go = () => {
      const fonts = typeof document !== 'undefined' && document.fonts ? document.fonts.ready : Promise.resolve()
      fonts.then(() => {
        // One frame so the engine (mounted in the same commit) and layout are ready.
        requestAnimationFrame(() => {
          if (!cancelled) void revelar(el, latest.current)
        })
      })
    }
    const off = trigger === 'load' ? (go(), () => {}) : whenVisible(el, go)
    return () => {
      cancelled = true
      off()
      if (el.getAttribute('data-trama') === 'pendiente') el.setAttribute('data-trama', 'listo')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, opts.replay])
}

/**
 * Print an <img> out of its blocks once it has loaded and is on screen.
 * Render the img with `data-trama-img="pendiente"`.
 */
export function useRevelarImagen(ref: RefObject<HTMLImageElement | null>, opts: ImagenOpts & Common = {}) {
  const latest = useRef(opts)
  latest.current = opts
  const trigger = opts.trigger ?? 'inview'
  useEffect(() => {
    const img = ref.current
    if (!img || trigger === 'manual') return
    let cancelled = false
    img.setAttribute('data-trama-img', 'pendiente')
    const run = () => {
      requestAnimationFrame(() => {
        if (!cancelled) void revelarImagen(img, latest.current)
      })
    }
    const whenLoaded = () => {
      if (img.complete && img.naturalWidth) run()
      else {
        const onLoad = () => run()
        const onError = () => img.setAttribute('data-trama-img', 'listo')
        img.addEventListener('load', onLoad, { once: true })
        img.addEventListener('error', onError, { once: true })
      }
    }
    const off = trigger === 'load' ? (whenLoaded(), () => {}) : whenVisible(img, whenLoaded)
    // Never leave an image hidden: if nothing printed within 2.5 s, show it.
    const safety = window.setTimeout(() => {
      if (img.getAttribute('data-trama-img') === 'pendiente' && isOnScreen(img)) img.setAttribute('data-trama-img', 'listo')
    }, 2500)
    return () => {
      cancelled = true
      off()
      window.clearTimeout(safety)
      if (img.getAttribute('data-trama-img') === 'pendiente') img.setAttribute('data-trama-img', 'listo')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, opts.replay])
}

function isOnScreen(el: Element): boolean {
  const r = el.getBoundingClientRect()
  return r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth
}
