'use client'

/**
 * RESUMEN — the overview. Five figures, the flow of life, the work waiting,
 * what the interactions were made of, and the state of the record itself.
 *
 * Three honesty rules, kept on the surface next to the numbers:
 *   1. The ledger holds the server's hp_events of the last 180 days (decay
 *      rows excluded), plus what this session did on top. Every piece
 *      arrives with a snapshot (HL + anchor), not its whole history.
 *   2. Decay is never recorded — it is lazy math. The DECAIMIENTO strip is an
 *      estimate: exact where a piece's trajectory is known, a lower bound
 *      (the untouched spawn curve) before that. It is hatched to say so.
 *   3. Counts come from rows, HL from applied weights. Novelty (applied ÷
 *      base) is private everywhere else and appears only in this table.
 */

import { useMemo } from 'react'
import { currentHp } from '@/lib/curation'
import { isUpcoming } from '@/lib/logic/time'
import { useItems, useWorld } from '@/lib/store/world'
import { useClock } from './clock'
import { KIND_WEIGHTS } from '@/lib/store/world-core'
import { Segmented } from '@/components/kit/Field'
import { Button } from '@/components/kit/Button'
import { Mark } from '@/components/kit/Glyph'
import {
  buildTraj,
  DAY,
  dayBounds,
  dayLabel,
  decaySeries,
  feedModel,
  HOUR,
  int,
  kindTable,
  KIND_LABEL,
  ledgerByItem,
  num,
  perDay,
  presenceIn,
  rowsWithin,
  signed,
  stamp,
  type Traj,
} from './data'
import { resolveDays, WINDOWS } from './tabs'
import { centralHref, useQuery } from './query'
import { Flujo } from './Flujo'
import { Empty, Note, Pane, Stat, StatStrip, cx, numClass, tableClass, tableWrapClass, mutedClass } from './kit'
import s from './Resumen.module.css'

const GESTURE_MARK = { click: 'dot', open: 'expand', save: 'save', comment: 'comments' } as const

export function Resumen() {
  const { get, set } = useQuery()
  const days = resolveDays(get('dias'))
  const { now: nowMs, tick: minute } = useClock()
  const items = useItems()
  const ledger = useWorld((st) => st.world.ledger)
  const presence = useWorld((st) => st.world.presence)
  const reports = useWorld((st) => st.world.reports)
  const waitlist = useWorld((st) => st.world.waitlist)
  const seedNow = useWorld((st) => st.world.seedNow)
  const logLen = useWorld((st) => st.log.length)
  const people = useWorld((st) => Object.keys(st.world.users).length)

  const content = useMemo(() => items.filter((i) => i.type !== 'franja'), [items])
  const byItem = useMemo(() => ledgerByItem(ledger), [ledger])
  const trajs = useMemo(() => {
    const m = new Map<string, Traj>()
    for (const it of content) m.set(it.id, buildTraj(it, byItem.get(it.id)))
    return m
  }, [content, byItem])
  const bounds = useMemo(() => dayBounds(days, minute), [days, minute])
  const from = bounds[0]
  const decay = useMemo(() => decaySeries(content, trajs, bounds), [content, trajs, bounds])
  const inWin = useMemo(() => rowsWithin(ledger, from, minute), [ledger, from, minute])
  const neto = useMemo(() => perDay(inWin, bounds, (r) => r.weight), [inWin, bounds])
  const pres = useMemo(() => perDay(presence, bounds, (r) => r.weight), [presence, bounds])
  const kinds = useMemo(() => kindTable(inWin), [inWin])
  const feed = useMemo(() => feedModel(items, new Date(minute)), [items, minute])

  const field = useMemo(() => {
    let hl = 0
    const counts = { mosaico: 0, portada: 0, pulso: 0 }
    for (const it of content) {
      const w = feed.where.get(it.id)
      if (w === 'mosaico' || w === 'portada' || w === 'pulso') {
        counts[w]++
        hl += currentHp(it, new Date(nowMs))
      }
    }
    return { hl, counts, n: counts.mosaico + counts.portada + counts.pulso }
  }, [content, feed, nowMs])

  const delta = useMemo(() => {
    let readers = 0
    let adjust = 0
    let harvest = 0
    for (const r of inWin) {
      if (r.kind === 'admin_adjust') adjust += r.weight
      else if (r.kind === 'harvest') harvest += r.weight
      else readers += r.weight
    }
    return { total: readers + adjust + harvest, readers, adjust, harvest }
  }, [inWin])

  const presWin = useMemo(() => presenceIn(presence, from, minute), [presence, from, minute])
  const presRows = useMemo(() => rowsWithin(presence, from, minute).length, [presence, from, minute])
  const decayTotal = decay.exact.reduce((a, b) => a + b, 0) + decay.bound.reduce((a, b) => a + b, 0)

  // ATENCIÓN — each row a real count with a real destination; zero rows keep
  // their place (the queue's shape is information) but offer no button.
  const attention = useMemo(() => {
    const now = new Date(nowMs)
    const upcoming = content.filter((i) => i.type === 'evento' && isUpcoming(i, now))
    const soon = upcoming.filter((i) => {
      const t = i.date ? Date.parse(i.date) : NaN
      return t > nowMs && t < nowMs + 48 * HOUR
    }).length
    return [
      { key: 'rep', n: reports.filter((r) => r.status === 'abierto').length, label: 'Reportes abiertos', verb: 'Moderar', href: centralHref({ tab: 'moderacion' }), urgent: true },
      { key: 'esp', n: waitlist.filter((r) => r.status === 'espera').length, label: 'Personas en la lista de espera', verb: 'Revisar', href: centralHref({ tab: 'acceso', sub: 'espera' }) },
      { key: 'img', n: upcoming.filter((i) => !i.imageUrl).length, label: 'Eventos próximos sin imagen', verb: 'Completar', href: centralHref({ tab: 'eventos', filtro: 'sin-imagen' }) },
      { key: '48h', n: soon, label: 'Eventos que abren en 48 h', verb: 'Revisar', href: centralHref({ tab: 'eventos', filtro: '48h' }) },
      { key: 'logo', n: items.filter((i) => i.type === 'franja' && !i.imageUrl).length, label: 'Franjas sin logo', verb: 'Completar', href: centralHref({ tab: 'franjas', filtro: 'sin-logo' }) },
    ]
  }, [content, items, reports, waitlist, nowMs])

  const oldest = ledger.length ? ledger.reduce((m, r) => Math.min(m, Date.parse(r.at)), Infinity) : null

  return (
    <div className={s.resumen}>
      <div className={s.control}>
        <Segmented
          label="Ventana de análisis"
          value={String(days)}
          onChange={(v) => set({ dias: Number(v) === 30 ? null : v })}
          options={WINDOWS.map((w) => ({ value: String(w), label: `${w} d` }))}
        />
        <p className={s.range}>
          <span className={s.rangeDates}>
            {dayLabel(from)} → hoy
          </span>
          <span className={mutedClass}> · corte diario a las 00:00, hora local</span>
        </p>
      </div>

      <section aria-label="Cifras de la ventana" className={s.kpis}>
        <StatStrip>
          <Stat label="HL activo" value={num(field.hl)} sub={`en el campo · ${int(field.n)} piezas`} title="Suma de la HL decaída a este instante de todo lo que hoy está frente a alguien: portada, pulso y mosaico." />
          <Stat
            label={`Δ HL · ${days} d`}
            value={inWin.length ? signed(delta.total) : '0'}
            dim={!inWin.length}
            sub={
              inWin.length
                ? `${signed(delta.readers)} lectores · ${signed(delta.adjust)} ajustes · ${signed(delta.harvest)} cosechas`
                : 'Sin movimiento registrado'
            }
          />
          <Stat label={`Δ presencia · ${days} d`} value={presRows ? signed(presWin) : '0'} dim={!presRows} sub={presRows ? `creadores · ${int(presRows)} filas` : 'Ningún creador recibió nada'} />
          <Stat label={`Interacciones · ${days} d`} value={int(kinds.total.rows)} dim={!kinds.total.rows} sub="gestos de lectores (filas)" />
          <Stat
            label="Contenido activo"
            value={int(field.n)}
            sub={`mosaico ${field.counts.mosaico} · portada ${field.counts.portada} · pulso ${field.counts.pulso}`}
          />
        </StatStrip>
        <p className={s.legendLine}>
          <span>HL = vida de una pieza</span>
          <span aria-hidden="true">·</span>
          <span>presencia = lo que reciben las personas que crean</span>
          <span aria-hidden="true">·</span>
          <span>el corpus pierde ≈ {num(decayTotal / Math.max(1, (minute - from) / DAY))} HL al día por decaimiento (estimado)</span>
        </p>
      </section>

      <div className={s.split}>
        <Pane n="01" title="Flujo de vida" note={`${days} días · por día`}>
          <Flujo
            bounds={bounds}
            caption={`Flujo de vida por día, últimos ${days} días`}
            series={[
              { key: 'neto', label: 'HL neto · registro', values: neto, direction: 'both', empty: 'El registro no tiene movimiento en esta ventana' },
              { key: 'presencia', label: 'Presencia', values: pres, direction: 'up', empty: 'Nadie recibió presencia en esta ventana' },
              { key: 'decaimiento', label: 'Decaimiento', values: decay.exact, floor: decay.bound, direction: 'down', estimate: true },
            ]}
          />
          <div className={s.notes}>
            <Note>
              HL neto suma todo lo que el registro vio pasar: gestos de lectores, ajustes de admin y cosechas. El decaimiento
              nunca se registra — es matemática perezosa —, así que su franja es una estimación en dos partes: lo que el modelo
              calcula sobre la trayectoria conocida de cada pieza (liso) y, antes de que empiece esa trayectoria, la curva sin
              toques desde su nacimiento (rayado): un piso, no una medida.
            </Note>
            {!ledger.length ? (
              <Note>
                El registro no tiene filas: cada pieza trae su instantánea (HL y ancla), no su historia. Los gestos que el
                servidor anote — abrir, guardar, comentar, ajustar — aparecen aquí; se conservan 180 días.
              </Note>
            ) : null}
          </div>
        </Pane>

        <Pane n="02" title="Atención" note="trabajo en espera">
          <ul className={s.attention}>
            {attention.map((a) => (
              <li key={a.key} className={s.attRow} data-zero={a.n === 0 || undefined} data-urgent={(a.urgent && a.n > 0) || undefined}>
                <span className={s.attN}>{int(a.n)}</span>
                <span className={s.attLabel}>{a.label}</span>
                {a.n > 0 ? (
                  <Button size="sm" variant={a.urgent ? 'ink' : 'ghost'} href={a.href} iconRight={<Mark name="arrow" size={13} />}>
                    {a.verb}
                  </Button>
                ) : (
                  <span className={s.attClear}>al día</span>
                )}
              </li>
            ))}
          </ul>
        </Pane>
      </div>

      <div className={s.split}>
        <Pane n="03" title="Interacciones → HL" note={`${days} d · solo gestos de lectores`} flush>
          {kinds.total.rows ? (
            <div className={tableWrapClass}>
              <table className={tableClass}>
                <caption className="sr-only">Interacciones de lectores en la ventana, por gesto: filas, peso base, peso aplicado y novedad media</caption>
                <thead>
                  <tr>
                    <th scope="col">Gesto</th>
                    <th scope="col" className={numClass}>
                      Filas
                    </th>
                    <th scope="col" className={numClass}>
                      Peso base
                    </th>
                    <th scope="col" className={numClass}>
                      Σ base
                    </th>
                    <th scope="col" className={numClass}>
                      Σ aplicado
                    </th>
                    <th scope="col" className={numClass}>
                      Novedad
                    </th>
                    <th scope="col">Parte de la HL</th>
                  </tr>
                </thead>
                <tbody>
                  {kinds.readers.map((k) => {
                    const share = kinds.total.sumApplied > 0 ? k.sumApplied / kinds.total.sumApplied : 0
                    return (
                      <tr key={k.kind} data-zero={k.rows === 0 || undefined} className={s.kindRow}>
                        <th scope="row">
                          <span className={s.gesture}>
                            <Mark name={GESTURE_MARK[k.kind]} size={14} />
                            {KIND_LABEL[k.kind]}
                          </span>
                        </th>
                        <td className={numClass}>{int(k.rows)}</td>
                        <td className={cx(numClass, mutedClass)}>×{num(KIND_WEIGHTS[k.kind])}</td>
                        <td className={numClass}>{num(k.sumBase)}</td>
                        <td className={numClass}>{num(k.sumApplied, 2)}</td>
                        <td className={numClass}>{k.novelty === null ? '—' : `×${num(k.novelty, 2)}`}</td>
                        <td>
                          <span className={s.share}>
                            <span className={s.shareBar} style={{ width: `${Math.round(share * 100)}%` }} />
                            <span className={s.shareText}>{Math.round(share * 100)} %</span>
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Lectores</th>
                    <td className={numClass}>{int(kinds.total.rows)}</td>
                    <td />
                    <td className={numClass}>{num(kinds.total.sumBase)}</td>
                    <td className={numClass}>{num(kinds.total.sumApplied, 2)}</td>
                    <td className={numClass}>{kinds.total.novelty === null ? '—' : `×${num(kinds.total.novelty, 2)}`}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <Empty>Ningún lector tocó una pieza en esta ventana. Un cero aquí es un cero del registro, no del campo.</Empty>
          )}
          <div className={s.system}>
            <span className={s.sysKey}>Fuera de la leyenda de lectores</span>
            <span>
              Ajustes admin <b>{int(kinds.adjust.rows)}</b> · {signed(kinds.adjust.sum, 2)} HL
            </span>
            <span>
              Cosechas <b>{int(kinds.harvest.rows)}</b> · {signed(kinds.harvest.sum, 2)} HL
            </span>
          </div>
          <div className={s.paneNote}>
            <Note>
              La novedad (Σ aplicado ÷ Σ base) es el multiplicador privado ×0.6–1.5 que empuja más fuerte a quien sale de su caja
              de género, formato o energía. En ningún otro lugar se muestra. Los ajustes y las cosechas no son interacción: van
              aparte para que una inyección nunca se lea como alcance.
            </Note>
          </div>
        </Pane>

        <Pane n="04" title="Sistema" note="lo que esta página leyó del servidor">
          <dl className={s.sys}>
            <div>
              <dt>Filas en el registro de HL</dt>
              <dd>{int(ledger.length)}</dd>
            </div>
            <div>
              <dt>Fila más antigua</dt>
              <dd>{oldest === null ? '—' : stamp(oldest)}</dd>
            </div>
            <div>
              <dt>Filas de presencia</dt>
              <dd>{int(presence.length)}</dd>
            </div>
            <div>
              <dt>Acciones aún fuera de la instantánea</dt>
              <dd>{int(logLen)}</dd>
            </div>
            <div>
              <dt>Instantánea leída</dt>
              <dd>{stamp(seedNow)}</dd>
            </div>
            <div>
              <dt>Piezas · personas</dt>
              <dd>
                {int(content.length)} · {int(people)}
              </dd>
            </div>
          </dl>
          <Note>
            El campo es la instantánea del servidor (compartida, se relee cada 5 min) más tus filas privadas, leídas en cada carga. Los registros cubren 180
            días. Lo que hiciste en esta pestaña y el servidor aún no tiene se cuenta aparte, y se pierde al recargar.
          </Note>
        </Pane>
      </div>

      <section className={s.crear} aria-labelledby="crear-h">
        <h2 id="crear-h" className={s.crearTitle}>
          Crear
        </h2>
        <div className={s.crearActions}>
          <Button variant="ink" href="/taller/mesa?tipo=evento" icon={<Mark name="plus" size={14} />}>
            Nuevo evento
          </Button>
          <Button variant="ghost" href={centralHref({ tab: 'acceso', sub: 'invitaciones' })} icon={<Mark name="plus" size={14} />}>
            Invitación
          </Button>
          <Button variant="ghost" href={centralHref({ tab: 'franjas', franja: 'nueva' })} icon={<Mark name="plus" size={14} />}>
            Franja
          </Button>
          <Button variant="ghost" href={centralHref({ tab: 'acceso', sub: 'espera' })} iconRight={<Mark name="arrow" size={13} />}>
            Revisar espera
          </Button>
        </div>
      </section>
    </div>
  )
}
