'use client'

import { useCampo } from '@/lib/store/campo'
import { FORMAT_ON, FORMAT_PLURAL, FORMAT_STOCK } from '@/components/kit/Glyph'
import { Descifrar } from '@/components/librea/Descifrar'
import { shortGenreName } from '@/lib/logic/genres'
import { bandLabel, isFullRange } from '@/lib/vibe'
import styles from './Estado.module.css'

/**
 * The status line over the organism: what you're looking at, in words,
 * with a way out of every filter. No numbers that rank anything.
 */
export function Estado({ shown, index = '03' }: { shown: number; index?: string }) {
  const range = useCampo((s) => s.range)
  const type = useCampo((s) => s.type)
  const genres = useCampo((s) => s.genres)
  const setType = useCampo((s) => s.setType)
  const setGenres = useCampo((s) => s.setGenres)
  const resetRange = useCampo((s) => s.resetRange)

  const full = isFullRange(range)
  const filtered = !full || type || genres.length

  return (
    <div className={styles.estado}>
      <p className={styles.line}>
        <span className={styles.index}>{index}</span>
        <span className={styles.slash}>/</span>
        <span
          className={styles.name}
          style={(type ? { '--chip': FORMAT_STOCK[type], '--chip-on': FORMAT_ON[type] } : {}) as React.CSSProperties}
        >
          <Descifrar text={type ? FORMAT_PLURAL[type].toUpperCase() : filtered ? 'FILTRADO' : 'TODO LO QUE VIVE'} />
        </span>
        <span className={styles.what}>
          — {shown} {shown === 1 ? 'pieza' : 'piezas'}
          {type ? ` · ${FORMAT_PLURAL[type].toLowerCase()}` : ''}
          {!full ? ` · ${bandLabel(Math.round(range[0]), Math.round(range[1]))}` : ''}
          {genres.length ? ` · ${genres.map(shortGenreName).join(' + ')}` : ''}
        </span>
      </p>
      <div className={styles.right}>
        {filtered ? (
          <div className={styles.clears}>
            {!full ? (
              <button type="button" onClick={resetRange}>
                × energía
              </button>
            ) : null}
            {type ? (
              <button type="button" onClick={() => setType(null)}>
                × formato
              </button>
            ) : null}
            {genres.length ? (
              <button type="button" onClick={() => setGenres([])}>
                × {genres.length === 1 ? 'género' : `${genres.length} géneros`}
              </button>
            ) : null}
          </div>
        ) : null}
        <span className={styles.rule}>tamaño + posición = vida</span>
      </div>
    </div>
  )
}
