'use client'

/**
 * VISOR — a thread's images, full size. Opens from the image you touched
 * (it grows out of its rect), ←/→ walk the gallery, Esc closes. Keys are
 * caught in the capture phase so the thread underneath never hears them.
 */

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import gsap from 'gsap'
import { Mark } from '@/components/kit/Glyph'
import styles from './Visor.module.css'

export interface VisorState {
  images: string[]
  index: number
  from: { x: number; y: number; width: number; height: number } | null
}

export function Visor({ state, onIndex, onClose }: { state: VisorState; onIndex: (i: number) => void; onClose: () => void }) {
  const { images, index, from } = state
  const count = images.length
  const imgRef = useRef<HTMLImageElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const returnTo = useRef<Element | null>(null)
  const first = useRef(true)

  const go = useCallback(
    (d: number) => {
      if (count <= 1) return
      onIndex((index + d + count) % count)
    },
    [count, index, onIndex],
  )

  useEffect(() => {
    returnTo.current = document.activeElement
    closeRef.current?.focus({ preventScroll: true })
    return () => {
      ;(returnTo.current as HTMLElement | null)?.focus?.({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowRight') {
        e.stopPropagation()
        e.preventDefault()
        go(1)
      } else if (e.key === 'ArrowLeft') {
        e.stopPropagation()
        e.preventDefault()
        go(-1)
      } else if (e.key === 'Tab') {
        // Keep focus inside the viewer.
        const f = [...(rootRef.current?.querySelectorAll<HTMLElement>('button') ?? [])]
        if (!f.length) return
        const a = f[0]
        const b = f[f.length - 1]
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault()
          b.focus()
        } else if (!e.shiftKey && document.activeElement === b) {
          e.preventDefault()
          a.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [go, onClose])

  // Grow out of the touched image the first time; cross-fade after that.
  useLayoutEffect(() => {
    const img = imgRef.current
    if (!img) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    if (first.current && from) {
      first.current = false
      const vw = window.innerWidth
      const vh = window.innerHeight
      const s = Math.max(0.08, Math.min(1, from.width / Math.max(1, Math.min(vw * 0.86, 1400))))
      gsap.fromTo(
        img,
        { x: from.x + from.width / 2 - vw / 2, y: from.y + from.height / 2 - vh / 2, scale: s, opacity: 0.35 },
        { x: 0, y: 0, scale: 1, opacity: 1, duration: 0.6, ease: 'expo.out', clearProps: 'transform,opacity' },
      )
    } else {
      first.current = false
      gsap.fromTo(img, { opacity: 0, scale: 0.985 }, { opacity: 1, scale: 1, duration: 0.42, ease: 'expo.out', clearProps: 'transform,opacity' })
    }
  }, [index, from])

  const src = images[index]
  if (!src || typeof document === 'undefined') return null

  return createPortal(
    <div ref={rootRef} className={styles.root} role="dialog" aria-modal="true" aria-label={`Imagen ${index + 1} de ${count}`}>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <div className={styles.stage} onClick={onClose}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imgRef} key={src} src={src} alt={`Imagen ${index + 1} de ${count}`} className={styles.img} onClick={(e) => e.stopPropagation()} draggable={false} />
      </div>

      <div className={styles.bar}>
        <span className={styles.count}>
          {count > 1 ? (
            <>
              <b>{index + 1}</b> / {count}
            </>
          ) : (
            'Imagen'
          )}
        </span>
        <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label="Cerrar (Esc)">
          <Mark name="close" size={15} />
          <kbd>Esc</kbd>
        </button>
      </div>

      {count > 1 ? (
        <>
          <button type="button" className={styles.nav} data-dir="prev" onClick={() => go(-1)} aria-label="Anterior (←)">
            <Mark name="arrow" size={18} />
          </button>
          <button type="button" className={styles.nav} data-dir="next" onClick={() => go(1)} aria-label="Siguiente (→)">
            <Mark name="arrow" size={18} />
          </button>
          <div className={styles.strip}>
            {images.map((s, i) => (
              <button key={s + i} type="button" className={styles.thumb} data-on={i === index || undefined} onClick={() => onIndex(i)} aria-label={`Ver imagen ${i + 1}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s} alt="" draggable={false} />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>,
    document.body,
  )
}
