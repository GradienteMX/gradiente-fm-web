'use client'

/**
 * TEXTO — editorial, reseña, opinión, noticia. A reading room on the sheet:
 * the headline printed at the piece's energy, the words in a narrow
 * Newsreader column, and a rail beside them — the art as an archival plate,
 * the calibration next to the words it's about, then sources and context.
 */

import { Calibrador } from '../Calibrador'
import { BodyBlocks, Paragraphs } from '../Prosa'
import { PollCanvas } from '@/components/encuesta/PollCanvas'
import { Art, Byline, Contexto, counter, Dek, hasContexto, Indice, Kicker, Presenta, Progreso, readerVars, Siguientes, Taxonomia, Title, type ReaderProps } from './parts'
import { Escuchar } from './Escuchar'
import styles from './readers.module.css'

export function Texto({ item }: ReaderProps) {
  const dek = item.subtitle ?? (item.bodyPreview ? item.excerpt : undefined)
  const body = item.bodyPreview ?? item.excerpt ?? ''
  const n = counter()
  const tax = item.genres.length > 0 || item.tags.length > 0
  const ctx = Boolean(item.franjaId) || hasContexto(item)
  return (
    <article className={styles.reader} data-type={item.type} style={readerVars(item)}>
      <header className={styles.head}>
        <Kicker item={item} />
        <Title item={item} max={item.type === 'noticia' ? 72 : 92} />
        {dek ? <Dek>{dek}</Dek> : null}
        <Byline item={item} />
      </header>

      <div className={styles.grid}>
        <div className={styles.plate}>
          <Art item={item} ratio="4 / 5" sizes="(max-width: 900px) 100vw, 300px" caption={item.heroCaption} />
        </div>
        <div className={styles.main}>
          {item.articleBody?.length ? <BodyBlocks item={item} blocks={item.articleBody} footnotes={item.footnotes} /> : <Paragraphs text={body} footnotes={item.footnotes} />}
          {item.poll ? <PollCanvas item={item} variant="section" /> : null}
          {tax ? (
            <section className={styles.section} aria-label="Géneros y etiquetas">
              <Indice n={n()} name="Géneros y etiquetas" sub="un género sintoniza el campo" />
              <Taxonomia item={item} />
            </section>
          ) : null}
        </div>
        <aside className={styles.rail}>
          <Calibrador item={item} compact />
          <Escuchar item={item} />
          {ctx ? (
            <section className={styles.railBlock} aria-label="Contexto">
              <Indice as="p" name="Contexto" />
              <Presenta item={item} />
              <Contexto item={item} />
            </section>
          ) : null}
        </aside>
      </div>

      <div className={styles.after}>
        <Siguientes item={item} n={n()} />
      </div>
      <Progreso />
    </article>
  )
}
