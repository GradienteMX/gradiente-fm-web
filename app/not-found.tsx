'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

// Glyphs we cycle through to corrupt the displayed path. Only ASCII-safe so
// it reads as terminal noise, not random Unicode.
const GLITCH_CHARS = '!<>-_\\/[]{}—=+*^?#________'

function scramble(input: string, intensity: number): string {
  if (intensity <= 0) return input
  return input
    .split('')
    .map((ch) => {
      if (ch === '/' || ch === '?' || ch === '&' || ch === '=') return ch
      if (Math.random() > intensity) return ch
      return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]
    })
    .join('')
}

export default function NotFound() {
  const [path, setPath] = useState<string>('/desconocido')
  const [glitched, setGlitched] = useState<string>('/desconocido')
  const [tick, setTick] = useState(0)

  // Capture the path that 404'd. Next.js doesn't expose it directly to the
  // not-found page — we read window.location on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const p = window.location.pathname + window.location.search
    setPath(p)
    setGlitched(p)
  }, [])

  // Continuous corruption pass — scramble most chars, settle for a beat,
  // re-scramble. Mimics signal hunting in old terminals.
  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + 1)
    }, 220)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    // Alternate between heavily corrupted and lightly corrupted on each tick.
    const intensity = tick % 6 === 0 ? 0 : tick % 3 === 0 ? 0.6 : 0.25
    setGlitched(scramble(path, intensity))
  }, [tick, path])

  return (
    <div className="relative mx-auto flex min-h-[70vh] max-w-3xl flex-col items-start justify-center gap-8 px-6 py-12 md:px-10">
      {/* Hazard chrome — top */}
      <div className="hazard-stripe h-1 w-24" aria-hidden />

      <div className="flex flex-col gap-3">
        <span className="font-mono text-[10px] tracking-widest text-sys-red">
          ◉ ERROR · CÓDIGO 404 · ENTRADA NO LOCALIZADA
        </span>
        <h1
          className="font-syne text-5xl font-black leading-[0.95] text-primary md:text-7xl"
          style={{
            textShadow: '0 0 12px rgba(230,51,41,0.35), 0 0 24px rgba(230,51,41,0.15)',
          }}
        >
          // SEÑAL <span className="text-sys-red">PERDIDA</span>
        </h1>
        <p className="max-w-2xl font-grotesk text-base leading-relaxed text-secondary md:text-lg">
          La ruta que pediste no existe en este subsistema. Puede que la URL esté
          mal escrita, que el contenido haya sido despublicado, o que estés
          buscando algo que aún no hemos curado.
        </p>
      </div>

      {/* Glitched path readout */}
      <div className="flex flex-col gap-2 border border-sys-red/40 bg-black p-4 font-mono text-xs">
        <span className="sys-label text-muted">RUTA·SOLICITADA</span>
        <span
          className="break-all text-sys-red"
          style={{
            textShadow: '0 0 6px rgba(230,51,41,0.6), 0 0 12px rgba(230,51,41,0.25)',
            letterSpacing: '0.05em',
          }}
        >
          {glitched}
        </span>
        <span className="sys-label mt-2 text-muted">DIAGNÓSTICO</span>
        <ul className="flex flex-col gap-1 text-secondary">
          <li>· verificación de slug ····· <span className="text-sys-red">FALLA</span></li>
          <li>· consulta a feed ········· <span className="text-sys-red">SIN RESULTADO</span></li>
          <li>· intento de fallback ····· <span className="text-sys-red">DENEGADO</span></li>
          <li>
            · recuperación de sesión ··{' '}
            <span className="text-sys-amber">PARCIAL</span>
          </li>
        </ul>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 border px-4 py-2.5 font-mono text-[11px] tracking-widest transition-colors"
          style={{
            borderColor: '#F97316',
            color: '#F97316',
            backgroundColor: 'rgba(249,115,22,0.08)',
          }}
        >
          ◀ RETORNAR AL FEED
        </Link>
        <Link
          href="/agenda"
          className="font-mono text-[10px] tracking-widest text-muted transition-colors hover:text-primary"
        >
          //AGENDA
        </Link>
        <Link
          href="/mixes"
          className="font-mono text-[10px] tracking-widest text-muted transition-colors hover:text-primary"
        >
          //MIXES
        </Link>
        <Link
          href="/editorial"
          className="font-mono text-[10px] tracking-widest text-muted transition-colors hover:text-primary"
        >
          //EDITORIAL
        </Link>
      </div>

      {/* Hazard chrome — bottom */}
      <div className="hazard-stripe h-1 w-24" aria-hidden />

      <p className="font-mono text-[10px] tracking-widest text-muted">
        SUBSISTEMA·UNIT-10 · GRADIENTE·FM · CDMX
      </p>
    </div>
  )
}
