'use client'

/**
 * RECEPCIÓN — how your work was received. Shape, never weights.
 *
 *   PRESENCIA  your creator-side ledger in a window: which gestures your
 *              presence was made of, as proportions, with honest counts and
 *              a day-by-day line with no axis.
 *   OBRA       per piece you made: the four ways people met it (clic,
 *              apertura, guardado, comentario), counted, as shares of what
 *              that piece received — and its life in words. Read from the
 *              server's `creator_reception(p_days)` (migration 0050), which
 *              aggregates in the database: raw events, weights and the
 *              novelty multiplier never leave it.
 *
 * Self-only by construction: it reads your rows and nobody else's. No
 * weight, no multiplier and no one's identity ever reaches this screen.
 */

import { Imagen as Image } from '@/components/kit/Imagen'
import { useEffect, useMemo, useState } from 'react'
import type { ContentItem, PresenceRow, User } from '@/lib/types'
import { useWorld } from '@/lib/store/world'
import { createClient } from '@/lib/supabase/client'
import { currentHp } from '@/lib/curation'
import { hlBracket } from '@/lib/dashboard/hl'
import { bandGradient, energyHex, energyVariation } from '@/lib/vibe'
import { fmt } from '@/lib/logic/time'
import { FormatGlyph, FORMAT_LABEL, Mark } from '@/components/kit/Glyph'
import { Revelado } from '@/components/trama/Revelado'
import { Accion, Latch, Nota, ShareRow, Shares, Sparkline, SubPanel, SubTabs, Vacio } from './kit'
import { bandCode, pieceEnergy, plural, useTallerParams } from './logic'
import styles from './Recepcion.module.css'

type Vista = 'presencia' | 'obra'
const WINDOWS = [7, 30, 90] as const
const DAY = 86_400_000

// ── the creator-side vocabulary (said from where the work landed) ───────────

type PKind = PresenceRow['kind']
const P_KINDS: PKind[] = ['publish', 'item_saved', 'comment_received', 'comment_saved', 'reaction_received', 'vibe_check_cast', 'vibe_check_accurate', 'harvest']

const P_LABEL: Record<PKind, string> = {
  publish: 'Publicaste',
  item_saved: 'Guardaron tu publicación',
  comment_received: 'Comentaron tu publicación',
  comment_saved: 'Guardaron tu comentario',
  reaction_received: 'Reaccionaron a tu comentario',
  vibe_check_cast: 'Calibraste',
  vibe_check_accurate: 'Tu vibra atinó',
  harvest: 'Cosechaste',
}

/** «La mayor parte vino …» */
const P_MOSTLY: Record<PKind, string> = {
  publish: 'de lo que publicaste',
  item_saved: 'de que guardaran tus publicaciones',
  comment_received: 'de que comentaran tus publicaciones',
  comment_saved: 'de que guardaran tus comentarios',
  reaction_received: 'de las reacciones a tus comentarios',
  vibe_check_cast: 'de tus calibraciones',
  vibe_check_accurate: 'de que tu vibra atinara',
  harvest: 'de tu cosecha',
}

type RKind = 'click' | 'open' | 'save' | 'comment'
const R_KINDS: RKind[] = ['click', 'open', 'save', 'comment']
const R_ONE: Record<RKind, string> = { click: 'clic', open: 'apertura', save: 'guardado', comment: 'comentario' }
const R_MANY: Record<RKind, string> = { click: 'clics', open: 'aperturas', save: 'guardados', comment: 'comentarios' }
const R_LABEL: Record<RKind, string> = { click: 'Clic en su cartel', open: 'La abrieron', save: 'La guardaron', comment: 'La comentaron' }

function isReader(k: string): k is RKind {
  return k === 'click' || k === 'open' || k === 'save' || k === 'comment'
}

// ── the server's aggregate (creator_reception, 0050 §2) ─────────────────────

interface ReceptionKind {
  kind: string
  events: number
  /** Percent of that item's (or, in totals, all your pieces') earned HL in the window. */
  share: number | null
}

interface Reception {
  items: Array<{ id: string; kinds: ReceptionKind[] }>
  totals: ReceptionKind[]
}

type ReceptionState = { state: 'leyendo' } | { state: 'listo'; data: Reception } | { state: 'error' }

/** Your pieces' reception over the last `days` UTC days, aggregated by the database. */
function useReception(days: number): ReceptionState {
  const [got, setGot] = useState<{ days: number; r: ReceptionState } | null>(null)
  useEffect(() => {
    let alive = true
    createClient()
      .rpc('creator_reception', { p_days: days })
      .then(({ data, error }: { data: unknown; error: unknown }) => {
        if (!alive) return
        const rec = data as Partial<Reception> | null
        setGot({ days, r: error || !rec ? { state: 'error' } : { state: 'listo', data: { items: rec.items ?? [], totals: rec.totals ?? [] } } })
      })
    return () => {
      alive = false
    }
  }, [days])
  return got && got.days === days ? got.r : { state: 'leyendo' }
}

// ── the space ───────────────────────────────────────────────────────────────

export function RecepcionSpace({ me, now, pieces }: { me: User; now: Date; pieces: ContentItem[] }) {
  const { params, set } = useTallerParams()
  const vista: Vista = params.get('vista') === 'obra' ? 'obra' : 'presencia'
  const rawV = Number(params.get('ventana'))
  const days = (WINDOWS as readonly number[]).includes(rawV) ? rawV : 30
  // N calendar days, today included: the same span the day-by-day line draws.
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const since = today.getTime() - (days - 1) * DAY

  return (
    <div className={styles.recepcion}>
      <div className={styles.main}>
        <header className={styles.head} data-rise="">
          <p className={styles.private}>
            <Mark name="lock" size={11} />
            Solo tú ves esto
          </p>
          <Revelado as="h2" className={styles.title}>
            Cómo se recibió tu trabajo
          </Revelado>
          <p className={styles.sub}>La forma de lo que pasó: proporciones y conteos, nunca pesos.</p>
        </header>
        <div className={styles.controls} data-rise="">
          <SubTabs<Vista>
            idBase="recepcion"
            label="Qué leer"
            value={vista}
            onChange={(v) => set({ vista: v === 'presencia' ? null : v })}
            tabs={[
              { value: 'presencia', label: 'Presencia' },
              { value: 'obra', label: 'Obra' },
            ]}
          />
          <div className={styles.window}>
            <Latch<string>
              label="Ventana"
              size="sm"
              value={String(days)}
              onChange={(v) => set({ ventana: v === '30' ? null : v })}
              options={WINDOWS.map((w) => ({ value: String(w), label: `${w} d`, hint: `Últimos ${w} días` }))}
            />
            <span className={styles.since}>desde {fmt.short(new Date(since).toISOString())}</span>
          </div>
        </div>
        <SubPanel idBase="recepcion" value={vista}>
          {vista === 'presencia' ? <Presencia me={me} now={now} days={days} since={since} /> : <Obra now={now} pieces={pieces} days={days} />}
        </SubPanel>
      </div>
      <aside className={styles.margin} aria-label="Notas al margen" data-rise="">
        {vista === 'presencia' ? (
          <>
            <Nota>Tu presencia es privada. Esta hoja existe solo para ti; no hay una igual que apunte a nadie más.</Nota>
            <Nota>Verás de qué estuvo hecha, no cuánto vale cada gesto: una lista de precios haría que uno trabajara para la lista.</Nota>
            <Nota>Lo que te llega cuenta una vez por persona; un comentario, una vez por persona y día.</Nota>
            <Nota>Sin movimiento, tu presencia se enfría a la mitad en unos sesenta días.</Nota>
            <Nota>Tu presencia de hoy también guarda lo anterior a este registro: está en el total, pero no tiene desglose.</Nota>
          </>
        ) : (
          <>
            <Nota>Nadie aparece con nombre: quien guarda, abre o comenta lo hace sin firmar aquí.</Nota>
            <Nota>Clics y aperturas cuentan una vez por hora por persona. Guardar cuenta una vez.</Nota>
            <Nota>La parte de cada gesto es sobre lo que esa pieza recibió en la ventana. El tamaño y la posición en el campo siguen siendo lo único público.</Nota>
            <Nota>El registro por pieza guarda 180 días y cuenta por días completos (UTC); lo anterior vive en su HL, sin desglose.</Nota>
          </>
        )}
      </aside>
    </div>
  )
}

// ── PRESENCIA ───────────────────────────────────────────────────────────────

function Presencia({ me, now, days, since }: { me: User; now: Date; days: number; since: number }) {
  const all = useWorld((s) => s.world.presence)
  const data = useMemo(() => {
    const rows = all.filter((r) => r.userId === me.id && Date.parse(r.at) >= since && Date.parse(r.at) <= now.getTime())
    const count: Record<PKind, number> = { publish: 0, item_saved: 0, comment_received: 0, comment_saved: 0, reaction_received: 0, vibe_check_cast: 0, vibe_check_accurate: 0, harvest: 0 }
    const sum: Record<PKind, number> = { ...count }
    let total = 0
    for (const r of rows) {
      count[r.kind] += 1
      sum[r.kind] += r.weight
      total += r.weight
    }
    // Day buckets, local calendar.
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    const first = start.getTime() - (days - 1) * DAY
    const series = Array.from({ length: days }, () => 0)
    for (const r of rows) {
      const i = Math.floor((Date.parse(r.at) - first) / DAY)
      if (i >= 0 && i < days) series[i] += r.weight
    }
    const kinds = P_KINDS.map((k) => ({ k, n: count[k], share: total > 0 ? (sum[k] / total) * 100 : 0 })).sort(
      (a, b) => b.share - a.share || P_KINDS.indexOf(a.k) - P_KINDS.indexOf(b.k),
    )
    return { events: rows.length, kinds, series, activeDays: series.filter((v) => v > 0).length, first }
  }, [all, me.id, since, now, days])

  if (data.events === 0) {
    return (
      <div className={styles.stack}>
        <Vacio>Nada quedó registrado en tu presencia en estos {days} días. Calibrar una pieza, publicar o que alguien guarde tu trabajo la mueve.</Vacio>
      </div>
    )
  }

  const top = data.kinds[0]
  return (
    <div className={styles.stack}>
      <p className={styles.lead}>
        En {days} días quedaron {plural(data.events, 'gesto registrado', 'gestos registrados')} en tu presencia.{' '}
        {top && top.share > 50 ? <>La mayor parte vino {P_MOSTLY[top.k]}.</> : <>Ningún gesto domina esta ventana.</>}
      </p>

      <section className={styles.block} aria-labelledby="rp-origen">
        <h3 id="rp-origen" className={styles.blockTitle}>
          De qué estuvo hecha
        </h3>
        <Shares what="Gesto" label="Composición de tu presencia en la ventana">
          {data.kinds.map((r, i) => (
            <ShareRow key={r.k} label={P_LABEL[r.k]} count={r.n} share={r.share} index={i} />
          ))}
        </Shares>
      </section>

      <section className={styles.block} aria-labelledby="rp-dias">
        <h3 id="rp-dias" className={styles.blockTitle}>
          Día a día
        </h3>
        <Sparkline values={data.series} label={`Movimiento de tu presencia por día en los últimos ${days} días; sin escala numérica`} />
        <div className={styles.axis}>
          <span>{fmt.short(new Date(data.first).toISOString())}</span>
          <span>
            Hubo movimiento {data.activeDays} de {days} días
          </span>
          <span>hoy</span>
        </div>
      </section>
    </div>
  )
}

// ── OBRA ────────────────────────────────────────────────────────────────────

interface PieceReading {
  item: ContentItem
  n: Record<RKind, number>
  /** Percent of what this piece received in the window, per gesture. */
  share: Record<RKind, number>
  events: number
}

function Obra({ now, pieces, days }: { now: Date; pieces: ContentItem[]; days: number }) {
  const reception = useReception(days)
  const [showQuiet, setShowQuiet] = useState(false)

  const data = useMemo(() => {
    const got = reception.state === 'listo' ? reception.data : null
    const byId = new Map((got?.items ?? []).map((r) => [r.id, r.kinds]))
    const readings: PieceReading[] = pieces.map((p) => {
      const n: Record<RKind, number> = { click: 0, open: 0, save: 0, comment: 0 }
      const share: Record<RKind, number> = { click: 0, open: 0, save: 0, comment: 0 }
      for (const k of byId.get(p.id) ?? []) {
        if (!isReader(k.kind)) continue
        n[k.kind] = k.events
        share[k.kind] = k.share ?? 0
      }
      return { item: p, n, share, events: R_KINDS.reduce((s, k) => s + n[k], 0) }
    })
    // Publication order, never performance order.
    const met = readings.filter((r) => r.events > 0)
    const quiet = readings.filter((r) => r.events === 0)
    const totals = R_KINDS.map((k) => {
      const t = got?.totals.find((x) => x.kind === k)
      return { k, n: t?.events ?? 0, share: t?.share ?? 0 }
    }).sort((a, b) => b.share - a.share || R_KINDS.indexOf(a.k) - R_KINDS.indexOf(b.k))
    return { met, quiet, totals, events: met.reduce((s, r) => s + r.events, 0) }
  }, [reception, pieces])

  if (!pieces.length) {
    return (
      <div className={styles.stack}>
        <Vacio>Aún no publicas. Cuando lo hagas, aquí verás de qué estuvo hecho el encuentro con cada pieza.</Vacio>
      </div>
    )
  }

  if (reception.state !== 'listo') {
    return (
      <div className={styles.stack}>
        <Vacio>
          {reception.state === 'leyendo'
            ? `Leyendo cómo se recibieron tus ${plural(pieces.length, 'pieza', 'piezas')} en estos ${days} días…`
            : 'No pudimos leer la recepción de tu obra en este momento. Tus piezas siguen en el campo; vuelve a intentarlo en un rato.'}
        </Vacio>
      </div>
    )
  }

  const top = data.totals[0]
  return (
    <div className={styles.stack}>
      {data.events === 0 ? (
        <Vacio>
          En estos {days} días no quedó registrado ningún encuentro con tus {plural(pieces.length, 'pieza', 'piezas')}. Su vida sigue en el campo; aquí solo cuenta lo anotado.
        </Vacio>
      ) : (
        <>
          <p className={styles.lead}>
            {plural(data.met.length, 'pieza tuya', 'piezas tuyas')} {data.met.length === 1 ? 'encontró' : 'encontraron'} lectores en {days} días.{' '}
            {top && top.share > 50 ? <>La mayor parte de lo que recibieron vino de {R_MANY[top.k]}.</> : <>Ninguna forma de encuentro domina esta ventana.</>}
          </p>
          <section className={styles.block} aria-labelledby="ro-totales">
            <h3 id="ro-totales" className={styles.blockTitle}>
              Cómo te encontraron
            </h3>
            <Shares what="Encuentro" label="Formas de encuentro con tus piezas en la ventana">
              {data.totals.map((r, i) => (
                <ShareRow key={r.k} label={R_LABEL[r.k]} count={r.n} share={r.share} index={i} />
              ))}
            </Shares>
          </section>
          <section className={styles.block} aria-labelledby="ro-piezas">
            <h3 id="ro-piezas" className={styles.blockTitle}>
              Pieza por pieza
            </h3>
            <ul className={styles.obras}>
              {data.met.map((r, i) => (
                <ObraRow key={r.item.id} r={r} now={now} index={i} />
              ))}
            </ul>
          </section>
        </>
      )}

      {data.quiet.length ? (
        <section className={styles.quiet} aria-label="Piezas sin encuentros registrados">
          <div className={styles.quietHead}>
            <p>
              {plural(data.quiet.length, 'pieza', 'piezas')} sin encuentros registrados en esta ventana.
            </p>
            <Accion onClick={() => setShowQuiet((s) => !s)}>{showQuiet ? 'Ocultar' : 'Ver cuáles'}</Accion>
          </div>
          {showQuiet ? (
            <ul className={styles.quietList}>
              {data.quiet.map((r) => (
                <li key={r.item.id}>
                  <FormatGlyph type={r.item.type} size={12} />
                  <span className={styles.quietTitle}>{r.item.title}</span>
                  <span className={styles.hl}>HL · {hlBracket(currentHp(r.item, now))}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

function ObraRow({ r, now, index }: { r: PieceReading; now: Date; index: number }) {
  const { item } = r
  const e = pieceEnergy(item)
  const hl = currentHp(item, now)
  const shares = R_KINDS.map((k) => ({ k, n: r.n[k], share: r.share[k] }))
  return (
    <li className={styles.obra} style={{ '--e': energyHex(e.mid), '--band': bandGradient(e.min, e.max), ['--i' as string]: index } as React.CSSProperties}>
      <span className={styles.thumb}>
        {item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="64px" className={styles.thumbImg} /> : <span className={styles.thumbPlate} style={{ background: bandGradient(e.min, e.max, '160deg') }} />}
        <span className={styles.thumbLine} />
      </span>
      <div className={styles.obraBody}>
        <div className={styles.obraHead}>
          <span className={styles.obraTitle} style={{ fontVariationSettings: energyVariation(e.mid) }}>
            {item.title}
          </span>
          <span className={styles.hl} title="Solo tú ves la vida de tus piezas">
            HL · {hlBracket(hl)}
          </span>
        </div>
        <p className={styles.obraMeta}>
          <FormatGlyph type={item.type} size={11} /> {FORMAT_LABEL[item.type]} · {fmt.short(item.publishedAt)} · {bandCode(e.min, e.max)}
          {item.harvestedAt ? ' · cosechada' : ''}
        </p>
        <div className={styles.stackBar} role="img" aria-label={shares.filter((s) => s.n > 0).map((s) => `${s.n} ${s.n === 1 ? R_ONE[s.k] : R_MANY[s.k]}, ${Math.round(s.share)} %`).join('; ')}>
          {shares.map((s) =>
            s.share > 0 ? <span key={s.k} data-k={s.k} style={{ width: `${s.share}%` }} /> : null,
          )}
        </div>
        <p className={styles.legend} aria-hidden="true">
          {shares.map((s) => (
            <span key={s.k} data-k={s.k} data-zero={s.n === 0 || undefined}>
              <i />
              {s.n} {s.n === 1 ? R_ONE[s.k] : R_MANY[s.k]}
              {s.share > 0 ? <b>{s.share < 1 ? '<1' : Math.round(s.share)} %</b> : null}
            </span>
          ))}
        </p>
      </div>
    </li>
  )
}
