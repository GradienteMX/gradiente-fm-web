'use client'

/**
 * NOCHE — an event, printed as a bill. The flyer sits in a framed well; the
 * date is a boxed plate (tonight and live go red — live blinks, stepped);
 * hours, place and door price are a hairline ledger; the line-up is an
 * indexed list where every name leads to its ficha. Tickets are an explicit
 * escape hatch, never the default.
 */

import Link from 'next/link'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { ContentItem } from '@/lib/types'
import { useNow } from '@/lib/store/world'
import { eventProximity, fmt, isLive, PROXIMITY_LABEL, until, type Proximity } from '@/lib/logic/time'
import { energyVariation } from '@/lib/vibe'
import { entityHref, entitySlug } from '@/components/secciones/entities'
import { Calibrador } from '../Calibrador'
import { Paragraphs } from '../Prosa'
import { PollCanvas } from '@/components/encuesta/PollCanvas'
import { Mark } from '@/components/kit/Glyph'
import { StickerEvento } from '@/components/stickers/StickerEvento'
import { Art, Contexto, counter, Dek, hasContexto, Indice, Kicker, mid, Presenta, readerVars, Siguientes, Taxonomia, Title, titleSize, two, type ReaderProps } from './parts'
import styles from './readers.module.css'

export function Noche({ item }: ReaderProps) {
  const now = useNow()
  const m = mid(item)
  const prox = eventProximity(item, now)
  const live = isLive(item, now)
  const past = prox === 'pasado'
  const n = counter()
  const artists = item.artists ?? []
  const text = item.bodyPreview ?? item.excerpt ?? ''
  const ficha = Boolean(item.franjaId) || hasContexto(item) || item.genres.length > 0 || item.tags.length > 0

  return (
    <article
      className={styles.reader}
      data-type="evento"
      data-prox={prox}
      style={{ ...readerVars(item), ...(past ? { ['--art-filter' as string]: 'grayscale(1) contrast(1.05)' } : null) }}
    >
      <div className={styles.noche}>
        <div className={styles.nocheArt}>
          <Art item={item} ratio="4 / 5" sizes="(max-width: 900px) 100vw, 44vw" caption={item.heroCaption} />
        </div>

        <div className={styles.nocheInfo}>
          <header className={styles.nocheHead}>
            <Kicker item={item}>
              <span className={styles.prox} data-prox={prox}>
                {live ? <span className={styles.liveSq} aria-hidden="true" /> : null}
                {PROXIMITY_LABEL[prox]}
              </span>
            </Kicker>
            <Title item={item} max={84} />
            {item.subtitle ? <Dek>{item.subtitle}</Dek> : null}
          </header>

          <Cartel item={item} now={now} prox={prox} live={live} />

          {item.ticketUrl ? (
            <a href={item.ticketUrl} target="_blank" rel="noopener noreferrer" className={styles.tickets}>
              <span className={styles.ticketsLabel}>Boletos</span>
              <span className={styles.ticketsNote}>sales de Gradiente</span>
              <Mark name="external" size={14} />
            </a>
          ) : null}

          {/* Had a ticket? The night's stub goes on your credencial. */}
          <StickerEvento item={item} />

          {artists.length ? (
            <section className={styles.section} aria-label="Line-up">
              <Indice n={n()} name="Line-up" sub={`${artists.length} en el cartel · cada nombre abre su ficha`} />
              <ol className={styles.lineup}>
                {artists.map((a, i) => {
                  const e = Math.min(10, m + (i === 0 ? 0.6 : 0))
                  return (
                    <li key={`${i}-${a}`} className={styles.act} data-head={i === 0 || undefined}>
                      <span className={styles.actIdx}>{two(i + 1)}</span>
                      <span className={styles.actName} style={{ fontVariationSettings: energyVariation(e), fontSize: titleSize(a, e, i === 0 ? 58 : 30, i === 0 ? 24 : 17, true) }}>
                        <Billing text={a} />
                      </span>
                    </li>
                  )
                })}
              </ol>
            </section>
          ) : null}

          {text ? (
            <section className={styles.section} aria-label="La noche">
              <Indice n={n()} name="La noche" />
              <Paragraphs text={text} lede={false} />
            </section>
          ) : null}

          <Calibrador item={item} n={n()} />

          {item.poll ? <PollCanvas item={item} variant="section" /> : null}

          {ficha ? (
            <section className={styles.section} aria-label="Ficha">
              <Indice n={n()} name="Ficha" sub="quién la presenta, cómo se clasifica" />
              <Presenta item={item} />
              <div className={styles.ledgers}>
                <Contexto item={item} />
                <Taxonomia item={item} />
              </div>
            </section>
          ) : null}
        </div>
      </div>

      <div className={styles.after}>
        <Siguientes item={item} n={n()} label="Otras noches" sub="cerca de esta energía" />
      </div>
    </article>
  )
}

/** A billing like "Jackson b2b Bubu" is two people: each name opens its own ficha. */
function Billing({ text }: { text: string }) {
  const parts = text.split(/(\s+b2b\s+)/i)
  return (
    <>
      {parts.map((p, j) =>
        j % 2 === 1 ? (
          <span key={j} className={styles.b2b}>
            b2b
          </span>
        ) : entitySlug(p) ? (
          <Link key={j} href={entityHref(p)} className={styles.artist}>
            {p.trim()}
          </Link>
        ) : (
          <span key={j}>{p}</span>
        ),
      )}
    </>
  )
}

/** The date plate and the ledger beside it: hours, place, door price. */
function Cartel({ item, now, prox, live }: { item: ContentItem; now: Date; prox: Proximity; live: boolean }) {
  if (!item.date && !item.venue && !item.price) return null
  return (
    <div className={styles.cartel} data-plate={item.date ? '' : undefined}>
      {item.date ? (
        <div className={styles.fechaPlate} data-prox={prox}>
          <span className={styles.plateWeek}>{fmt.weekday(item.date)}</span>
          <span className={styles.plateDay}>{fmt.dayNum(item.date)}</span>
          <span className={styles.plateMonth}>{fmt.month(item.date)}</span>
        </div>
      ) : null}
      <dl className={styles.facts}>
        {item.date ? (
          <div>
            <dt>Horario</dt>
            <dd>
              <span className={styles.times}>
                {fmt.time(item.date)}
                {item.endDate ? ` → ${endLabel(item.date, item.endDate)}` : ''}
              </span>
              <span className={styles.countdown} data-prox={prox}>
                {prox === 'pasado' ? 'ya pasó' : live ? 'está sonando ahora' : differenceInCalendarDays(parseISO(item.date), now) <= 0 ? `hoy · ${until(item.date, now)}` : until(item.date, now)}
              </span>
            </dd>
          </div>
        ) : null}
        {item.venue ? (
          <div>
            <dt>Lugar</dt>
            <dd>
              {item.venue}
              {item.venueCity ? <span className={styles.dim}> · {item.venueCity}</span> : null}
            </dd>
          </div>
        ) : null}
        {item.price ? (
          <div>
            <dt>Precio</dt>
            <dd className={styles.price}>{item.price}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  )
}

/** Closing time; the day too when the night runs into another afternoon or longer. */
function endLabel(startIso: string, endIso: string): string {
  const days = differenceInCalendarDays(parseISO(endIso), parseISO(startIso))
  const late = days >= 2 || (days === 1 && parseISO(endIso).getHours() >= 12)
  return late ? `${fmt.weekday(endIso)} ${fmt.dayNum(endIso)} · ${fmt.time(endIso)}` : fmt.time(endIso)
}
