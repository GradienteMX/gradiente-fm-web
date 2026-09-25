'use client'

/**
 * Two honest alternatives to the land, same pieces, same order (the
 * engine's placement order: most alive first, the rim last):
 *   · Lista   — the visible fallback when WebGL cannot start.
 *   · Indice  — a screen-reader index of every piece on the terrain.
 */

import { Imagen as Image } from '@/components/kit/Imagen'
import type { ContentItem } from '@/lib/types'
import { FormatGlyph, FORMAT_LABEL } from '@/components/kit/Glyph'
import { effectiveBand, energyVariation } from '@/lib/vibe'
import { fitTitle } from '@/lib/typeset'
import { fmt } from '@/lib/logic/time'
import { CODE, bandSteps } from './codes'
import styles from './Lista.module.css'

type Open = (item: ContentItem, rect: { x: number; y: number; width: number; height: number } | null) => void

export function Lista({ items, archive, onOpen }: { items: ContentItem[]; archive: (item: ContentItem) => boolean; onOpen: Open }) {
  return (
    <div className={styles.lista} data-ui="">
      <header className={styles.head}>
        <p className={styles.kicker}>Territorio sin relieve</p>
        <h1 className={styles.title}>Tu navegador no pudo encender WebGL.</h1>
        <p className={styles.sub}>
          El territorio queda como lista: las mismas {items.length} piezas en el mismo orden — lo vivo primero, la orilla al final.
        </p>
      </header>
      <ul className={styles.grid}>
        {items.map((it) => {
          const b = effectiveBand(it)
          const mid = (b.min + b.max) / 2
          const old = archive(it)
          return (
            <li key={it.id}>
              <button
                type="button"
                className={styles.card}
                data-archive={old || undefined}
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect()
                  onOpen(it, { x: r.left, y: r.top, width: r.width, height: r.height })
                }}
                style={{ ['--band' as string]: bandSteps(b.min, b.max) }}
              >
                <span className={styles.art}>
                  {it.imageUrl ? <Image src={it.imageUrl} alt="" fill sizes="(max-width: 700px) 50vw, 220px" className={styles.img} /> : null}
                </span>
                <span className={styles.meta}>
                  <FormatGlyph type={it.type} size={12} />
                  {old ? 'AR · Archivo' : `${CODE[it.type]} · ${FORMAT_LABEL[it.type]}`} · {fmt.short(it.date ?? it.publishedAt)}
                </span>
                <span className={styles.name} style={{ fontVariationSettings: energyVariation(mid), fontSize: fitTitle(it.title, mid, 22, 13, 0.92) }}>
                  {it.title}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function Indice({ items, onOpen }: { items: ContentItem[]; onOpen: Open }) {
  return (
    <nav className="sr-only" aria-label="Índice de piezas del territorio">
      <ul>
        {items.map((it) => (
          <li key={it.id}>
            <button type="button" tabIndex={-1} onClick={() => onOpen(it, null)}>
              {FORMAT_LABEL[it.type]}: {it.title}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
