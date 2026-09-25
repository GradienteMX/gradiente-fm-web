'use client'

/**
 * FALLA — the error boundary's face. Honest: something broke while drawing
 * this part of the field; the rest of the world is intact. "Reintentar"
 * re-renders the segment; the other way out is the field itself.
 */

import Link from 'next/link'
import { useEffect } from 'react'
import { Mark } from '@/components/kit/Glyph'
import { EnergyTitle } from '@/components/secciones/EnergyTitle'
import styles from './SinSenal.module.css'

export function Falla({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error('[gradiente] fallo al dibujar la sección:', error)
  }, [error])

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <p className={styles.kicker}>
          <span className={styles.broken} aria-hidden="true" />
          <span className="label">Interrupción</span>
        </p>

        <EnergyTitle text="Algo se rompió al dibujar esta parte." energy={8.5} max={112} min={36} share={0.96} />

        <p className={styles.lede}>
          No es tu culpa y no se perdió nada de lo que hiciste: tus guardados, lecturas y borradores siguen en su lugar. Esta sección no
          pudo terminar de pintarse. Puedes intentarlo de nuevo o volver al campo.
        </p>

        <div className={styles.acciones}>
          <button type="button" className={styles.primary} onClick={() => retry()}>
            <Mark name="arrow" size={15} />
            Reintentar
          </button>
          <Link href="/" className={styles.secondary}>
            Volver al campo
          </Link>
        </div>

        {error.digest || error.message ? (
          <details className={styles.detalle}>
            <summary>Detalle técnico</summary>
            {error.message ? <p>{error.message}</p> : null}
            {error.digest ? <p>Referencia: {error.digest}</p> : null}
          </details>
        ) : null}
      </div>
    </div>
  )
}
