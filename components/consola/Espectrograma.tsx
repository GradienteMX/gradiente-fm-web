'use client'

/**
 * ESPECTROGRAMA — the spectrum as grooves, printed.
 *
 * Around the record (the hub, DOM) sixteen concentric lines are the last
 * sixteen moments of sound: the newest hugs the label in the energy's color,
 * older ones travel outward and decay into dots, like a halftone. Each line
 * is bent by the real spectrum of its moment — bass at the bottom, air at the
 * top, mirrored left/right — so the figure is data, not decoration.
 *
 *   espectro  lines bend with the 64 log bins; a kick sends a dotted ring out
 *   bpm       no spectrum exists → perfect circles; only the newest breathes
 *             with the tempo (the UI says "pulso por BPM")
 *   pausa     still circles, sparser dots — a record at rest
 *
 * Canvas 2D on the sheet itself (it doesn't depend on the stage or on any
 * background). Zero idle cost: it draws while the signal moves and once on
 * every change otherwise. Colors are read from the tokens (--e, --ink-3).
 */

import { useEffect, useRef } from 'react'
import { usePlayer } from '@/lib/store/player'
import { senal, HIST_ROWS } from '@/lib/audio/senal'
import { SPEC_BINS } from '@/lib/audio/captura'
import styles from './Sala.module.css'

/** The hub (record) diameter as a share of the figure — shared with CSS. */
export const HUB = 0.36
const POINTS = 128

export function Espectrograma() {
  const host = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = host.current
    const cv = canvas.current
    const ctx = cv?.getContext('2d')
    if (!el || !cv || !ctx) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let w = 0
    let h = 0
    let dpr = 1
    let raf = 0
    let running = false
    let frames = 0
    let ink = { e: '', faint: '' }

    const readInk = () => {
      const cs = getComputedStyle(el)
      ink = { e: cs.getPropertyValue('--e').trim() || cs.color, faint: cs.getPropertyValue('--ink-3').trim() || cs.color }
    }

    const draw = () => {
      if (!w || !h) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const cx = w / 2
      const cy = h / 2
      const R = Math.min(w, h) / 2
      const r0 = (Math.min(w, h) * HUB) / 2 + 14
      const span = Math.max(40, R - r0 - 18)
      const live = reduced ? 0 : senal.live
      const pulse = reduced ? 0 : senal.pulse
      const play = senal.play
      ctx.lineCap = 'round'

      for (let k = HIST_ROWS - 1; k >= 0; k--) {
        const age = k / (HIST_ROWS - 1)
        const base = r0 + Math.pow(age, 0.92) * span
        const amp = (34 - 20 * age) * (0.55 + 0.45 * play)
        const breathe = k === 0 ? pulse * 5 : 0
        ctx.beginPath()
        for (let i = 0; i <= POINTS; i++) {
          // a = 0 at the bottom (bass), ±π at the top (air), mirrored.
          const a = (i / POINTS) * Math.PI * 2 - Math.PI
          const bin = Math.min(SPEC_BINS - 1, Math.round((Math.abs(a) / Math.PI) * (SPEC_BINS - 1)))
          let m = live > 0 ? Math.min(1, senal.hist[k * SPEC_BINS + bin]) * live : 0
          m = m * m * (3 - 2 * m)
          const r = base + m * amp + breathe
          const x = cx + Math.sin(a) * r
          const y = cy + Math.cos(a) * r
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        if (k === 0) {
          ctx.setLineDash([])
          ctx.lineWidth = 1.5
        } else {
          // Halftone decay: the older (and the quieter), the sparser the dots.
          ctx.setLineDash([0.01, 2 + age * (8 - 3 * play)])
          ctx.lineWidth = 1.4
        }
        ctx.strokeStyle = k < 4 ? ink.e : ink.faint
        ctx.stroke()
      }

      // The beat leaves the label as a dotted ring.
      if (pulse * play > 0.06) {
        ctx.beginPath()
        ctx.arc(cx, cy, r0 + (1 - pulse) * span * 0.55, 0, Math.PI * 2)
        ctx.setLineDash([0.01, 3])
        ctx.lineWidth = 1.4
        ctx.strokeStyle = ink.e
        ctx.globalAlpha = Math.min(1, pulse * 1.3)
        ctx.stroke()
        ctx.globalAlpha = 1
      }
    }

    const moving = () => {
      if (reduced) return false
      const P = usePlayer.getState()
      return P.playing || P.capture === 'live' || senal.play > 0.01 || senal.live > 0.01 || senal.pulse > 0.01
    }
    const loop = () => {
      if (++frames % 90 === 0) readInk()
      draw()
      if (moving()) raf = requestAnimationFrame(loop)
      else running = false
    }
    const wake = () => {
      if (running) return
      running = true
      raf = requestAnimationFrame(loop)
    }
    const resize = () => {
      const r = el.getBoundingClientRect()
      dpr = Math.min(2, window.devicePixelRatio || 1)
      w = r.width
      h = r.height
      cv.width = Math.max(1, Math.round(w * dpr))
      cv.height = Math.max(1, Math.round(h * dpr))
      readInk()
      draw()
    }

    resize()
    wake()
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    const unsub = usePlayer.subscribe((s, p) => {
      if (s.playing !== p.playing || s.capture !== p.capture || s.track !== p.track || s.loading !== p.loading) {
        readInk()
        wake()
      }
    })
    return () => {
      ro.disconnect()
      unsub()
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div ref={host} className={styles.anillo} aria-hidden="true">
      <canvas ref={canvas} className={styles.lienzo} />
    </div>
  )
}
