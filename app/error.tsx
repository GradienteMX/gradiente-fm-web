'use client'

import { useEffect } from 'react'
import Link from 'next/link'

// Branded error boundary for any uncaught render/runtime error inside the app
// tree (route-segment level). Matches the not-found.tsx terminal voice but is
// STATIC — no scramble loop — so it is reduced-motion-safe by construction.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // No Sentry yet (deferred per beta posture); surface to the console so the
    // error + digest are at least visible in Vercel function logs.
    console.error('[gradiente] uncaught error:', error)
  }, [error])

  return (
    <div className="relative mx-auto flex min-h-[70vh] max-w-3xl flex-col items-start justify-center gap-8 px-6 py-12 md:px-10">
      <div className="hazard-stripe h-1 w-24" aria-hidden />

      <div className="flex flex-col gap-3">
        <span className="font-mono text-[10px] tracking-widest text-sys-red">
          ◉ FALLO · SUBSISTEMA INTERRUMPIDO
        </span>
        <h1
          className="font-syne text-5xl font-black leading-[0.95] text-primary md:text-7xl"
          style={{
            textShadow:
              '0 0 12px rgba(230,51,41,0.35), 0 0 24px rgba(230,51,41,0.15)',
          }}
        >
          // SEÑAL <span className="text-sys-red">CORRUPTA</span>
        </h1>
        <p className="max-w-2xl font-grotesk text-base leading-relaxed text-secondary md:text-lg">
          Algo se rompió al renderizar este subsistema. El error quedó
          registrado. Puedes reintentar la transmisión o volver al feed.
        </p>
      </div>

      <div className="flex flex-col gap-2 border border-sys-red/40 bg-black p-4 font-mono text-xs">
        <span className="sys-label text-muted">DIAGNÓSTICO</span>
        <ul className="flex flex-col gap-1 text-secondary">
          <li>· render del subsistema ···· <span className="text-sys-red">FALLA</span></li>
          <li>· registro de error ········ <span className="text-sys-amber">CAPTURADO</span></li>
          {error.digest && (
            <li>
              · digest ··················{' '}
              <span className="break-all text-muted">{error.digest}</span>
            </li>
          )}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 border px-4 py-2.5 font-mono text-[11px] tracking-widest transition-colors"
          style={{
            borderColor: '#F97316',
            color: '#F97316',
            backgroundColor: 'rgba(249,115,22,0.08)',
          }}
        >
          ◀ REINTENTAR
        </button>
        <Link
          href="/"
          className="font-mono text-[10px] tracking-widest text-muted transition-colors hover:text-primary"
        >
          //FEED
        </Link>
      </div>

      <div className="hazard-stripe h-1 w-24" aria-hidden />
      <p className="font-mono text-[10px] tracking-widest text-muted">
        SUBSISTEMA·UNIT-10 · GRADIENTE · CDMX
      </p>
    </div>
  )
}
