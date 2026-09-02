'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { SmartImage } from '@/components/SmartImage'
import {
  Chip,
  EmptyLine,
  ErrorLine,
  ExpandableRow,
  FOCUS_RING,
  InkButton,
  KindBreakdown,
  MarginNote,
  Sheet,
  SheetTable,
  ShimmerLine,
  Sparkline,
  StatBlock,
  StatStrip,
  Td,
  useSingleOpen,
  type BreakdownRow,
} from '@/components/admin/kit'
import { HlLever, type HlAdjustResult } from '@/components/admin/HlLever'
import { categoryColorOnLight, typeCode, typeDisplayLabel } from '@/lib/dashboard/palette'
import { LEDGER_EPOCH } from '@/lib/hp/kinds'
import type {
  AdminItemDetail,
  AdminItemList,
  AdminItemRow,
  KindDelta,
} from '@/lib/data/adminItems'
import type { ContentType } from '@/lib/types'

// ── CONTENIDO — the cross-type surveillance surface ─────────────────────────
//
// Before this tab /admin could see exactly one content type: eventos. The
// other 151 items had no admin surface at all. This is the whole corpus with
// its HL exposed — one row per item, one dossier per row, one audited lever
// per dossier.
//
// THREE THINGS THIS TABLE REFUSES TO DO, because doing them is what makes a
// panel like this lie:
//
//   1. It never draws an empty stretch of window as "no engagement". The
//      item-side ledger only exists from LEDGER_EPOCH (migration 0049 — the
//      rollup used to DELETE every event it folded, and ~2,110 of them are
//      gone). When the window reaches back past that date the table says so
//      above itself, and the dossier says it again per item.
//   2. It never derives an event COUNT from an HL sum. hp_events.weight is the
//      nominal weight times a hidden per-caller novelty multiplier ∈ [0.6,1.5],
//      so weight/nominal is wrong by up to 50%. Counts come from base_weight
//      and print «—» when the record cannot supply them.
//   3. It never labels the DECAIMIENTO column as the corpus's decay. Decay is
//      recorded only for items that also received an event in the same rollup
//      tick — that is the exact complement of the gains in the same row, and
//      nothing more.
//
// FILTER STATE LIVES IN THE URL, not in this component: the list is a server
// read (listAdminItems ranks 601 rows through currentHp() in Node, which SQL
// cannot do), so every filter change is a router.replace and the server hands
// back a new `initial`. That also makes a filtered view shareable and
// survivable across back/forward, which a useState filter bar is not.

interface Filters {
  tipo: string
  estado: string
  q: string
  orden: string
}

const TIPOS: ContentType[] = [
  'evento',
  'mix',
  'noticia',
  'review',
  'editorial',
  'opinion',
  'articulo',
  'listicle',
  'franja',
]

const ESTADOS: { value: string; label: string }[] = [
  { value: 'all', label: 'TODOS' },
  { value: 'publicado', label: 'PUBLICADO' },
  { value: 'borrador', label: 'BORRADOR' },
]

const ORDENES: { value: string; label: string }[] = [
  { value: 'hp', label: 'HL ACTUAL' },
  { value: 'reciente', label: 'MÁS RECIENTE' },
  { value: 'delta', label: 'DELTA HL' },
  { value: 'caida', label: 'MAYOR CAÍDA' },
]

const HEAD = [
  '#',
  'ARTE',
  'TÍTULO',
  'TIPO',
  'HL ACTUAL',
  'FUERZA',
  'DELTA HL',
  'DECAIMIENTO',
  'TRAYECTORIA 7D',
  '',
] as const

const INPUT_CLS = `min-h-11 border border-ink bg-paper-raised px-3 py-2 font-mono text-d13 text-ink transition-colors placeholder:text-ink-faint focus:bg-white ${FOCUS_RING}`

type DetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; detail: AdminItemDetail }

export function ContenidoTab({
  initial,
  dias,
  filters,
}: {
  initial: AdminItemList
  dias: number
  filters: Filters
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [openId, toggleOpen] = useSingleOpen()
  const [details, setDetails] = useState<Record<string, DetailState>>({})
  const [prefill, setPrefill] = useState<
    { itemId: string; delta: number; reason: string; nonce: number } | null
  >(null)
  const nonce = useRef(0)

  const [qInput, setQInput] = useState(filters.q)
  // The value the URL is known to carry. Lets the box tell its own pushes
  // apart from a URL that moved underneath it (back/forward, a shared link),
  // so adopting the second never clobbers a half-typed query.
  const qUrl = useRef(filters.q)

  const pushFilters = useCallback(
    (next: Partial<Filters>) => {
      const merged = { ...filters, ...next }
      const params = new URLSearchParams()
      params.set('tab', 'contenido')
      // The window belongs to the page, not to this tab — carry it through or
      // every filter click silently resets RESUMEN's selection to 30 days.
      if (dias !== 30) params.set('dias', String(dias))
      if (merged.tipo !== 'all') params.set('tipo', merged.tipo)
      if (merged.estado !== 'all') params.set('estado', merged.estado)
      if (merged.orden !== 'hp') params.set('orden', merged.orden)
      if (merged.q.trim()) params.set('q', merged.q.trim())
      // Record what the URL is about to carry, so the search box's own
      // debounce does not then fire a second, identical replace for it.
      if (next.q !== undefined) qUrl.current = merged.q.trim()
      startTransition(() => router.replace(`/admin?${params.toString()}`, { scroll: false }))
    },
    [filters, dias, router],
  )

  useEffect(() => {
    if (filters.q === qUrl.current) return
    qUrl.current = filters.q
    setQInput(filters.q)
  }, [filters.q])

  // 250ms after the last keystroke — the same debounce shape as
  // AdminUsersEditor's user search, so there is one timing in the panel.
  useEffect(() => {
    const next = qInput.trim()
    if (next === qUrl.current) return
    const t = setTimeout(() => {
      qUrl.current = next
      pushFilters({ q: next })
    }, 250)
    return () => clearTimeout(t)
  }, [qInput, pushFilters])

  const loadDetail = useCallback(
    async (id: string) => {
      setDetails((d) => ({ ...d, [id]: { status: 'loading' } }))
      try {
        const res = await fetch(
          `/api/admin/items/${encodeURIComponent(id)}/stats?dias=${dias}`,
        )
        const body = await res.json()
        if (!res.ok) {
          setDetails((d) => ({
            ...d,
            [id]: { status: 'error', message: body?.error ?? `HTTP ${res.status}` },
          }))
          return
        }
        setDetails((d) => ({ ...d, [id]: { status: 'ready', detail: body as AdminItemDetail } }))
      } catch (e) {
        setDetails((d) => ({
          ...d,
          [id]: { status: 'error', message: e instanceof Error ? e.message : 'LA CONSULTA FALLÓ' },
        }))
      }
    },
    [dias],
  )

  // Dossiers are fetched on expand, not shipped with the list: 50 rows would
  // mean 50 ledger scans and 200 count queries for the one row an operator
  // actually opens.
  useEffect(() => {
    if (!openId || details[openId]) return
    void loadDetail(openId)
  }, [openId, details, loadDetail])

  // A dossier is scoped to `dias`; changing the window invalidates every one
  // of them rather than leaving a 30-day breakdown labelled as 90.
  useEffect(() => {
    setDetails({})
  }, [dias])

  const onApplied = useCallback(
    (id: string) => () => {
      // Re-read rather than patch: the RPC re-anchors hp_last_updated_at, so
      // every derived figure on the row (bracket, delta, sparkline) moves, and
      // a hand-patched cache would disagree with the next server render.
      void loadDetail(id)
      startTransition(() => router.refresh())
    },
    [loadDetail, router],
  )

  const rows = initial.rows
  const active = filterSummary(filters)

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        filters={filters}
        qInput={qInput}
        onQ={setQInput}
        onChange={pushFilters}
        busy={pending}
      />

      {!initial.window.ledgerCovers && (
        <MarginNote>
          LA VENTANA DE {dias} DÍAS EMPIEZA ANTES DEL {LEDGER_EPOCH}, EL DÍA EN QUE NACIÓ EL REGISTRO
          DE HL POR PIEZA. DELTA HL, DECAIMIENTO Y TRAYECTORIA SÓLO CUBREN DESDE ESA FECHA — UN
          TRAMO SIN MOVIMIENTO NO SIGNIFICA QUE NADIE INTERACTUÓ, SIGNIFICA QUE NO HAY REGISTRO.
        </MarginNote>
      )}

      <Sheet
        title="Corpus"
        note={`MOSTRANDO ${rows.length} DE ${initial.total}${
          initial.total > rows.length ? ' · TOPE 50 POR VISTA, AFINA LOS FILTROS' : ''
        } · VENTANA ${dias}D`}
        padded={false}
      >
        {pending && <ShimmerLine />}
        {rows.length === 0 ? (
          <EmptyLine>
            {active.length > 0
              ? `NINGÚN ÍTEM PASA EL FILTRO: ${active.join(' · ')}`
              : 'LA CONSULTA NO DEVOLVIÓ NINGUNA FILA'}
          </EmptyLine>
        ) : (
          <SheetTable head={HEAD}>
            {rows.map((row, i) => {
              const state = details[row.id]
              return (
                <ExpandableRow
                  key={row.id}
                  cols={HEAD.length}
                  open={openId === row.id}
                  onToggle={() => toggleOpen(row.id)}
                  label={`Ficha de ${row.title}`}
                  summary={<RowSummary row={row} index={i + 1} />}
                  detail={
                    state?.status === 'loading' || !state ? (
                      <ShimmerLine />
                    ) : state.status === 'error' ? (
                      <ErrorLine>NO SE PUDO LEER LA FICHA — {state.message.toUpperCase()}</ErrorLine>
                    ) : (
                      <Dossier
                        detail={state.detail}
                        dias={dias}
                        prefill={prefill?.itemId === row.id ? prefill : null}
                        onRevert={(delta, reason) => {
                          nonce.current += 1
                          setPrefill({ itemId: row.id, delta, reason, nonce: nonce.current })
                        }}
                        onApplied={onApplied(row.id)}
                      />
                    )
                  }
                />
              )
            })}
          </SheetTable>
        )}
      </Sheet>

      <MarginNote>
        DELTA HL ES HL PONDERADA, NO UN CONTEO: CADA EVENTO LLEVA UN MULTIPLICADOR DE NOVEDAD POR
        LECTOR, ASÍ QUE DIVIDIRLA ENTRE EL PESO NOMINAL NO DA EL NÚMERO DE INTERACCIONES. LOS
        CONTEOS EXACTOS ESTÁN EN LA FICHA. · DECAIMIENTO SÓLO SE REGISTRA PARA LAS PIEZAS QUE
        RECIBIERON UN EVENTO EN EL MISMO CICLO DE ROLLUP: ES EL COMPLEMENTO DE LO GANADO EN ESA
        MISMA FILA, NO EL DECAIMIENTO TOTAL DEL CORPUS.
      </MarginNote>
    </div>
  )
}

// ── Filter bar ──────────────────────────────────────────────────────────────

function FilterBar({
  filters,
  qInput,
  onQ,
  onChange,
  busy,
}: {
  filters: Filters
  qInput: string
  onQ: (v: string) => void
  onChange: (next: Partial<Filters>) => void
  busy: boolean
}) {
  return (
    <section className="flex flex-col gap-3 border border-ink bg-paper-raised p-4">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">TIPO</span>
        <div role="group" aria-label="Filtrar por tipo" className="flex flex-wrap gap-2">
          <TipoChip
            label="TODOS"
            code="··"
            on={filters.tipo === 'all'}
            onClick={() => onChange({ tipo: 'all' })}
          />
          {TIPOS.map((t) => (
            <TipoChip
              key={t}
              label={typeDisplayLabel(t)}
              code={typeCode(t)}
              color={categoryColorOnLight(t)}
              on={filters.tipo === t}
              onClick={() => onChange({ tipo: t })}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">ESTADO</span>
          <div role="group" aria-label="Filtrar por estado" className="flex items-stretch">
            {ESTADOS.map((e, i) => {
              const on = filters.estado === e.value
              return (
                <button
                  key={e.value}
                  type="button"
                  onClick={() => onChange({ estado: e.value })}
                  aria-pressed={on}
                  data-cue="latch"
                  className={`min-h-11 border border-ink px-3 font-mono text-d11 uppercase tracking-widest ${
                    i > 0 ? '-ml-px' : ''
                  } ${FOCUS_RING} ${
                    on ? 'bg-ink font-bold text-paper' : 'text-ink-soft hover:bg-ink hover:text-paper'
                  }`}
                >
                  {e.label}
                </button>
              )
            })}
          </div>
        </div>

        <label className="flex flex-col gap-2">
          <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">ORDEN</span>
          <select
            value={filters.orden}
            onChange={(e) => onChange({ orden: e.target.value })}
            className={INPUT_CLS}
          >
            {ORDENES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-[16rem] flex-1 flex-col gap-2">
          <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
            BUSCAR EN EL TÍTULO
          </span>
          <input
            type="search"
            value={qInput}
            onChange={(e) => onQ(e.target.value)}
            placeholder="FRAGMENTO DEL TÍTULO…"
            className={`${INPUT_CLS} w-full`}
          />
        </label>

        {(filters.tipo !== 'all' ||
          filters.estado !== 'all' ||
          filters.orden !== 'hp' ||
          filters.q.trim()) && (
          <InkButton
            onClick={() => {
              onQ('')
              onChange({ tipo: 'all', estado: 'all', orden: 'hp', q: '' })
            }}
            disabled={busy}
          >
            LIMPIAR
          </InkButton>
        )}
      </div>
    </section>
  )
}

function TipoChip({
  label,
  code,
  color,
  on,
  onClick,
}: {
  label: string
  code: string
  color?: string
  on: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      data-cue="latch"
      className={`inline-flex min-h-11 items-center gap-2 border border-ink px-3 font-mono text-d11 uppercase tracking-widest ${FOCUS_RING} ${
        on ? 'bg-ink font-bold text-paper' : 'text-ink-soft hover:bg-ink hover:text-paper'
      }`}
    >
      {color && (
        <span
          aria-hidden
          className="inline-block h-2 w-2 shrink-0 border border-current"
          style={{ backgroundColor: color }}
        />
      )}
      <span className={on ? 'text-paper/70' : 'text-ink-faint'}>{code}</span>
      {label}
    </button>
  )
}

// ── Row ─────────────────────────────────────────────────────────────────────

function RowSummary({ row, index }: { row: AdminItemRow; index: number }) {
  const flags: string[] = []
  if (!row.published) flags.push('BORRADOR')
  if (row.editorial) flags.push('EDITORIAL')
  if (row.elevated) flags.push('DESTACADO')
  if (row.pinned) flags.push('FIJADO')
  if (row.harvested) flags.push('COSECHADO')

  return (
    <>
      <Td>
        <span className="tabular-nums text-ink-faint">{index}</span>
      </Td>
      <Td>
        <Thumb src={row.imageUrl} type={row.type} title={row.title} size={40} />
      </Td>
      <Td mono={false}>
        <div className="flex max-w-[22rem] flex-col gap-1">
          <span className="font-grotesk text-d15 leading-snug text-ink">{row.title}</span>
          {flags.length > 0 && (
            <span className="flex flex-wrap gap-1">
              {flags.map((f) => (
                <Chip key={f}>{f}</Chip>
              ))}
            </span>
          )}
        </div>
      </Td>
      <Td>
        <Chip swatch={categoryColorOnLight(row.type)}>
          {typeCode(row.type)} {typeDisplayLabel(row.type)}
        </Chip>
      </Td>
      <Td>
        <span className="flex flex-col items-start gap-1">
          <span className="font-grotesk text-d15 font-bold tabular-nums text-ink">
            {row.hp.toFixed(1)}
          </span>
          {/* hp IS NULL — the item has never received a single event and this
              number is the spawn default. Printing it bare as though it were
              measured is precisely what this panel exists to stop. */}
          {row.hpIsSpawn && <Chip>SIN SEÑAL</Chip>}
        </span>
      </Td>
      <Td>
        <Chip>{row.bracket}</Chip>
      </Td>
      <Td right>
        <span
          className={`font-grotesk tabular-nums ${
            row.deltaHl > 0 ? 'text-hp' : 'text-ink-faint'
          }`}
        >
          {row.deltaHl > 0 ? '+' : ''}
          {row.deltaHl.toFixed(1)}
        </span>
      </Td>
      <Td right>
        {/* Decay rows always carry a negative amount, so a sum of exactly zero
            means no decay was RECORDED in this window — not that the item held
            its HL. «—» says the first; «0.0» would claim the second. */}
        {row.deltaDecay === 0 ? (
          <span className="text-ink-faint" title="Sin decaimiento registrado en la ventana">
            —
          </span>
        ) : (
          <span className="font-grotesk tabular-nums text-sys-red-paper">
            −{row.deltaDecay.toFixed(1)}
          </span>
        )}
      </Td>
      <Td right>
        <span className="inline-flex justify-end">
          <Sparkline
            values={row.spark}
            label={`Trayectoria de HL de ${row.title}, últimos 7 días`}
          />
        </span>
      </Td>
    </>
  )
}

/**
 * 40×40 in the row, 96×96 in the dossier. SmartImage rather than a raw <img>:
 * the optimizer path is what cut Supabase cached egress, and a bare tag on a
 * 50-row table re-opens exactly the problem that fix closed.
 */
function Thumb({
  src,
  type,
  title,
  size,
}: {
  src: string | null
  type: ContentType
  title: string
  size: number
}) {
  const url = src?.trim()
  return (
    <span
      className="relative block shrink-0 overflow-hidden border border-ink bg-paper"
      style={{ width: size, height: size }}
    >
      {url ? (
        <SmartImage src={url} alt="" sizes={`${size}px`} className="object-cover" />
      ) : (
        // No artwork: the type code, not a placeholder graphic. A grey square
        // with an icon would read as "image failed to load".
        <span
          className="flex h-full w-full items-center justify-center font-mono text-d11 uppercase tracking-widest text-ink-faint"
          title={`${title} — sin arte`}
        >
          {typeCode(type)}
        </span>
      )}
    </span>
  )
}

// ── Dossier ─────────────────────────────────────────────────────────────────

function Dossier({
  detail,
  dias,
  prefill,
  onRevert,
  onApplied,
}: {
  detail: AdminItemDetail
  dias: number
  prefill: { delta: number; reason: string; nonce: number } | null
  onRevert: (delta: number, reason: string) => void
  onApplied: (result: HlAdjustResult) => void
}) {
  // Client-only render path, so building this from Date.now() cannot desync
  // server and client HTML the way it would in the list above.
  const windowStart = new Date(Date.now() - (dias - 1) * 86_400_000).toISOString().slice(0, 10)
  const ledgerBlind = detail.ledgerStartsAt > windowStart

  const breakdown: BreakdownRow[] = detail.breakdown.map((k: KindDelta) => ({
    key: k.kind,
    label: k.label,
    code: k.code,
    color: k.color,
    weight: k.weight,
    count: k.count,
    nominal: k.nominal,
  }))

  const publicHref =
    detail.type === 'franja'
      ? `/f/${encodeURIComponent(detail.slug)}`
      : `/?item=${encodeURIComponent(detail.slug)}`

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start gap-4">
        <Thumb src={detail.imageUrl} type={detail.type} title={detail.title} size={96} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h3 className="font-syne text-d18 font-extrabold uppercase text-ink">{detail.title}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <Chip swatch={categoryColorOnLight(detail.type)}>
              {typeCode(detail.type)} {typeDisplayLabel(detail.type)}
            </Chip>
            {!detail.published && <Chip>BORRADOR</Chip>}
            {detail.editorial && <Chip>EDITORIAL</Chip>}
            {detail.elevated && <Chip>DESTACADO</Chip>}
            {detail.pinned && <Chip>FIJADO</Chip>}
            {detail.seed && <Chip>SEMILLA</Chip>}
          </div>
          {/* dl > div > dt+dd — the only grouping wrapper the spec allows
              inside a definition list; a <span> here is invalid markup. */}
          <dl className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-d11 uppercase tracking-widest text-ink-faint">
            <div>
              <dt className="inline">AUTOR </dt>
              <dd className="inline text-ink">
                {detail.creator ? `@${detail.creator.username}` : 'SIN AUTOR REGISTRADO'}
              </dd>
            </div>
            <div>
              <dt className="inline">FRANJA </dt>
              <dd className="inline text-ink">{detail.franjaTitle ?? 'NINGUNA'}</dd>
            </div>
            <div>
              <dt className="inline">PUBLICADO </dt>
              <dd className="inline text-ink">{fecha(detail.publishedAt)}</dd>
            </div>
            {detail.date && (
              <div>
                <dt className="inline">FECHA DEL EVENTO </dt>
                <dd className="inline text-ink">{fecha(detail.date)}</dd>
              </div>
            )}
          </dl>
          <div className="flex flex-col gap-1">
            <span>
              <InkButton href={publicHref} external>
                VER EN PÚBLICO
              </InkButton>
            </span>
            {/* Real, and the operator has to know it: OverlayRouter fires an
                'open' event on every ?item= resolution, so inspecting a piece
                from here adds HL to the piece being inspected. */}
            <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
              ABRIR LA FICHA PÚBLICA REGISTRA UNA APERTURA EN EL HISTORIAL DE ESTA PIEZA
            </span>
          </div>
        </div>
      </div>

      <StatStrip>
        <StatBlock
          label="HL EN VIVO"
          value={detail.hp.toFixed(2)}
          tone="hp"
          note={detail.hpIsSpawn ? 'VALOR DE NACIMIENTO — SIN SEÑAL' : undefined}
        />
        <StatBlock label="FUERZA" value={detail.bracket} />
        <StatBlock
          label="ANCLADO EN"
          value={detail.hpAnchoredAt ? fecha(detail.hpAnchoredAt) : '—'}
          note={detail.hpAnchoredAt ? undefined : 'NUNCA RE-ANCLADO'}
        />
        <StatBlock
          label="MULT. DE DECAIMIENTO"
          value={`${detail.decayMultiplier}×`}
          note={detail.decayMultiplier !== 1 ? 'COSECHADO' : undefined}
        />
        <StatBlock label="VALOR DE NACIMIENTO" value={detail.spawn.toFixed(1)} />
      </StatStrip>

      <Sheet title="Interacciones" note={`VENTANA ${dias}D`} padded={false}>
        <KindBreakdown rows={breakdown} />
        <p className="border-t border-ink/15 px-3 py-2 font-mono text-d11 uppercase tracking-widest text-ink-faint">
          DECAIMIENTO REGISTRADO EN LA VENTANA{' '}
          <span className="text-sys-red-paper">
            {detail.decayInWindow === 0 ? '—' : `−${detail.decayInWindow.toFixed(2)}`}
          </span>
        </p>
      </Sheet>

      <div className="grid grid-cols-2 divide-y divide-ink/15 border border-ink bg-paper-raised sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        <Count label="GUARDADOS" value={detail.counts.saves} />
        <Count label="COMENTARIOS" value={detail.counts.comments} />
        <Count label="VIBE CHECKS" value={detail.counts.vibeChecks} />
        <Count label="REPORTES" value={detail.counts.reports} />
      </div>
      <p className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
        CONTEOS EXACTOS, LEÍDOS DE SUS PROPIAS TABLAS — NO DERIVADOS DEL HISTORIAL DE HL
      </p>

      {detail.adjustments.length > 0 && (
        <Sheet
          title="Ajustes admin"
          note={`${detail.adjustments.length} EN EL HISTORIAL DE LA PIEZA`}
          padded={false}
        >
          <SheetTable head={['FECHA', 'DELTA', 'ANTES → DESPUÉS', 'MOTIVO', '']}>
            {detail.adjustments.map((a, i) => (
              <tr key={`${a.at}-${i}`}>
                <Td>{fechaHora(a.at)}</Td>
                <Td>
                  <span
                    className={`font-grotesk tabular-nums ${
                      a.applied < 0 ? 'text-sys-red-paper' : 'text-hp'
                    }`}
                  >
                    {a.applied >= 0 ? '+' : '−'}
                    {Math.abs(a.applied).toFixed(2)}
                  </span>
                </Td>
                <Td>
                  <span className="tabular-nums text-ink-soft">
                    {a.before.toFixed(2)} → {a.after.toFixed(2)}
                  </span>
                </Td>
                <Td mono={false}>
                  <span className="font-grotesk text-d13 text-ink">{a.reason ?? '—'}</span>
                </Td>
                <Td right>
                  {/* Reverting the APPLIED amount, not the requested delta:
                      when the server's floor at 0 clamped the original, the
                      inverse of what was asked for would overshoot. */}
                  <InkButton
                    onClick={() =>
                      onRevert(
                        -a.applied,
                        `Reversión del ajuste del ${fechaHora(a.at)}`.slice(0, 280),
                      )
                    }
                    tone="red"
                    title="Carga el ajuste inverso en la palanca — no lo aplica"
                  >
                    REVERTIR
                  </InkButton>
                </Td>
              </tr>
            ))}
          </SheetTable>
        </Sheet>
      )}

      {ledgerBlind && (
        <MarginNote>
          EL DESGLOSE DE ARRIBA SÓLO ES REAL DESDE EL {detail.ledgerStartsAt}. LA VENTANA PEDIDA
          EMPIEZA EL {windowStart}, Y ANTES DE ESA FECHA EL SISTEMA BORRABA CADA EVENTO AL PLEGARLO:
          NO HAY REGISTRO QUE LEER, NO ES QUE NO HUBIERA INTERACCIÓN.
        </MarginNote>
      )}

      <HlLever
        itemId={detail.id}
        title={detail.title}
        currentHp={detail.hp}
        bracket={detail.bracket}
        onApplied={onApplied}
        prefill={prefill}
      />
    </div>
  )
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">{label}</span>
      <span className="font-grotesk text-d18 font-bold tabular-nums text-ink">
        {value.toLocaleString('es-MX')}
      </span>
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Names the filters that are actually narrowing, for the empty state. */
function filterSummary(f: Filters): string[] {
  const out: string[] = []
  if (f.tipo !== 'all') {
    const t = TIPOS.find((x) => x === f.tipo)
    out.push(`TIPO ${t ? typeDisplayLabel(t) : f.tipo.toUpperCase()}`)
  }
  if (f.estado !== 'all') out.push(`ESTADO ${f.estado.toUpperCase()}`)
  if (f.q.trim()) out.push(`BÚSQUEDA «${f.q.trim().toUpperCase()}»`)
  return out
}

function fecha(iso: string): string {
  return new Date(iso)
    .toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase()
}

function fechaHora(iso: string): string {
  return new Date(iso)
    .toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
    .toUpperCase()
}
