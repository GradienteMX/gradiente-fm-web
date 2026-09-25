'use client'

/**
 * SECCIÓN — one template for every type page (mixes, lecturas, the legacy
 * type routes). The Horizonte on top (energy filters everything here), a
 * masthead whose name breathes with the field, one honest status line, and
 * the organism: home sizes (HL), ordered by date — newest first.
 *
 * Filtering happens in the surface (it knows its own universe); this
 * component only ranks and lays out.
 */

import { useMemo, type ReactNode } from 'react'
import type { ContentItem, ContentType } from '@/lib/types'
import { useNow } from '@/lib/store/world'
import { rankCategory } from '@/lib/logic/feed'
import { Horizonte } from '@/components/horizonte/Horizonte'
import { Organismo } from '@/components/organismo/Organismo'
import { Cabecera } from '@/components/librea/Cabecera'
import type { Librea } from '@/lib/librea'
import { EstadoSeccion } from './EstadoSeccion'
import styles from './Seccion.module.css'

export interface SeccionProps {
  /** The section's livery (it morphs when this changes). */
  librea: Librea
  /** Pictogram key for the masthead (defaults to the livery's). */
  glyph?: string
  /** Pictogram(s) for the kicker — shape, never color. */
  glyphs?: ContentType[]
  /** Indexical number of the section ("02"), as printed in the kicker. */
  index: string
  kicker: string
  title: string
  dek: ReactNode
  /** Pieces passing the instrument, in this section. */
  filtered: ContentItem[]
  /** Everything this section holds (catalog fact). */
  total: number
  noun?: [string, string]
  /** Right side of the masthead foot (a working action, or nothing). */
  actions?: ReactNode
  /** Between masthead and status (e.g. the tipo control). */
  controls?: ReactNode
  /** What to call it when there is nothing at all yet. */
  emptyNoun?: string
}

export function Seccion({ librea, glyph, dek, filtered, total, noun, actions, controls, emptyNoun = 'piezas' }: SeccionProps) {
  const now = useNow()
  const minute = Math.floor(now.getTime() / 60_000)
  const ranked = useMemo(() => rankCategory(filtered, new Date(minute * 60_000)), [filtered, minute])

  return (
    <div className={styles.seccion}>
      <Cabecera
        librea={librea}
        glyph={glyph}
        lema={dek}
        datos={[
          { k: 'en el archivo', v: String(total).padStart(2, '0') },
          { k: 'en esta temperatura', v: String(filtered.length).padStart(2, '0') },
        ]}
      >
        {controls || actions ? (
          <div className={styles.cabControls}>
            {controls}
            {actions ? <div className={styles.actions}>{actions}</div> : null}
          </div>
        ) : null}
      </Cabecera>
      <Horizonte showFormats={false} />
      <div className={styles.frame}>

        <EstadoSeccion shown={filtered.length} total={total} noun={noun} order="Lo más nuevo primero · el tamaño es la vida de cada pieza" />

        <h2 className="sr-only">Piezas</h2>
        <div className={styles.mosaico}>
          <Organismo
            ranked={ranked}
            empty={
              total === 0 ? (
                <div className={styles.empty}>
                  <p className={styles.emptyTitle}>Todavía no hay {emptyNoun} aquí.</p>
                  <p className={styles.emptyBody}>Cuando alguien publique algo, crecerá en este lugar.</p>
                </div>
              ) : (
                <div className={styles.empty}>
                  <p className={styles.emptyTitle}>Nada en esta temperatura.</p>
                  <p className={styles.emptyBody}>Mueve el horizonte o suelta un filtro.</p>
                </div>
              )
            }
          />
        </div>
      </div>
    </div>
  )
}
