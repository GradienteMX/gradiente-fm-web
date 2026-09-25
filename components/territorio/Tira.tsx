'use client'

/**
 * TIRA — the franja's identity strip while its land is gathered. A V2
 * reading of the vinyl obi: a band that wraps the record without touching
 * it. Logo, the name set vertically like a spine, what it is, the facts the
 * catalog can prove (pieces on the land, the next night, the stall), the
 * affine franjas (ranked by the engine, never by behavior), the dossier and
 * the way out. Identity is chrome: it never takes a cell.
 */

import { Imagen as Image } from '@/components/kit/Imagen'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { ContentItem, ContentType } from '@/lib/types'
import { FormatGlyph, FORMAT_LABEL, FORMAT_PLURAL, Mark } from '@/components/kit/Glyph'
import { KIND_LABEL } from '@/components/dial/Dial'
import { fmt } from '@/lib/logic/time'
import styles from './Tira.module.css'

function contactLabel(url: string): string {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'instagram.com') {
      const handle = u.pathname.split('/').filter(Boolean)[0]
      if (handle) return `@${handle}`
    }
    return host
  } catch {
    return url
  }
}

const TYPE_ORDER: ContentType[] = ['evento', 'mix', 'review', 'editorial', 'opinion', 'articulo', 'listicle', 'noticia']

export function Tira({
  franja,
  members,
  listings,
  related,
  now,
  onFocus,
  onExit,
}: {
  franja: ContentItem
  members: ContentItem[]
  listings: number
  related: { slug: string; title: string }[]
  now: Date
  onFocus: (slug: string) => void
  onExit: () => void
}) {
  const [ri, setRi] = useState(0)
  const kind = franja.franjaKind ? KIND_LABEL[franja.franjaKind] : 'Franja'

  const byType = useMemo(() => {
    const m = new Map<ContentType, number>()
    for (const it of members) m.set(it.type, (m.get(it.type) ?? 0) + 1)
    return TYPE_ORDER.filter((t) => m.has(t)).map((t) => ({ t, n: m.get(t)! }))
  }, [members])

  const nights = useMemo(() => {
    const ev = members.filter((i) => i.type === 'evento' && i.date).sort((a, b) => (a.date! < b.date! ? -1 : 1))
    const t = now.getTime()
    const next = ev.find((e) => Date.parse(e.endDate ?? e.date!) >= t) ?? null
    const last = [...ev].reverse().find((e) => Date.parse(e.date!) < t) ?? null
    return { next, last }
  }, [members, now])

  const where = franja.marketplaceLocation ?? franja.subtitle ?? null
  const rel = related.length ? related[((ri % related.length) + related.length) % related.length] : null

  return (
    <aside className={styles.tira} data-ui="" aria-label={`${franja.title}: franja enfocada, ${members.length} piezas en el territorio`}>
      <header className={styles.head}>
        <span className={styles.kind}>
          <span className={styles.band} aria-hidden="true" />
          FR · {kind}
        </span>
        <button type="button" className={styles.x} onClick={onExit} aria-label="Salir del enfoque">
          <Mark name="close" size={14} />
        </button>
      </header>

      <div className={styles.identity}>
        <div className={styles.logo}>
          {franja.imageUrl ? <Image src={franja.imageUrl} alt={`Logo de ${franja.title}`} fill sizes="88px" className={styles.logoImg} /> : null}
        </div>
        <div className={styles.spine} style={{ ['--len' as string]: String(Math.max(5, franja.title.length)) }}>
          <h2 className={styles.name}>{franja.title}</h2>
        </div>
      </div>

      <dl className={styles.facts}>
        <div>
          <dt>Territorio</dt>
          <dd>
            {members.length} {members.length === 1 ? 'pieza firmada' : 'piezas firmadas'}
            <span className={styles.types}>
              {byType.map(({ t, n }) => (
                <span key={t} title={`${n} · ${n === 1 ? FORMAT_LABEL[t] : FORMAT_PLURAL[t]}`}>
                  <FormatGlyph type={t} size={12} />
                  {n}
                </span>
              ))}
            </span>
          </dd>
        </div>
        {nights.next ? (
          <div>
            <dt>Próxima</dt>
            <dd>
              {fmt.short(nights.next.date!)}
              {nights.next.venue ? ` · ${nights.next.venue}` : ''}
            </dd>
          </div>
        ) : nights.last ? (
          <div>
            <dt>Última</dt>
            <dd>
              {fmt.short(nights.last.date!)}
              {nights.last.venue ? ` · ${nights.last.venue}` : ''}
            </dd>
          </div>
        ) : null}
        {listings > 0 ? (
          <div>
            <dt>Mercado</dt>
            <dd>
              <Link href={`/mercado?franja=${franja.slug}`} className={styles.inline}>
                {listings} {listings === 1 ? 'pieza' : 'piezas'} en su puesto
              </Link>
            </dd>
          </div>
        ) : null}
        {where ? (
          <div>
            <dt>Dónde</dt>
            <dd>{where}</dd>
          </div>
        ) : null}
        {franja.franjaUrl ? (
          <div>
            <dt>Señal</dt>
            <dd>
              <a href={franja.franjaUrl} target="_blank" rel="noopener noreferrer" className={styles.inline}>
                {contactLabel(franja.franjaUrl)}
                <Mark name="external" size={11} />
              </a>
            </dd>
          </div>
        ) : null}
      </dl>

      {rel ? (
        <div className={styles.related}>
          <span className={styles.relLabel}>Afines</span>
          <div className={styles.relRow}>
            <button type="button" className={styles.step} aria-label="Franja afín anterior" onClick={() => setRi((i) => i - 1)} disabled={related.length < 2}>
              ‹
            </button>
            <button type="button" className={styles.relName} onClick={() => onFocus(rel.slug)} title={`Enfocar ${rel.title}`}>
              {rel.title}
            </button>
            <button type="button" className={styles.step} aria-label="Siguiente franja afín" onClick={() => setRi((i) => i + 1)} disabled={related.length < 2}>
              ›
            </button>
          </div>
        </div>
      ) : null}

      <div className={styles.actions}>
        <Link href={`/f/${franja.slug}`} className={styles.primary}>
          Entrar al dossier
          <Mark name="arrow" size={13} />
        </Link>
        <button type="button" className={styles.secondary} onClick={onExit}>
          Salir del enfoque
        </button>
      </div>
    </aside>
  )
}
