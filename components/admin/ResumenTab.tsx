import Link from 'next/link'
import { formatDistanceToNowStrict, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  AcidBlock,
  Chip,
  EmptyLine,
  ErrorLine,
  FOCUS_RING,
  InkButton,
  KindBreakdown,
  LineChart,
  MarginNote,
  Row,
  Sheet,
  StatBlock,
  StatStrip,
  type ChartSeries,
} from '@/components/admin/kit'
import { SERIES_LABELS, SERIES_ON_LIGHT } from '@/lib/hp/kinds'
import type { AdminOverview } from '@/lib/data/adminStats'

// ── RESUMEN — the overview of «CENTRAL DE ADMINISTRACIÓN» ───────────────────
//
// SERVER component. Every prop in AdminOverview is plain JSON and nothing on
// this surface has state — the window selector is three <Link>s, not a
// setState — so there is no reason to ship this module to the browser. The kit
// primitives it composes carry their own 'use client'; importing them from a
// server component is fine because the data crossing the boundary is
// serializable. Formatting the rollup timestamp on the server is a bonus: a
// relative time computed in two places is the classic hydration mismatch, and
// the route is `force-dynamic` so the server reading is always fresh.
//
// THE THREE HONESTY RULES THIS SURFACE EXISTS TO KEEP (see lib/data/adminStats
// for where each number comes from):
//
//   1. The item-side ledger starts at ledger.epoch (migration 0049). A window
//      that reaches behind it is partly BLIND, and blind is not zero. Tiles fed
//      by the ledger carry a «REAL DESDE …» note and the chart states the gap.
//   2. Counts come from base_weight, HL sums from weight — weight is already
//      novelty-scaled per caller, so weight/nominal is not a count. Where a
//      count is unknowable the kit prints «—». Nothing here derives one.
//   3. `decaimiento` is only the decay recorded for items that were re-anchored
//      in the same rollup tick. It is the exact complement of the HL gained
//      (the two sum to the real net change in items.hp) and it is NOT
//      corpus-wide decay. The chart's margin note says so in those words.
//
// ACID: the CREAR block at the foot is the ONE fill-block of the whole /admin
// route. The masthead's ADMIN stamp is chrome identity, not an action. Do not
// add a second block here or on any sibling tab.

/** The preset windows. Typed as number[] so a comparison to `dias` is legal. */
const WINDOWS: readonly number[] = [7, 30, 90]

const NUM = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 })

/** Explicit sign — a delta tile that drops its «+» reads as a total. */
function signed(v: number): string {
  return `${v < 0 ? '−' : '+'}${NUM.format(Math.abs(v))}`
}

export function ResumenTab({ overview, dias }: { overview: AdminOverview; dias: number }) {
  const { window: win, ledger, kpis, flujo, rollup } = overview

  // One note, reused by every tile the ledger feeds. When the window is wholly
  // pre-ledger there is no covered day to name, so the tile states the epoch
  // instead — «desde nunca» would be worse than the date itself.
  const ledgerNote =
    ledger.blindDays === 0
      ? undefined
      : ledger.coveredFrom
        ? `REAL DESDE ${ledger.coveredFrom}`
        : `LEDGER INICIA ${ledger.epoch}`

  const series: ChartSeries[] = [
    {
      key: 'neto',
      label: SERIES_LABELS.hlNeto,
      color: SERIES_ON_LIGHT.hlNeto,
      values: flujo.neto,
    },
    {
      key: 'hpCreadores',
      label: SERIES_LABELS.hpCreadores,
      color: SERIES_ON_LIGHT.hpCreadores,
      values: flujo.hpCreadores,
    },
    {
      key: 'decaimiento',
      label: SERIES_LABELS.decaimiento,
      color: SERIES_ON_LIGHT.decaimiento,
      values: flujo.decaimiento,
      dashed: true,
    },
  ]

  const lastCycle = rollup.lastProcessedAt
    ? `HACE ${formatDistanceToNowStrict(parseISO(rollup.lastProcessedAt), { locale: es }).toUpperCase()}`
    : '—'

  const sistema: { label: string; value: string; numeric?: boolean }[] = [
    { label: 'EVENTOS SIN PROCESAR', value: NUM.format(rollup.pending), numeric: true },
    // Scoped to the window on purpose: lastProcessedAt is read off the ledger
    // rows this page already loaded, so «—» means "no processed row inside the
    // window", not "the rollup never ran".
    { label: 'ÚLTIMO CICLO EN LA VENTANA', value: lastCycle },
    { label: 'LEDGER DESDE', value: ledger.epoch },
    {
      label: `DÍAS CIEGOS DE ${win.days}`,
      value: NUM.format(ledger.blindDays),
      numeric: true,
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* ── Control row ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-ink pb-4">
        {/* Real links, so a window bookmarks and middle-clicks. */}
        <nav
          aria-label="Ventana de análisis"
          className="flex items-stretch border border-ink bg-paper-raised"
        >
          <span className="flex min-h-11 items-center px-3 font-mono text-d11 uppercase tracking-widest text-ink-faint">
            VENTANA
          </span>
          {WINDOWS.map((n) => {
            const on = n === dias
            return (
              <Link
                key={n}
                href={`/admin?tab=resumen&dias=${n}`}
                scroll={false}
                aria-current={on ? 'page' : undefined}
                data-cue="latch"
                className={`flex min-h-11 items-center border-l border-ink px-4 font-mono text-d13 uppercase tabular-nums tracking-widest transition-colors ${FOCUS_RING} ${
                  on
                    ? 'bg-ink font-bold text-paper'
                    : 'text-ink-soft hover:bg-ink hover:text-paper'
                }`}
              >
                {n} D
              </Link>
            )
          })}
        </nav>

        {/* ?dias= is clamped to 7–180 by the page, so a bookmarked 180 is a
            real window with no preset. Show it rather than latch a lie. */}
        {!WINDOWS.includes(dias) && <Chip filled>{dias} DÍAS</Chip>}

        <p className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
          <span className="tabular-nums text-ink">
            {win.from} → {win.to}
          </span>{' '}
          · CORTE DIARIO 00:00 UTC (18:00 CDMX)
        </p>
      </div>

      {/* ── KPI strip ────────────────────────────────────────────────────── */}
      <div>
        <StatStrip>
          {/* Read off items.hp decayed to now — not from the ledger, so it is
              complete regardless of the epoch and carries no note. */}
          <StatBlock label="HL ACTIVO" value={NUM.format(kpis.hlActivo)} />
          <StatBlock
            label={`Δ HL ${dias}D`}
            value={kpis.hlGanado === null ? 'SIN HISTORIAL' : signed(kpis.hlGanado)}
            note={ledgerNote}
          />
          {/* user_hp_events is retained since May, so the creator side has full
              history even when the item side is blind. */}
          <StatBlock
            label={`Δ HP CREADORES ${dias}D`}
            value={signed(kpis.hpCreadores)}
            tone="hp"
          />
          <StatBlock
            label={`INTERACCIONES ${dias}D`}
            value={kpis.interacciones === null ? '—' : NUM.format(kpis.interacciones)}
            note={ledgerNote}
          />
          <StatBlock label="CONTENIDO ACTIVO" value={NUM.format(kpis.contenidoActivo)} />
        </StatStrip>
        {/* Two scalars, two meanings, one line — the panel is the first place
            anyone sees both at once. */}
        <p className="border-x border-b border-ink bg-paper-raised px-4 py-2 font-mono text-d11 uppercase tracking-widest text-ink-faint">
          HL = VIDA DEL CONTENIDO · <span className="font-bold text-hp">HP</span> = PRESENCIA
          HUMANA
        </p>
      </div>

      {/* ── Flujo + atención ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Sheet title="FLUJO DE VIDA" note={`${win.days} DÍAS`}>
            <LineChart series={series} days={flujo.days} markers={flujo.markers} />
            <div className="mt-4">
              <MarginNote>
                DECAIMIENTO REGISTRA SÓLO LOS ÍTEMS QUE RECIBIERON UN EVENTO EN EL MISMO CICLO
                DEL ROLLUP: ES EL COMPLEMENTO EXACTO DE LA HL GANADA, NO EL DECAIMIENTO DE TODO
                EL CATÁLOGO.
                {ledger.blindDays > 0 && (
                  <>
                    {' '}
                    LOS PRIMEROS {ledger.blindDays} DÍAS DE ESTA VENTANA SON ANTERIORES AL
                    LEDGER ({ledger.epoch}): NO HAY DATO QUE DIBUJAR EN HL NI EN DECAIMIENTO, Y
                    ESO NO SIGNIFICA QUE NO HUBO ACTIVIDAD. HP CREADORES SÍ CUBRE LA VENTANA
                    COMPLETA.
                  </>
                )}
              </MarginNote>
            </div>
          </Sheet>
        </div>

        <Sheet
          title="ATENCIÓN"
          action={<InkButton href="/admin?tab=moderacion">MODERACIÓN</InkButton>}
        >
          <div className="flex flex-col">
            {overview.atencion.map((a, i) => {
              const alarm = a.urgent && a.count > 0
              return (
                <Row key={a.key} last={i === overview.atencion.length - 1}>
                  <span
                    className={`w-12 shrink-0 text-right font-grotesk text-d28 font-bold tabular-nums ${
                      alarm ? 'text-sys-red-paper' : a.count === 0 ? 'text-ink-faint' : 'text-ink'
                    }`}
                  >
                    {a.count}
                  </span>
                  <span className="min-w-0 flex-1 font-mono text-d11 uppercase leading-snug tracking-widest text-ink-soft">
                    {a.label}
                  </span>
                  {/* No href means nothing to open. The row still prints its
                      zero so the operator learns the queue's full shape. */}
                  {a.href && (
                    <InkButton href={a.href} tone={alarm ? 'red' : 'ink'}>
                      {a.action}
                    </InkButton>
                  )}
                </Row>
              )
            })}
          </div>
        </Sheet>
      </div>

      {/* ── Interacciones + sistema ──────────────────────────────────────── */}
      {/* Same 2/1 split as the region above so the four sheets share two
          column edges down the page. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Sheet title="INTERACCIONES → HL" padded={false}>
            {ledger.coveredFrom ? (
              // InteractionRow and BreakdownRow are the same shape by
              // construction (key/label/code/color/nominal/weight/count), so
              // the rows pass straight through — a mapping step here would be
              // a second copy of the vocabulary waiting to drift.
              // `total` comes from the KPI rather than the table's own sum:
              // the row weights are rounded per kind and can land a decimal
              // away from the tile, and two figures for one quantity is the
              // kind of disagreement that makes an operator stop trusting the
              // panel.
              <KindBreakdown
                rows={overview.interacciones}
                total={kpis.hlGanado ?? undefined}
              />
            ) : (
              <EmptyLine>SIN LEDGER EN ESTA VENTANA · INICIA {ledger.epoch}</EmptyLine>
            )}
            <div className="p-4">
              <MarginNote>
                LOS EVENTOS SE CUENTAN CON BASE_WEIGHT Y LA HL SE SUMA CON WEIGHT, QUE YA VIENE
                PONDERADO POR LA NOVEDAD DEL CONTENIDO PARA CADA LECTOR. POR ESO PESO × EVENTOS
                NO REPRODUCE LA CONTRIBUCIÓN, Y UN GUION EN «EVENTOS» SIGNIFICA QUE ESAS FILAS
                NO SON CONTABLES — NUNCA UN CERO.
              </MarginNote>
            </div>
          </Sheet>
        </div>

        <Sheet title="SISTEMA" note="ROLLUP HP">
          <div className="flex flex-col">
            {sistema.map((s, i) => (
              <Row key={s.label} last={i === sistema.length - 1}>
                <span className="min-w-0 flex-1 font-mono text-d11 uppercase tracking-widest text-ink-soft">
                  {s.label}
                </span>
                <span
                  className={
                    s.numeric
                      ? 'font-grotesk text-d15 font-bold tabular-nums text-ink'
                      : 'font-mono text-d13 uppercase tabular-nums tracking-widest text-ink'
                  }
                >
                  {s.value}
                </span>
              </Row>
            ))}
          </div>
          {/* pg_cron ticks every 5 min; two missed ticks is a person's problem,
              and adminStats decides that — this only reports the verdict. */}
          {rollup.stale && (
            <ErrorLine>ROLLUP RETRASADO · EVENTOS SIN PLEGAR HACE MÁS DE 15 MIN</ErrorLine>
          )}
        </Sheet>
      </div>

      {/* ── The surface's one acid block ─────────────────────────────────── */}
      <AcidBlock title="CREAR">
        <InkButton href="/admin?tab=eventos">NUEVO EVENTO</InkButton>
        <InkButton href="/admin?tab=acceso">INVITACIÓN</InkButton>
        <InkButton href="/admin?tab=franjas">FRANJA</InkButton>
        <InkButton href="/admin?tab=acceso&sub=espera">REVISAR ESPERA</InkButton>
      </AcidBlock>
    </div>
  )
}
