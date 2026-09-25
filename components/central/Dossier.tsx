'use client'

/**
 * FICHA — one piece, opened under its row. Live HL and where the model puts
 * it; the known trajectory; exact counts read from their own records (never
 * derived from HL); every admin adjustment it has received, each revertible
 * only by another audited adjustment; the lever; portada; deletion.
 *
 * What it will never show: who touched the piece. The ledger has no reader
 * attribution by design, and a list of timestamped gestures at this scale
 * would name people. Interactions appear aggregated by kind only.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ContentItem, HpLedgerRow, User } from '@/lib/types'
import { currentHp, spawnHp } from '@/lib/curation'
import { hlBracket } from '@/lib/dashboard/hl'
import { bandLabel, effectiveBand, energyVariation } from '@/lib/vibe'
import { fitTitle } from '@/lib/typeset'
import { ago, fmt } from '@/lib/logic/time'
import { franjaAttributionPrefix } from '@/lib/franjaAttribution'
import { useDispatch, useWorld } from '@/lib/store/world'
import { useUI } from '@/lib/store/ui'
import { FormatGlyph, FORMAT_LABEL, Mark } from '@/components/kit/Glyph'
import { BandChip } from '@/components/kit/Bits'
import { Button } from '@/components/kit/Button'
import { HoldButton } from '@/components/kit/HoldButton'
import { crowdStats, KIND_WEIGHTS } from '@/lib/store/world-core'
import {
  DAY,
  dayLabel as dayLabelShort,
  floorPoints,
  HOUR,
  int,
  KIND_LABEL,
  num,
  READER_KINDS,
  rankGrid,
  signed,
  stamp,
  trajectoryPoints,
  WHERE_LABEL,
  type FeedModel,
  type Traj,
} from './data'
import { Palanca, type Prefill } from './Palanca'
import { ConfirmPhrase, Note, Spark, Stat, StatStrip, Thumb, cx, mutedClass, numClass, tableClass, tagClass } from './kit'
import s from './Dossier.module.css'

export function Dossier({
  item,
  tr,
  rows,
  me,
  days,
  from,
  nowMs,
  feed,
  onDeleted,
}: {
  item: ContentItem
  tr: Traj
  rows: HpLedgerRow[]
  me: User
  days: number
  from: number
  nowMs: number
  feed: FeedModel
  onDeleted: () => void
}) {
  const dispatch = useDispatch()
  const notify = useUI((st) => st.notify)
  const [prefill, setPrefill] = useState<Prefill | null>(null)
  const [deleting, setDeleting] = useState(false)
  const nonce = useRef(0)

  const creator = useWorld((st) => (item.createdById ? st.world.users[item.createdById] ?? null : null))
  const franja = useWorld((st) => (item.franjaId ? st.world.items[item.franjaId] ?? null : null))
  // Admins receive per-item save counts (a count, never who saved).
  const saves = useWorld((st) => st.world.saveCounts?.[item.id] ?? 0)
  const comments = useWorld((st) => {
    let n = 0
    let t = 0
    for (const c of Object.values(st.world.comments)) if (c.contentItemId === item.id) {
      if (c.deletion) t++
      else n++
    }
    return `${n}|${t}`
  })
  // The crowd arrives aggregated on the item; individual readings never leave the database.
  const readN = useWorld((st) => crowdStats(st.world, item.id).count)
  const reports = useWorld((st) => {
    let n = 0
    let o = 0
    for (const r of st.world.reports)
      if (r.targetType === 'item' && r.targetId === item.id) {
        n++
        if (r.status === 'abierto') o++
      }
    return `${n}|${o}`
  })
  const [commN, commT] = comments.split('|').map(Number)
  const [repN, repOpen] = reports.split('|').map(Number)

  const hl = currentHp(item, new Date(nowMs))
  const where = feed.where.get(item.id) ?? 'archivo'
  const minute = Math.floor(nowMs / 60_000) * 60_000
  const rankedNow = useMemo(() => (where === 'mosaico' ? rankGrid(feed.grid, new Date(minute)) : null), [where, feed.grid, minute])
  const mine = rankedNow?.find((r) => r.item.id === item.id) ?? null

  const band = effectiveBand(item)
  const mid = (band.min + band.max) / 2
  const anchorIso = item.hpLastUpdatedAt ?? item.publishedAt
  const mult = item.hpDecayMultiplier ?? 1

  // Trajectory over the window, at a resolution that keeps steps honest.
  const step = days <= 7 ? 2 * HOUR : days <= 30 ? 6 * HOUR : DAY / 2
  const traj = useMemo(() => trajectoryPoints(item, tr, from, nowMs, step), [item, tr, from, nowMs, step])
  const floor = useMemo(() => floorPoints(item, tr, from, nowMs, step), [item, tr, from, nowMs, step])

  const inWin = useMemo(() => rows.filter((r) => Date.parse(r.at) > from), [rows, from])
  const kinds = useMemo(() => {
    const m = new Map<string, { n: number; w: number }>()
    for (const r of inWin) {
      const a = m.get(r.kind) ?? { n: 0, w: 0 }
      a.n++
      a.w += r.weight
      m.set(r.kind, a)
    }
    return m
  }, [inWin])

  const adjustments = tr.jumps.filter((j) => j.kind === 'admin_adjust').reverse()

  const publicHref = `/?item=${encodeURIComponent(item.slug)}&inspeccion=1`
  const [w, setW] = useState(520)
  const trajBox = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = trajBox.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    setW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const knownLine =
    tr.known <= tr.birth
      ? 'Trayectoria completa desde que nació.'
      : tr.known > from
        ? `El registro conoce su trayectoria desde ${stamp(tr.known)}; antes, solo hay la instantánea de su HL.`
        : 'Trayectoria conocida en toda la ventana.'

  return (
    <div className={s.dossier}>
      <header className={s.head}>
        <Thumb item={item} size={104} />
        <div className={s.headText}>
          <div className={s.kicker}>
            <span className={s.format}>
              <FormatGlyph type={item.type} size={14} />
              {FORMAT_LABEL[item.type]}
            </span>
            <BandChip min={band.min} max={band.max} />
            <span className={mutedClass}>{band.source === 'comunidad' ? 'banda de la comunidad' : 'banda del autor'}</span>
          </div>
          <h3 className={s.title} style={{ fontVariationSettings: energyVariation(mid), fontSize: fitTitle(item.title, mid, 40, 20) }}>
            {item.title}
          </h3>
          <p className={s.meta}>
            {franja ? (
              <>
                <b>
                  {franjaAttributionPrefix(franja.franjaKind ?? 'colectivo')} · {franja.title}
                </b>
                {' · '}
              </>
            ) : null}
            {creator ? `@${creator.username}` : 'sin autor registrado'}
            {' · publicado '}
            {fmt.short(item.publishedAt)}
            {item.type === 'evento' && item.date ? ` · noche del ${fmt.full(item.date)}` : ''}
          </p>
          <div className={s.flags}>
            <span className={tagClass} data-strong={where !== 'archivo' || undefined}>
              {WHERE_LABEL[where]}
            </span>
            {item.editorial ? <span className={tagClass}>Editorial</span> : null}
            {item.elevated ? <span className={tagClass}>Destacado</span> : null}
            {item.harvestedAt ? <span className={tagClass}>Cosechada {fmt.short(item.harvestedAt)}</span> : null}
            {item.source?.startsWith('scraper') ? <span className={tagClass} data-dashed>{item.source.replace('scraper:', 'raspado · ')}</span> : null}
          </div>
        </div>
        <div className={s.headActions}>
          <Button variant="ghost" size="sm" href={publicHref} target="_blank" rel="noopener" iconRight={<Mark name="external" size={13} />}>
            Ver en público
          </Button>
          <span className={s.inspect}>Esta apertura no suma HL: inspeccionar no es leer.</span>
        </div>
      </header>

      <div className={s.stats}>
        <StatStrip>
          <Stat label="HL en vivo" value={num(hl, 2)} sub={hlBracket(hl)} title="HL decaída a este instante (se actualiza cada 30 s)." />
          <Stat
            label="Score en su tipo"
            value={mine ? num(mine.score, 2) : '—'}
            dim={!mine}
            sub={mine ? `rango ${rankedNow!.indexOf(mine) + 1} de ${rankedNow!.length} · ${mine.tier.toUpperCase()}` : WHERE_LABEL[where]}
          />
          <Stat label="Anclado en" value={fmt.short(anchorIso)} sub={`${fmt.time(anchorIso)} · ${ago(anchorIso, new Date(nowMs))}`} />
          <Stat label="Multiplicador" value={`×${num(mult, 1)}`} sub={mult !== 1 ? 'decae más rápido: cosechada' : 'decaimiento normal'} />
          <Stat label="Valor de nacimiento" value={num(spawnHp(item), 0)} sub={item.editorial ? 'editorial: nace con 50' : 'nace con 20'} />
        </StatStrip>
      </div>

      <div className={s.cols}>
        <div className={s.left}>
          <section className={s.block} aria-label="Trayectoria">
            <h4 className={s.blockTitle}>
              Trayectoria · {days} d
            </h4>
            <div ref={trajBox} className={s.trajBox}>
              <Spark points={traj} floor={floor} from={from} to={nowMs} width={w} height={96} big label={`Trayectoria de HL de ${item.title}, últimos ${days} días`} />
            </div>
            <div className={s.trajFoot}>
              <span>{dayLabelShort(from)}</span>
              <span className={s.trajKey}>
                <i className={s.keyLine} /> trayectoria conocida
                {floor.length ? (
                  <>
                    <i className={s.keyDash} /> piso sin toques
                  </>
                ) : null}
              </span>
              <span>hoy</span>
            </div>
            <p className={s.small}>{knownLine}</p>
          </section>

          <section className={s.block} aria-label="Interacciones en la ventana">
            <h4 className={s.blockTitle}>Interacciones · {days} d</h4>
            <table className={cx(tableClass, s.mini)}>
              <caption className="sr-only">Gestos de lectores sobre esta pieza en la ventana, sin atribución</caption>
              <thead>
                <tr>
                  <th scope="col">Gesto</th>
                  <th scope="col" className={numClass}>
                    Filas
                  </th>
                  <th scope="col" className={numClass}>
                    Base
                  </th>
                  <th scope="col" className={numClass}>
                    Aplicado
                  </th>
                </tr>
              </thead>
              <tbody>
                {READER_KINDS.map((k) => {
                  const a = kinds.get(k)
                  return (
                    <tr key={k} data-zero={!a || undefined}>
                      <th scope="row">{KIND_LABEL[k]}</th>
                      <td className={numClass}>{a ? int(a.n) : '0'}</td>
                      <td className={cx(numClass, mutedClass)}>×{num(KIND_WEIGHTS[k])}</td>
                      <td className={numClass}>{a ? signed(a.w, 2) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className={s.small}>
              Fuera de la leyenda: ajustes {int(kinds.get('admin_adjust')?.n ?? 0)} ({signed(kinds.get('admin_adjust')?.w ?? 0, 2)}) · cosechas{' '}
              {int(kinds.get('harvest')?.n ?? 0)} ({signed(kinds.get('harvest')?.w ?? 0, 2)}). Sin atribución, por diseño.
            </p>
          </section>

          <section className={s.block} aria-label="Conteos">
            <h4 className={s.blockTitle}>Conteos</h4>
            <dl className={s.counts}>
              <div>
                <dt>Guardados</dt>
                <dd>{int(saves)}</dd>
              </div>
              <div>
                <dt>Comentarios</dt>
                <dd>
                  {int(commN)}
                  {commT ? <span className={s.countSub}> +{commT} retirados</span> : null}
                </dd>
              </div>
              <div>
                <dt>Calibraciones</dt>
                <dd>
                  {int(readN)}
                  <span className={s.countSub}>{readN >= 5 ? ' manda la comunidad' : ` · faltan ${5 - readN} para la mediana`}</span>
                </dd>
              </div>
              <div>
                <dt>Reportes</dt>
                <dd>
                  {int(repN)}
                  {repOpen ? <span className={s.countSub}> · {repOpen} abiertos</span> : null}
                </dd>
              </div>
            </dl>
            <p className={s.small}>
              Conteos exactos, leídos de sus propios registros — no derivados de la HL. Bandas: {bandLabel(item.vibeMin, item.vibeMax)} (autor).
            </p>
          </section>

          <section className={s.block} aria-label="Ajustes admin">
            <h4 className={s.blockTitle}>Ajustes admin · {adjustments.length}</h4>
            {adjustments.length ? (
              <ul className={s.adjusts}>
                {adjustments.map((a, i) => {
                  const appliedDelta = a.post - a.pre
                  return (
                    <li key={`${a.t}-${i}`} className={s.adjust}>
                      <div className={s.adjustTop}>
                        <span className={s.adjustDelta} data-neg={appliedDelta < 0 || undefined}>
                          {signed(appliedDelta, 2)}
                        </span>
                        <span className={s.adjustMeta}>
                          {stamp(a.t)} · {num(a.pre, 2)} → {num(a.post, 2)}
                          {Math.abs(a.base - appliedDelta) > 0.005 ? ` · se pidió ${signed(a.base, 2)}, el piso en 0 recortó` : ''}
                        </span>
                        <button
                          type="button"
                          className={s.revert}
                          title="Carga el ajuste inverso en la palanca — no lo aplica"
                          onClick={() => {
                            nonce.current += 1
                            setPrefill({
                              delta: -appliedDelta,
                              note: `Reversión del ajuste del ${stamp(a.t)} («${a.note ?? ''}»)`,
                              nonce: nonce.current,
                            })
                          }}
                        >
                          Revertir
                        </button>
                      </div>
                      <p className={s.adjustNote}>«{a.note ?? '—'}»</p>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className={s.small}>Ningún ajuste en el registro. Todo lo que tiene esta pieza lo trajeron sus lectores (o su HL de nacimiento).</p>
            )}
          </section>

          <section className={cx(s.block, s.actions)} aria-label="Acciones">
            <h4 className={s.blockTitle}>Acciones</h4>
            <div className={s.actionRow}>
              <Button
                variant="ghost"
                size="sm"
                icon={<Mark name="pin" size={14} />}
                onClick={() => {
                  dispatch({ t: 'pin', itemId: item.id, on: !item.pinned, at: new Date().toISOString() })
                  notify(item.pinned ? `«${item.title}» sale de la portada` : `«${item.title}» fijada en portada`)
                }}
              >
                {item.pinned ? 'Quitar de portada' : 'Fijar en portada'}
              </Button>
              <span className={s.small}>La portada muestra todo lo fijado, lo más reciente primero. Es una palanca declarativa: no finge interacción.</span>
            </div>
            <div className={s.actionRow}>
              <Button variant="ghost" size="sm" href={`/taller/mesa?editar=${encodeURIComponent(item.id)}`} icon={<Mark name="arrow" size={13} />}>
                Editar en la mesa
              </Button>
              <span className={s.small}>Texto, taxonomía, energía y arte se corrigen donde se escriben. Conserva su HL.</span>
            </div>
            <div className={s.actionRow}>
              <HoldButton tone="danger" size="md" energy={7} holdingLabel="Sigue…" disabled={deleting} onConfirm={() => setDeleting(true)}>
                Borrar pieza
              </HoldButton>
              <span className={s.small}>Mantén, y luego escribe «BORRAR {item.id.toUpperCase()}» para confirmar.</span>
              {deleting ? (
                <ConfirmPhrase
                  phrase={`BORRAR ${item.id.toUpperCase()}`}
                  consequence={`«${item.title}» sale del campo, del mapa, de su sección y de toda lectura. Sus comentarios y guardados quedan sin pieza y su historial de HL queda huérfano. No se puede deshacer.`}
                  onCancel={() => setDeleting(false)}
                  onConfirm={() => {
                    dispatch({ t: 'item-delete', itemId: item.id, at: new Date().toISOString() })
                    notify(`«${item.title}» borrada`, { tone: 'error' })
                    onDeleted()
                  }}
                />
              ) : null}
            </div>
          </section>
        </div>

        <div className={s.right}>
          <Palanca item={item} hl={hl} grid={feed.grid} where={where} me={me} nowMs={nowMs} prefill={prefill} />
        </div>
      </div>
      <Note>
        Lo que ves aquí no sale de Central. En el campo, esta pieza solo tiene tamaño y posición; su autor ve su fuerza en palabras (
        {hlBracket(hl)}), nunca el número.
      </Note>
    </div>
  )
}
