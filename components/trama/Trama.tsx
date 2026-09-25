'use client'

import { useEffect, useRef } from 'react'
import { getTrama } from './engine'
import styles from './Trama.module.css'

/**
 * Mounts the TRAMA canvas above the DOM. When the engine can't run (no
 * WebGL, reduced motion) <html> gets `trama-off` and nothing is ever hidden
 * waiting for a gesture.
 */
export function Trama() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const engine = getTrama()
    engine.mount(canvas)
    // Development only: lets headless checks inspect the engine.
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __trama?: typeof engine }).__trama = engine
    const root = document.documentElement
    const sync = () => root.classList.toggle('trama-off', !engine.available)
    sync()
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    mq.addEventListener('change', sync)
    canvas.addEventListener('webglcontextlost', sync)
    return () => {
      mq.removeEventListener('change', sync)
      canvas.removeEventListener('webglcontextlost', sync)
      engine.unmount()
    }
  }, [])

  return (
    <>
      <canvas ref={ref} className={styles.canvas} aria-hidden="true" />
      <noscript>
        <style>{'[data-trama],[data-trama-img]{visibility:visible!important;opacity:1!important}'}</style>
      </noscript>
    </>
  )
}
