'use client'

import { useEffect, useRef } from 'react'

export interface WaveformProps {
  // When real audio lands, pipe AnalyserNode.getByteFrequencyData(audioData) here.
  // Absent → procedural idle animation.
  audioData?: Uint8Array
  height?: number
  className?: string
}

export function Waveform({ audioData, height = 90, className }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reducedMotionMq = window.matchMedia('(prefers-reduced-motion: reduce)')

    let raf = 0
    let running = true
    const start = performance.now()

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.floor(rect.width * dpr)
      canvas.height = Math.floor(rect.height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const draw = () => {
      if (!running) return
      raf = requestAnimationFrame(draw)

      const rect = canvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      if (w === 0 || h === 0) return

      const t = (performance.now() - start) / 1000
      const reduced = reducedMotionMq.matches
      const bins = 72
      const midY = h / 2

      ctx.clearRect(0, 0, w, h)

      ctx.beginPath()
      for (let i = 0; i <= bins; i++) {
        const x = (i / bins) * w
        let amp: number
        if (audioData && audioData.length > 0) {
          const sample = audioData[Math.floor((i / bins) * audioData.length)] ?? 0
          amp = (sample / 255) * (h * 0.45)
        } else {
          // Idle procedural: two low sines + a touch of pseudo-noise, quieted in reduced-motion
          const speed = reduced ? 0 : 1
          const a = Math.sin(i * 0.28 + t * 1.4 * speed) * 0.55
          const b = Math.sin(i * 0.11 - t * 0.7 * speed) * 0.28
          const n = Math.sin(i * 2.7 + t * 3.1 * speed) * 0.12
          amp = ((a + b + n) * 0.5 + 0.5) * (h * 0.35) + 2
        }
        if (i === 0) ctx.moveTo(x, midY - amp)
        else ctx.lineTo(x, midY - amp)
      }
      ctx.strokeStyle = 'rgba(255, 102, 0, 0.85)'
      ctx.lineWidth = 1
      ctx.shadowColor = 'rgba(255, 102, 0, 0.6)'
      ctx.shadowBlur = 4
      ctx.stroke()
      ctx.shadowBlur = 0

      // Mirrored lower trace, dimmer
      ctx.beginPath()
      for (let i = 0; i <= bins; i++) {
        const x = (i / bins) * w
        let amp: number
        if (audioData && audioData.length > 0) {
          const sample = audioData[Math.floor((i / bins) * audioData.length)] ?? 0
          amp = (sample / 255) * (h * 0.3)
        } else {
          const speed = reduced ? 0 : 1
          const a = Math.sin(i * 0.22 - t * 0.9 * speed + 1.7) * 0.45
          const b = Math.sin(i * 0.07 + t * 0.4 * speed) * 0.2
          amp = ((a + b) * 0.5 + 0.5) * (h * 0.22) + 1
        }
        if (i === 0) ctx.moveTo(x, midY + amp)
        else ctx.lineTo(x, midY + amp)
      }
      ctx.strokeStyle = 'rgba(255, 153, 0, 0.4)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Zero axis — faint guide
      ctx.fillStyle = 'rgba(255, 102, 0, 0.12)'
      ctx.fillRect(0, midY, w, 1)
    }
    raf = requestAnimationFrame(draw)

    const onVisibility = () => {
      if (document.hidden) {
        running = false
        cancelAnimationFrame(raf)
      } else if (!running) {
        running = true
        raf = requestAnimationFrame(draw)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [audioData])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{ width: '100%', height: `${height}px`, display: 'block' }}
    />
  )
}
