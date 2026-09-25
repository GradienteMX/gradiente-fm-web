'use client'

/**
 * CRÓNICA — the long-form artículo (and the ranked lista, via `lista`).
 * Hero-led: the cover plate in a framed well, then the headline printed at
 * the piece's energy. A live índice on the left follows where you are; the
 * body is the structured block vocabulary (a lista's entries carry big
 * indices); the rail keeps calibration, sources and context within reach.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ArticleBlock } from '@/lib/types'
import { Calibrador } from '../Calibrador'
import { BodyBlocks, Paragraphs } from '../Prosa'
import { PollCanvas } from '@/components/encuesta/PollCanvas'
import { Art, Byline, Contexto, counter, Dek, hasContexto, Indice, Kicker, Presenta, Progreso, readerVars, Siguientes, Taxonomia, Title, two, type ReaderProps } from './parts'
import { Escuchar } from './Escuchar'
import styles from './readers.module.css'

type TrackB = Extract<ArticleBlock, { kind: 'track' }>

export function Cronica({ item }: ReaderProps) {
  return <LongForm item={item} lista={false} />
}

export function Lista({ item }: ReaderProps) {
  return <LongForm item={item} lista />
}

function LongForm({ item, lista }: ReaderProps & { lista: boolean }) {
  const blocks = useMemo(() => item.articleBody ?? [], [item.articleBody])
  const sections = useMemo(() => {
    let n = 0
    return blocks.filter((b): b is Extract<ArticleBlock, { kind: 'h2' }> => b.kind === 'h2').map((b) => ({ id: b.id ?? `s-${++n}`, text: b.text }))
  }, [blocks])
  // Entries keep their block index: it's their anchor (`#entrada-N`) in the body.
  const tracks = useMemo(() => blocks.flatMap((b, i) => (b.kind === 'track' ? [{ t: b as TrackB, at: i }] : [])), [blocks])
  const order = useMemo(() => {
    const ranks = tracks.map(({ t }) => t.rank).filter((r): r is number => typeof r === 'number')
    if (ranks.length < 2) return 'sin rango'
    return ranks[0] > ranks[ranks.length - 1] ? 'cuenta regresiva' : 'ascendente'
  }, [tracks])
  const [active, setActive] = useState<string | null>(null)
  const article = useRef<HTMLElement>(null)

  useEffect(() => {
    if (lista || !sections.length) return
    // The scroller this reading lives in (the page may hold other scrollers).
    const root = (article.current?.closest('[data-lenis-prevent]') as HTMLElement | null) ?? null
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (vis) setActive((vis.target as HTMLElement).id)
      },
      { root, rootMargin: '0px 0px -65% 0px' },
    )
    sections.forEach((s) => {
      const el = document.getElementById(s.id)
      if (el) io.observe(el)
    })
    return () => io.disconnect()
  }, [lista, sections])

  const n = counter()
  const tax = item.genres.length > 0 || item.tags.length > 0
  const ctx = Boolean(item.franjaId) || hasContexto(item)

  return (
    <article ref={article} className={styles.reader} data-type={item.type} style={readerVars(item)}>
      <div className={styles.hero}>
        <Art item={item} ratio="21 / 9" sizes="(max-width: 900px) 100vw, 1180px" caption={item.heroCaption} />
      </div>
      <header className={styles.head}>
        <Kicker item={item}>
          {lista ? (
            <span className={styles.kickerMeta}>
              {tracks.length} entradas · {order}
            </span>
          ) : null}
        </Kicker>
        <Title item={item} max={96} />
        {item.subtitle || item.excerpt ? <Dek>{item.subtitle ?? item.excerpt}</Dek> : null}
        <Byline item={item} />
      </header>

      <div className={styles.long}>
        <nav className={styles.index} aria-label={lista ? 'La lista' : 'Índice'}>
          <Indice as="p" name={lista ? 'La lista' : 'Índice'} aside={lista ? two(tracks.length) : sections.length ? `§${two(sections.length)}` : undefined} />
          {lista ? (
            <ol className={styles.indexList}>
              {tracks.map(({ t, at }, k) => (
                <li key={at}>
                  <a href={`#entrada-${at}`}>
                    <span className={styles.indexRank}>{two(t.rank ?? k + 1)}</span>
                    <span>
                      <b>{t.artist}</b> — {t.title}
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          ) : sections.length ? (
            <ol className={styles.indexList}>
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} data-on={active === s.id || undefined} aria-current={active === s.id ? 'location' : undefined}>
                    <span className={styles.indexRank}>§{two(i + 1)}</span>
                    <span>{s.text}</span>
                  </a>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.dim}>Una sola sección.</p>
          )}
        </nav>

        <div className={styles.main}>
          {blocks.length ? <BodyBlocks item={item} blocks={blocks} footnotes={item.footnotes} /> : <Paragraphs text={item.bodyPreview ?? item.excerpt ?? ''} footnotes={item.footnotes} />}
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
        <Siguientes item={item} n={n()} label={lista ? 'Siguientes listas' : 'Siguientes lecturas'} />
      </div>
      <Progreso />
    </article>
  )
}
