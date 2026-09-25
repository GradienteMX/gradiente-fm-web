'use client'

/**
 * The one honest line over a section: how many pieces pass the instrument
 * right now, in words for the band, with a way out of every filter. The
 * count is a catalog fact (how many exist here), never a ranking signal.
 */

import type { ReactNode } from 'react'
import { useCampo } from '@/lib/store/campo'
import { shortGenreName } from '@/lib/logic/genres'
import { bandLabel, isFullRange } from '@/lib/vibe'
import styles from './Seccion.module.css'

interface Props {
  shown: number
  total: number
  /** Singular / plural noun for what is counted. */
  noun?: [string, string]
  /** How the surface is ordered — said once, plainly. */
  order?: string
  /** What the count means, when it is not just the temperature (a search). */
  phrase?: string
  extra?: ReactNode
}

export function EstadoSeccion({ shown, total, noun = ['pieza', 'piezas'], order, phrase = 'en esta temperatura', extra }: Props) {
  const range = useCampo((s) => s.range)
  const genres = useCampo((s) => s.genres)
  const setGenres = useCampo((s) => s.setGenres)
  const resetRange = useCampo((s) => s.resetRange)
  const full = isFullRange(range)
  const narrowed = !full || genres.length > 0

  return (
    <div className={styles.estado}>
      <p className={styles.estadoLine} aria-live="polite">
        <span className={styles.estadoCount}>
          <b className="num">{shown}</b> {shown === 1 ? noun[0] : noun[1]} {phrase}
          {narrowed && total !== shown ? <span className={styles.estadoOf}> de {total}</span> : null}
        </span>
        <span className={styles.estadoSep} aria-hidden="true" />
        <span className={styles.estadoBand}>
          {String(Math.round(range[0])).padStart(2, '0')}–{String(Math.round(range[1])).padStart(2, '0')} ·{' '}
          {full ? 'Todo el espectro' : bandLabel(Math.round(range[0]), Math.round(range[1]))}
        </span>
        {genres.length ? <span className={styles.estadoGenres}>· {genres.map(shortGenreName).join(' + ')}</span> : null}
        {extra}
      </p>
      <div className={styles.estadoRight}>
        {order ? <span className={styles.estadoOrder}>{order}</span> : null}
        {narrowed ? (
          <span className={styles.clears}>
            {!full ? (
              <button type="button" onClick={resetRange}>
                × energía
              </button>
            ) : null}
            {genres.length ? (
              <button type="button" onClick={() => setGenres([])}>
                × {genres.length === 1 ? 'género' : `${genres.length} géneros`}
              </button>
            ) : null}
          </span>
        ) : null}
      </div>
    </div>
  )
}
