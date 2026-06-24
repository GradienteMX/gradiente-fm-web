'use client'

import { useEffect } from 'react'

// Root-level error boundary — only fires when the root layout itself throws,
// so it must render its own <html>/<body> and cannot rely on globals.css or
// the brand fonts being present. Inline styles keep it self-contained. Static
// (no animation) → reduced-motion-safe.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[gradiente] root error:', error)
  }, [error])

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          gap: 20,
          padding: '48px 24px',
          background: '#0D0D0D',
          color: '#E5E5E5',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}
      >
        <span style={{ fontSize: 10, letterSpacing: '0.18em', color: '#E63329' }}>
          ◉ FALLO CRÍTICO · NÚCLEO INTERRUMPIDO
        </span>
        <h1 style={{ fontSize: 40, fontWeight: 800, margin: 0, lineHeight: 1, color: '#fff' }}>
          // SEÑAL <span style={{ color: '#E63329' }}>PERDIDA</span>
        </h1>
        <p style={{ maxWidth: 560, fontSize: 14, lineHeight: 1.6, color: '#A3A3A3' }}>
          Gradiente no pudo arrancar este documento. El error quedó registrado.
          Reintenta la transmisión.
        </p>
        {error.digest && (
          <code style={{ fontSize: 11, color: '#666', wordBreak: 'break-all' }}>
            digest: {error.digest}
          </code>
        )}
        <button
          onClick={reset}
          style={{
            border: '1px solid #F97316',
            color: '#F97316',
            background: 'rgba(249,115,22,0.08)',
            padding: '10px 16px',
            fontSize: 11,
            letterSpacing: '0.18em',
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          ◀ REINTENTAR
        </button>
      </body>
    </html>
  )
}
