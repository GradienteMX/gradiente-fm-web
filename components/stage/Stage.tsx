'use client'

import { useEffect, useRef } from 'react'
import { getStage } from './engine'
import { useCampo } from '@/lib/store/campo'
import { energyHex } from '@/lib/vibe'
import styles from './Stage.module.css'

/**
 * Mounts the single WebGL canvas behind the DOM and keeps it in sync with
 * the Horizonte. Also publishes the field's energy as CSS custom properties
 * so plain CSS can take the temperature too (selection color, tempo).
 */
export function Stage() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const stage = getStage()
    stage.mount(canvas)
    // Development only: lets headless checks inspect the engine.
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __stage?: typeof stage }).__stage = stage
    return () => stage.unmount()
  }, [])

  useEffect(() => {
    const apply = (range: [number, number]) => {
      getStage().setBand(range[0], range[1])
      const mid = (range[0] + range[1]) / 2
      const root = document.documentElement
      root.style.setProperty('--field-e', mid.toFixed(2))
      root.style.setProperty('--field-color', energyHex(mid))
      root.style.setProperty('--field-lo', energyHex(range[0]))
      root.style.setProperty('--field-hi', energyHex(range[1]))
    }
    apply(useCampo.getState().range)
    return useCampo.subscribe((s, prev) => {
      if (s.range !== prev.range) apply(s.range)
    })
  }, [])

  return <canvas ref={ref} className={styles.canvas} aria-hidden="true" />
}
