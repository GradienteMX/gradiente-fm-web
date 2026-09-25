'use client'

/**
 * CONTENIDO — every piece with its HL exposed. One row per piece, one ficha
 * per row, one audited lever per ficha. Franjas are not here: they never
 * enter the mosaic and HL means nothing to them (see FRANJAS).
 *
 * Filters live in the URL (shareable, survive Back from «Ver en público»).
 * Δ is the ledger's net for the piece inside the window; «caída» is decay
 * over the same window — exact on the known trajectory, a floor before it.
 */

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { ContentType, User } from '@/lib/types'
import { currentHp } from '@/lib/curation'
import { hlBracket } from '@/lib/dashboard/hl'
import { bandLabel, effectiveBand } from '@/lib/vibe'
import { useItems, useWorld } from '@/lib/store/world'
import { useClock } from './clock'
import { FormatGlyph, FORMAT_LABEL, FORMAT_PLURAL, Mark } from '@/components/kit/Glyph'
import { Segmented } from '@/components/kit/Field'
import { Chip } from '@/components/kit/Bits'
import { Button } from '@/components/kit/Button'
import {
  buildTraj,
  CONTENT_TYPES,
  DAY,
  dayBounds,
  decayBetween,
  feedModel,
  HOUR,
  int,
  ledgerByItem,
  matches,
  num,
  signed,
  trajectoryPoints,
  WHERE_LABEL,
  type FeedWhere,
} from './data'
import { resolveDays, WINDOWS } from './tabs'
import { useQuery } from './query'
import { Dossier } from './Dossier'
import { BandLine, Empty, Note, Pane, Spark, Thumb, cx, inputClass, mutedClass, numClass, selectClass, tableClass, tableWrapClass, tagClass } from './kit'
import s from './Contenido.module.css'

const PAGE = 30

const ORDENES = [
  { value: 'hl', label: 'HL actual' },
  { value: 'reciente', label: 'Más reciente' },
  { value: 'delta', label: 'Δ HL en la ventana' },
  { value: 'caida', label: 'Mayor caída' },
] as const
type Orden = (typeof ORDENES)[number]['value']

const ESTADOS = ['todas', 'mosaico', 'portada', 'pulso', 'archivo'] as const
type Estado = (typeof ESTADOS)[number]
const ESTADO_LABEL: Record<Estado, string> = { todas: 'Todas', mosaico: 'Mosaico', portada: 'Portada', pulso: 'Pulso', archivo: 'Archivo' }

const COLS = 10

export function Contenido({ me }: { me: User }) {
  const { get, set } = useQuery()
  const days = resolveDays(get('dias'))
  const rawTipo = get('tipo')
  const tipo = rawTipo && (CONTENT_TYPES as string[]).includes(rawTipo) ? (rawTipo as ContentType) : null
  const rawEstado = get('estado')
  const estado: Estado = rawEstado && (ESTADOS as readonly string[]).includes(rawEstado) ? (rawEstado as Estado) : 'todas'
  const rawOrden = get('orden')
  const orden: Orden = ORDENES.some((o) => o.value === rawOrden) ? (rawOrden as Orden) : 'hl'
  const qUrl = get('q') ?? ''
  const pagina = Math.max(1, Math.floor(Number(get('pagina')) || 1))
  const ficha = get('ficha')

  // The search box types locally and lands in the URL after a pause.
  const [qInput, setQInput] = useState(qUrl)
  const qSent = useRef(qUrl)
  useEffect(() => {
    if (qUrl === qSent.current) return
    qSent.current = qUrl
    setQInput(qUrl)
  }, [qUrl])
  useEffect(() => {
    const next = qInput.trim()
    if (next === qSent.current) return
    const t = window.setTimeout(() => {
      qSent.current = next
      set({ q: next || null, pagina: null })
    }, 220)
    return () => window.clearTimeout(t)
  }, [qInput, set])

  const { now: nowMs, tick: minute } = useClock()
  const items = useItems()
  const ledger = useWorld((st) => st.world.ledger)
  const byItem = useMemo(() => ledgerByItem(ledger), [ledger])
  const feed = useMemo(() => feedModel(items, new Date(minute)), [items, minute])
  const from = useMemo(() => dayBounds(days, minute)[0], [days, minute])

  const base = useMemo(() => {
    const at = new Date(minute)
    return items
      .filter((i) => i.type !== 'franja')
      .map((item) => {
        const rows = byItem.get(item.id) ?? []
        const tr = buildTraj(item, rows)
        let delta = 0
        for (const r of rows) if (Date.parse(r.at) > from) delta += r.weight
        return {
          item,
          rows,
          tr,
          hl: currentHp(item, at),
          delta,
          touched: rows.some((r) => Date.parse(r.at) > from),
          caida: decayBetween(item, tr, from, minute),
          where: (feed.where.get(item.id) ?? 'archivo') as FeedWhere,
        }
      })
  }, [items, byItem, from, minute, feed])

  const q = qUrl
  const scoped = useMemo(
    () =>
      base.filter(
        (r) =>
          (estado === 'todas' || r.where === estado) &&
          (!q || matches(r.item.title, q) || matches(r.item.slug, q) || matches(r.item.venue, q) || matches(r.item.artists?.join(' '), q) || matches(r.item.author, q)),
      ),
    [base, estado, q],
  )
  const typeCounts = useMemo(() => {
    const m = new Map<ContentType, number>()
    for (const r of scoped) m.set(r.item.type, (m.get(r.item.type) ?? 0) + 1)
    return m
  }, [scoped])
  const sorted = useMemo(() => {
    const list = tipo ? scoped.filter((r) => r.item.type === tipo) : [...scoped]
    const by = {
      hl: (a: (typeof list)[number], b: (typeof list)[number]) => b.hl - a.hl,
      reciente: (a: (typeof list)[number], b: (typeof list)[number]) => Date.parse(b.item.publishedAt) - Date.parse(a.item.publishedAt),
      delta: (a: (typeof list)[number], b: (typeof list)[number]) => b.delta - a.delta || b.hl - a.hl,
      caida: (a: (typeof list)[number], b: (typeof list)[number]) => b.caida - a.caida,
    }[orden]
    return list.sort(by)
  }, [scoped, tipo, orden])

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE))
  const page = Math.min(pagina, pages)
  const rows = sorted.slice((page - 1) * PAGE, page * PAGE)

  // A deep-linked ficha lands on the page that holds it.
  useEffect(() => {
    if (!ficha) return
    const i = sorted.findIndex((r) => r.item.id === ficha)
    if (i < 0) return
    const p = Math.floor(i / PAGE) + 1
    if (p !== page) set({ pagina: p === 1 ? null : p })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ficha])

  const openRef = useRef<HTMLTableRowElement>(null)
  useEffect(() => {
    if (!ficha) return
    const t = window.setTimeout(() => openRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60)
    return () => window.clearTimeout(t)
  }, [ficha])

  const spark = (r: (typeof rows)[number]) => trajectoryPoints(r.item, r.tr, minute - 7 * DAY, minute, 6 * HOUR)

  const filtersOn = Boolean(tipo || estado !== 'todas' || q || orden !== 'hl')
  const summary = [tipo ? FORMAT_PLURAL[tipo] : null, estado !== 'todas' ? ESTADO_LABEL[estado] : null, q ? `«${q}»` : null].filter(Boolean).join(' · ')
  const ledgerEmpty = ledger.length === 0

  return (
    <div className={s.contenido}>
      <section className={s.filters} aria-label="Filtros del corpus">
        <div className={s.formats} role="group" aria-label="Formato">
          <Chip on={!tipo} onClick={() => set({ tipo: null, pagina: null })}>
            Todos <span className={s.chipN}>{int(scoped.length)}</span>
          </Chip>
          {CONTENT_TYPES.map((t) => (
            <Chip key={t} on={tipo === t} onClick={() => set({ tipo: tipo === t ? null : t, pagina: null })}>
              <FormatGlyph type={t} size={13} />
              {FORMAT_PLURAL[t]}
              <span className={s.chipN}>{int(typeCounts.get(t) ?? 0)}</span>
            </Chip>
          ))}
        </div>
        <div className={s.row2}>
          <div className={s.group}>
            <span className={s.groupLabel}>Estado</span>
            <Segmented
              label="Estado en el campo"
              value={estado}
              onChange={(v) => set({ estado: v === 'todas' ? null : v, pagina: null })}
              options={ESTADOS.map((e) => ({ value: e, label: ESTADO_LABEL[e] }))}
            />
          </div>
          <label className={s.group}>
            <span className={s.groupLabel}>Orden</span>
            <select className={cx(selectClass, s.select)} value={orden} onChange={(e) => set({ orden: e.target.value === 'hl' ? null : e.target.value, pagina: null })}>
              {ORDENES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <div className={s.group}>
            <span className={s.groupLabel}>Ventana</span>
            <Segmented
              label="Ventana de Δ y caída"
              value={String(days)}
              onChange={(v) => set({ dias: Number(v) === 30 ? null : v })}
              options={WINDOWS.map((w) => ({ value: String(w), label: `${w} d` }))}
            />
          </div>
          <label className={cx(s.group, s.search)}>
            <span className={s.groupLabel}>Buscar</span>
            <span className={s.searchBox}>
              <Mark name="search" size={14} />
              <input className={cx(inputClass, s.searchInput)} type="search" value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Título, slug, venue, artista…" />
            </span>
          </label>
          {filtersOn ? (
            <Button
              variant="quiet"
              size="sm"
              onClick={() => {
                setQInput('')
                qSent.current = ''
                set({ tipo: null, estado: null, q: null, orden: null, pagina: null })
              }}
            >
              Limpiar
            </Button>
          ) : null}
        </div>
      </section>

      <Pane
        n="01"
        title="Corpus"
        note={sorted.length ? `${(page - 1) * PAGE + 1}–${(page - 1) * PAGE + rows.length} de ${int(sorted.length)}${summary ? ` · ${summary}` : ''} · ventana ${days} d` : `sin resultados · ventana ${days} d`}
        flush
        actions={
          pages > 1 ? (
            <Pager page={page} pages={pages} onPage={(p) => set({ pagina: p === 1 ? null : p, ficha: null })} />
          ) : null
        }
      >
        {rows.length === 0 ? (
          <Empty>
            {summary ? `Ninguna pieza pasa el filtro: ${summary}.` : 'No hay piezas en el mundo.'}
          </Empty>
        ) : (
          <div className={tableWrapClass}>
            <table className={cx(tableClass, s.table)}>
              <caption className="sr-only">
                Corpus de piezas con su HL, ordenado por {ORDENES.find((o) => o.value === orden)?.label}. Página {page} de {pages}.
              </caption>
              <thead>
                <tr>
                  <th scope="col" className={numClass}>
                    #
                  </th>
                  <th scope="col">
                    <span className="sr-only">Arte</span>
                  </th>
                  <th scope="col">Pieza</th>
                  <th scope="col">Formato</th>
                  <th scope="col" className={numClass}>
                    HL
                  </th>
                  <th scope="col" className={numClass}>
                    Δ {days} d
                  </th>
                  <th scope="col" className={numClass} title="Decaimiento en la ventana (estimado)">
                    Caída {days} d
                  </th>
                  <th scope="col" className={numClass}>
                    Decae
                  </th>
                  <th scope="col">7 días</th>
                  <th scope="col">
                    <span className="sr-only">Ficha</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const it = r.item
                  const open = ficha === it.id
                  const band = effectiveBand(it)
                  const mult = it.hpDecayMultiplier ?? 1
                  const toggle = () => set({ ficha: open ? null : it.id })
                  return (
                    <Fragment key={it.id}>
                      <tr className={s.row} data-open={open || undefined} onClick={toggle} ref={open ? openRef : undefined}>
                        <td className={cx(numClass, mutedClass, s.rank)}>{(page - 1) * PAGE + i + 1}</td>
                        <td className={s.thumbCell}>
                          <Thumb item={it} size={40} />
                        </td>
                        <th scope="row" className={s.titleCell}>
                          <button
                            type="button"
                            className={s.titleBtn}
                            aria-expanded={open}
                            aria-controls={`ficha-${it.id}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              toggle()
                            }}
                          >
                            {it.title}
                          </button>
                          <span className={s.sub}>
                            <BandLine item={it} width={28} />
                            <span>{bandLabel(band.min, band.max)}</span>
                            <span className={s.where} data-where={r.where}>
                              {WHERE_LABEL[r.where]}
                            </span>
                            {it.editorial ? <span className={tagClass}>Editorial</span> : null}
                            {it.harvestedAt ? <span className={tagClass}>Cosechada</span> : null}
                            {r.rows.some((x) => x.kind === 'admin_adjust') ? <span className={tagClass} data-dashed>Ajustada</span> : null}
                          </span>
                        </th>
                        <td>
                          <span className={s.format}>
                            <FormatGlyph type={it.type} size={14} />
                            {FORMAT_LABEL[it.type]}
                          </span>
                        </td>
                        <td className={numClass}>
                          <span className={s.hl}>{num(r.hl, 1)}</span>
                          <span className={s.bracket}>{hlBracket(r.hl)}</span>
                        </td>
                        <td className={cx(numClass, !r.touched && mutedClass)}>{r.touched ? signed(r.delta, 1) : '—'}</td>
                        <td className={cx(numClass, mutedClass)}>{r.caida > 0.05 ? `−${num(r.caida, 1)}` : '—'}</td>
                        <td className={cx(numClass, mult === 1 && mutedClass)}>×{num(mult, 1)}</td>
                        <td className={s.sparkCell}>
                          <Spark points={spark(r)} from={minute - 7 * DAY} to={minute} label={`Trayectoria de HL de ${it.title}, últimos 7 días`} />
                        </td>
                        <td className={s.chevCell}>
                          <span className={s.chev} data-open={open || undefined} aria-hidden="true">
                            <Mark name="plus" size={14} />
                          </span>
                        </td>
                      </tr>
                      {open ? (
                        <tr className={s.dossierRow}>
                          <td colSpan={COLS} id={`ficha-${it.id}`}>
                            <Dossier
                              item={it}
                              tr={r.tr}
                              rows={r.rows}
                              me={me}
                              days={days}
                              from={from}
                              nowMs={nowMs}
                              feed={feed}
                              onDeleted={() => set({ ficha: null })}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 ? (
          <div className={s.pagerFoot}>
            <Pager page={page} pages={pages} onPage={(p) => set({ pagina: p === 1 ? null : p, ficha: null })} />
          </div>
        ) : null}
      </Pane>

      <Note>
        Δ es HL aplicada (ya ponderada por la novedad de cada lector), no un conteo: los conteos exactos están en la ficha. La caída es
        decaimiento estimado en la ventana. La trayectoria de 7 días empieza donde empieza el registro de cada pieza — nunca antes.
        {ledgerEmpty ? ' El registro de HL no tiene filas en esta ventana: por eso Δ muestra guiones.' : ''}
      </Note>
    </div>
  )
}

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  return (
    <nav className={s.pager} aria-label="Páginas del corpus">
      <button type="button" className={s.pageBtn} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Página anterior">
        ←
      </button>
      <span className={s.pageText}>
        {page} / {pages}
      </span>
      <button type="button" className={s.pageBtn} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Página siguiente">
        →
      </button>
    </nav>
  )
}
