'use client'

// ── RECEPCIÓN — cómo se recibió lo que hiciste (PLIEGO fase D) ──────────────
//
// The fifth space, and the only read-only one. PUBLICAR is where you write,
// MERCADO is where you sell; this is the mirror you look into afterwards.
// There is no lever on this sheet — no button that changes a number, no
// setting, no lift, no boost. Everything here is a reading of what already
// happened, and the only control is the window it is read over.
//
// TWO SUB-TABS, IN THIS ORDER, AND THE ORDER IS THE ARGUMENT
//   PRESENCIA  the creator-side ledger (user_hp_events), retained since May
//              2026 — four months of real rows. The space opens on it.
//   OBRA       the per-item ledger (hp_events via creator_reception()), born
//              at LEDGER_EPOCH and hours old.
//   If OBRA led, a brand-new creator would meet this space as an empty chart
//   and read it as "nobody came". Presence first, then the pieces.
//
// THE ONE RULE THIS SURFACE EXISTS TO KEEP: **proportions and counts, never
// weights.** Not a multiplier, not a nominal, not a «× 4.0» ladder anywhere.
// A creator handed a price list optimises for the price list, and the honest
// thing to optimise is the work. This is also why components/admin/kit's
// KindBreakdown — which prints the «× 0.5» column by design, under the admin
// instrument exemption — is deliberately NOT reused here; only its geometry
// primitives (BarMeter, Sparkline) are.
//
// THE OTHER LAWS, in the order it would be tempting to break them:
//   · NO IDENTITIES. Never who saved, opened, reacted or commented. Saves are
//     anonymous by design; migration 0050 §1 revoked user_hp_events
//     .attribution_key from `authenticated` precisely so this surface could
//     not reach the saver ids even by accident. Do not route around it.
//   · NO LEADERBOARD. No rank, no percentile, no comparison to another
//     creator. Pieces are ordered by publication date, never by how well they
//     did — sorting a creator's own work by score is a leaderboard of one.
//     The HP scalar is private per [[project_user_hp_visibility]]: trophies,
//     frames and firma are the public half of progression, not this number.
//   · NO ADVICE. The sheet never says how to earn more. Describing what
//     happened is a mirror; prescribing what to do next is the farm-the-metric
//     failure mode wearing a mirror's clothes.
//   · HONEST STATES. ShimmerLine while loading, ErrorLine on failure,
//     EmptyLine for a real absence, MarginNote for a real limit of the system.
//   · NO ACID. Acid is the fill of a creative own-action, and this space has
//     none — nothing here is an action at all. Zero acid blocks, on purpose.
//
// TWO ZEROS THAT MEAN OPPOSITE THINGS, and the single subtlest thing in this
// file. On the PRESENCIA side `events` is a row count, so 0 is a true zero and
// prints «0» — the route emits every canonical kind even at zero on purpose
// (a gesture that exists and has never paid out is a true thing to show). On
// the OBRA side `events` counts only hp_events rows carrying base_weight, so a
// slice reporting 0 holds real HL from rows written before that column
// existed: the count is UNKNOWABLE, not absent, and prints «—». Never let
// these two share a formatter.
//
// NO PROPS, AND NO «VER PERFIL PÚBLICO» LINK. The brief offered this space a
// `username` prop for one; DashTabBar already renders a byte-identical «VER
// PERFIL PÚBLICO ↗» on the strip directly above every space, so a second copy
// sixty pixels below it is the decorative chrome this project cuts on sight.
// The space is self-contained instead, which is the other half of that ask.
//
// DATA — GET /api/users/me/reception?dias=N, fetched here on mount and on
// every window change (the sibling spaces own their own reads; MERCADO's
// ListingThread is the pattern). The payload's two halves are independent:
// `obra` can be absent with `obraEstado: 'migracion_pendiente'` while
// `presencia` is complete, and that state is a MarginNote — a backend half
// that is not installed yet is neither a failure nor a zero.

import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

import type {
  ReceptionItem,
  ReceptionItemKind,
  ReceptionKindRow,
  ReceptionPayload,
  ReceptionPresencia,
} from '@/app/api/users/me/reception/route'
import { BarMeter, Sparkline } from '@/components/admin/kit'
import {
  Chip,
  EmptyLine,
  ErrorLine,
  FOCUS_RING,
  InkButton,
  MarginNote,
  Sheet,
  ShimmerLine,
  SpaceHead,
  SubTabs,
  type SubTab,
} from '@/components/dashboard/espacios/kit'
import { currentHp, type HpDecayParts } from '@/lib/curation'
import { hlBracket } from '@/lib/dashboard/hl'
import {
  TYPE_DISPLAY_LABELS,
  categoryColorOnLight,
  typeCode,
  typeDisplayLabel,
} from '@/lib/dashboard/palette'
import {
  KIND_CODES,
  KIND_LABELS,
  KIND_ON_LIGHT,
  LEDGER_EPOCH,
  type HpEventKind,
} from '@/lib/hp/kinds'
import type { ContentType } from '@/lib/types'

type ReceptionTab = 'presencia' | 'obra'

/** The three preset windows. 90 sits well inside the 180-day retention floor. */
const WINDOWS: readonly number[] = [7, 30, 90]
const DEFAULT_WINDOW = 30

const NUM = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 })

type LoadState =
  | { phase: 'loading' }
  | { phase: 'ready'; data: ReceptionPayload }
  | { phase: 'error' }

// ── The creator-side kind vocabulary ────────────────────────────────────────
//
// lib/hp/kinds.ts owns the four ITEM-side kinds; user_hp_events speaks a
// different language and had no display vocabulary because no surface had ever
// shown it. It lives here rather than in lib/ because RECEPCIÓN is its only
// reader — the moment a second surface needs it, move it to lib/hp/kinds.ts
// and let tests/dashboard/contrast.test.ts pin the hues.
//
// Hues overlap CATEGORY_ON_LIGHT in places, which is legal because the two
// palettes never meet in one table (PRESENCIA shows no content types). What
// must not collide is inside this map, and every swatch travels with its own
// 2-letter code anyway — hue is never the only channel. All nine measure
// ≥5.1:1 as text on BOTH paper grounds (#EDEBE3 and #F6F4EC).
//
// Labels are written from the CREATOR's side of the gesture: `item_saved` is
// "guardaron tu pieza", not "guardado", because the whole surface is the view
// from where the work landed.
//
// `publish` is one row, not eight: the route already folds `publish_<type>`,
// and splitting a creator's own publishing across eight lines is noise on a
// sheet about how OTHERS received them. The per-type reading is one tab over.
interface KindFace {
  label: string
  code: string
  color: string
}

const PRESENCE_KINDS: Record<string, KindFace> = {
  publish: { label: 'PUBLICASTE', code: 'PU', color: '#3F6212' },
  item_saved: { label: 'GUARDARON TU PIEZA', code: 'GP', color: '#9A3412' },
  comment_received: { label: 'COMENTARON TU PIEZA', code: 'CP', color: '#5B21B6' },
  comment_saved: { label: 'GUARDARON TU COMENTARIO', code: 'GC', color: '#155E75' },
  reaction_received: { label: 'REACCIONARON A TU COMENTARIO', code: 'RC', color: '#A81A5B' },
  vibe_check_cast: { label: 'MARCASTE UNA VIBRA', code: 'VM', color: '#57534E' },
  vibe_check_accurate: { label: 'TU VIBRA ATINÓ', code: 'VA', color: '#0E6E62' },
  harvest: { label: 'COSECHASTE', code: 'CS', color: '#7A510A' },
}

/**
 * A face for any kind the route sends, including one this build has never
 * heard of. An unknown kind is shown under its raw name rather than dropped:
 * it earned real HP, and discarding it would leave the shares summing to less
 * than 100 and quietly lie about where the presence came from.
 */
function presenceFace(kind: string): KindFace {
  return (
    PRESENCE_KINDS[kind] ?? {
      label: kind.replace(/_/g, ' ').toUpperCase(),
      code: 'OT',
      color: '#3D3A33',
    }
  )
}

// ── Small honest helpers ────────────────────────────────────────────────────

/** «2 SEP 2026». Same register PUBLICAR prints a publication date in. */
function dateLabel(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return format(parseISO(iso), 'd MMM yyyy', { locale: es }).toUpperCase()
  } catch {
    return '—'
  }
}

/** Spanish plurals for the four reader gestures. KIND_LABELS holds singulars. */
const KIND_PLURALS: Record<HpEventKind, string> = {
  click: 'CLICS',
  open: 'APERTURAS',
  save: 'GUARDADOS',
  comment: 'COMENTARIOS',
}

/**
 * «3 GUARDADOS» / «1 APERTURA». A slice whose events cannot be counted says so
 * in words rather than printing a 0 the bar beside it would contradict — and
 * rather than deriving one from the share, which would require the weight this
 * surface refuses to know.
 */
function readerCountPhrase(kind: HpEventKind, events: number): string {
  if (events <= 0) return `${KIND_PLURALS[kind]} · CUENTA NO DISPONIBLE`
  return `${NUM.format(events)} ${events === 1 ? KIND_LABELS[kind] : KIND_PLURALS[kind]}`
}

/**
 * Narrow a raw `items.type` string. A type this build does not know cannot be
 * decayed honestly — the half-life table in lib/curation is keyed by type — so
 * its HL prints «—» rather than a number from a guessed half-life.
 */
function asContentType(raw: string): ContentType | null {
  return raw in TYPE_DISPLAY_LABELS ? (raw as ContentType) : null
}

/** Days of the requested window that predate the item-side ledger. */
function blindDaysBefore(sinceIso: string): number {
  const since = Date.parse(`${sinceIso.slice(0, 10)}T00:00:00Z`)
  const epoch = Date.parse(`${LEDGER_EPOCH}T00:00:00Z`)
  if (!Number.isFinite(since)) return 0
  return Math.max(0, Math.round((epoch - since) / 86_400_000))
}

/** Reader kinds ordered by share. creator_reception() returns them by name. */
function byShare(slices: readonly ReceptionItemKind[]): ReceptionItemKind[] {
  return [...slices].sort((a, b) => b.share - a.share)
}

// ── Window latch ────────────────────────────────────────────────────────────

/**
 * 7 / 30 / 90 as ink latches. Buttons rather than the <Link>s /admin uses: the
 * window is component state here, not a route, so a link would either lie
 * about being navigable or need a URL param this space does not own.
 */
function WindowLatch({ dias, onChange }: { dias: number; onChange: (n: number) => void }) {
  return (
    <div
      role="group"
      aria-label="Ventana de lectura"
      className="flex flex-wrap items-stretch border border-ink bg-paper-raised"
    >
      <span className="flex min-h-11 items-center px-3 font-mono text-d11 uppercase tracking-widest text-ink-faint">
        VENTANA
      </span>
      {WINDOWS.map((n) => {
        const on = n === dias
        return (
          <button
            key={n}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(n)}
            data-cue="latch"
            className={`flex min-h-11 items-center border-l border-ink px-4 font-mono text-d13 uppercase tabular-nums tracking-widest transition-colors ${FOCUS_RING} ${
              on ? 'bg-ink font-bold text-paper' : 'text-ink-soft hover:bg-ink hover:text-paper'
            }`}
          >
            {n} D
          </button>
        )
      })}
    </div>
  )
}

// ── A proportional row: swatch · code · label · count · bar · share ─────────

function ShareRow({
  color,
  code,
  label,
  count,
  share,
  meterLabel,
}: {
  color: string
  code: string
  label: string
  /** Omitted where the count already lives inside `label` («3 GUARDADOS»). */
  count?: string
  share: number
  /** Full sentence for AT — a bar's percentage is not readable on its own. */
  meterLabel: string
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-ink/15 py-2 last:border-b-0">
      <span className="flex min-w-0 flex-1 items-center gap-2 font-mono text-d11 uppercase tracking-widest text-ink">
        <span
          aria-hidden
          className="inline-block h-2 w-2 shrink-0 border border-ink"
          style={{ backgroundColor: color }}
        />
        <span className="shrink-0 text-ink-faint">{code}</span>
        <span className="truncate">{label}</span>
      </span>
      {count !== undefined && (
        <span className="w-16 shrink-0 text-right font-mono text-d13 tabular-nums text-ink">
          {count}
        </span>
      )}
      <span className="w-24 shrink-0 sm:w-32">
        <BarMeter pct={share} color={color} label={meterLabel} />
      </span>
      <span className="w-14 shrink-0 text-right font-mono text-d13 tabular-nums text-ink">
        {NUM.format(share)}%
      </span>
    </li>
  )
}

// ── PRESENCIA ───────────────────────────────────────────────────────────────

function PresenciaPanel({ block, dias }: { block: ReceptionPresencia; dias: number }) {
  // The route states that the daily serie sums to the window total, so the
  // total is read off the series rather than carried twice and allowed to drift.
  const total = useMemo(
    () => block.serie.reduce((sum, d) => sum + d.value, 0),
    [block.serie],
  )

  const rows: (ReceptionKindRow & KindFace)[] = useMemo(
    // Order comes from the route (share desc, canonical index breaking ties)
    // and is deliberately not re-sorted here: two sorts on one list is how the
    // order starts shuffling between polls.
    () => block.kinds.map((row) => ({ ...row, ...presenceFace(row.kind) })),
    [block.kinds],
  )

  // 90 points squeezed into the kit's 84px default is a smudge, not a line. The
  // svg is fixed-width by design, so the wrapper scrolls on a narrow screen
  // rather than the chart lying about its resolution.
  const sparkWidth = Math.max(320, block.serie.length * 6)

  return (
    <div className="flex flex-col gap-6">
      <Sheet title="De dónde viene tu presencia" note={`VENTANA ${dias}D`}>
        <div className="flex flex-col gap-2">
          <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
            HP GANADO EN LOS ÚLTIMOS {dias} DÍAS
          </span>
          <span className="font-grotesk text-d28 font-bold tabular-nums text-hp">
            {total > 0 ? '+' : ''}
            {NUM.format(total)}
            <span className="ml-1.5 font-mono text-d13 font-bold tracking-widest">HP</span>
          </span>
          {/* HP decays with a 60-day half-life, so a window total is not a
              balance. Saying so costs one line and stops the number from being
              read as a score. */}
          <span className="font-mono text-d11 uppercase leading-relaxed tracking-widest text-ink-soft">
            {'ESTO ES LO GANADO DENTRO DE LA VENTANA, NO TU TOTAL ACUMULADO.'}
          </span>
        </div>
      </Sheet>

      <Sheet
        title="Por dónde llegó"
        note={`${NUM.format(block.events)} ${block.events === 1 ? 'EVENTO' : 'EVENTOS'}`}
        padded={false}
      >
        {block.events === 0 ? (
          // A single kind reading zero is worth printing — it says the gesture
          // exists and has not happened. A table where EVERY row is zero is not
          // a reading at all, and would be a wall of fake precision.
          <EmptyLine>{'AÚN NO HAY PRESENCIA REGISTRADA EN ESTA VENTANA.'}</EmptyLine>
        ) : (
          <ul className="flex flex-col px-4 py-2">
            {rows.map((r) => (
              <ShareRow
                key={r.kind}
                color={r.color}
                code={r.code}
                label={r.label}
                count={NUM.format(r.events)}
                share={r.share}
                meterLabel={`${r.label}: ${NUM.format(r.share)}% de tu HP en esta ventana`}
              />
            ))}
          </ul>
        )}
      </Sheet>

      <Sheet title="Día a día" note={`${block.serie.length} DÍAS`}>
        {block.serie.length === 0 ? (
          <EmptyLine>{'SIN DÍAS QUE DIBUJAR EN ESTA VENTANA.'}</EmptyLine>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="overflow-x-auto">
              <Sparkline
                values={block.serie.map((d) => d.value)}
                label={`HP ganado por día en los últimos ${dias} días`}
                width={sparkWidth}
                height={56}
              />
            </div>
            <div className="flex items-baseline justify-between font-mono text-d11 uppercase tabular-nums tracking-widest text-ink-faint">
              <span>{dateLabel(block.serie[0]?.day)}</span>
              <span>{dateLabel(block.serie[block.serie.length - 1]?.day)}</span>
            </div>
          </div>
        )}
      </Sheet>

      <MarginNote>
        {'TU HP ES PRESENCIA: SE GANA POR CÓMO OTRAS PERSONAS SE ENCONTRARON CON TU TRABAJO. ESTE NÚMERO ES PRIVADO — NADIE MÁS LO VE, NO SE COMPARA CON EL DE NADIE Y NO EXISTE NINGUNA TABLA DE POSICIONES. LO ÚNICO PÚBLICO DE TU PROGRESO SON LOS TROFEOS, MARCOS Y FIRMA QUE VA DESBLOQUEANDO.'}
      </MarginNote>
    </div>
  )
}

// ── OBRA ────────────────────────────────────────────────────────────────────

function ObraItem({ row }: { row: ReceptionItem }) {
  const type = asContentType(row.item_type)
  const slices = byShare(row.kinds)

  // items.hp is a STALE ANCHOR — the rollup re-writes it every few minutes, so
  // the stored value is only true as of hp_last_updated_at.
  const hl = useMemo(() => {
    if (!type) return null
    const anchor = row.published_at ?? row.hp_last_updated_at
    if (!anchor) return null
    const parts: HpDecayParts = {
      type,
      hp: row.hp,
      hpLastUpdatedAt: row.hp_last_updated_at,
      publishedAt: anchor,
      editorial: row.editorial,
      hpDecayMultiplier: row.hp_decay_multiplier,
      date: row.item_date,
      endDate: row.item_end_date,
    }
    const value = currentHp(parts)
    return Number.isFinite(value) ? value : null
  }, [row, type])

  return (
    <li className="border-b border-ink/15 px-4 py-4 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
        {type ? (
          <Chip swatch={categoryColorOnLight(type)}>
            {typeCode(type)} · {typeDisplayLabel(type)}
          </Chip>
        ) : (
          <Chip>{'TIPO DESCONOCIDO'}</Chip>
        )}
        <h3 className="min-w-0 flex-1 font-grotesk text-d15 font-bold leading-snug text-ink">
          {row.title}
        </h3>
        {/* Ink, not HP blue: blue is the reserved Human-Presence register and
            this is HL, the life of the piece. Two scalars, two colours — the
            same grammar the admin RESUMEN strip prints them in. */}
        <span className="font-grotesk text-d15 font-bold tabular-nums text-ink">
          {hl === null ? '—' : NUM.format(hl)}
          <span className="ml-1 font-mono text-d11 font-bold tracking-widest">HL</span>
        </span>
        <span className="font-mono text-d11 font-bold uppercase tracking-widest text-ink">
          ◇ {hl === null ? '—' : hlBracket(hl)}
        </span>
      </div>

      <p className="mt-1 font-mono text-d11 uppercase tracking-widest text-ink-faint">
        {dateLabel(row.published_at)}
      </p>

      {slices.length === 0 ? (
        // Not a row of zeros: no slice means nothing was recorded, which is a
        // different statement from "cero personas" and must read as one.
        <p className="mt-3 font-mono text-d11 uppercase tracking-widest text-ink-faint">
          {'SIN RECEPCIÓN REGISTRADA EN ESTA VENTANA.'}
        </p>
      ) : (
        <ul className="mt-3 flex flex-col">
          {slices.map((s) => (
            <ShareRow
              key={s.kind}
              color={KIND_ON_LIGHT[s.kind]}
              code={KIND_CODES[s.kind]}
              label={readerCountPhrase(s.kind, s.events)}
              share={s.share}
              meterLabel={`${KIND_LABELS[s.kind]}: ${NUM.format(s.share)}% de la HL de esta pieza`}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function ObraPanel({
  items,
  totals,
  dias,
  since,
}: {
  items: readonly ReceptionItem[]
  totals: readonly ReceptionItemKind[]
  dias: number
  since: string
}) {
  const totalRows = useMemo(() => byShare(totals), [totals])
  const blind = blindDaysBefore(since)

  // «La mayor parte» is only true when one kind actually carries the majority;
  // at 30/25/25/20 the honest sentence is that nothing dominates.
  const top = totalRows[0]
  const dominance = !top
    ? null
    : top.share > 50
      ? `LA MAYOR PARTE DE TU HL EN ESTA VENTANA VINO DE ${KIND_PLURALS[top.kind]}.`
      : 'NINGUNA FORMA DE ENCUENTRO DOMINA ESTA VENTANA.'

  return (
    <div className="flex flex-col gap-6">
      <Sheet title="Cómo te encontraron" note={`VENTANA ${dias}D`} padded={false}>
        {totalRows.length === 0 ? (
          <EmptyLine>{'AÚN NO HAY RECEPCIÓN REGISTRADA EN ESTA VENTANA.'}</EmptyLine>
        ) : (
          <>
            {dominance && (
              <p className="border-b border-ink/15 px-4 py-3 font-grotesk text-d15 leading-snug text-ink">
                {dominance}
              </p>
            )}
            <ul className="flex flex-col px-4 py-2">
              {totalRows.map((s) => (
                <ShareRow
                  key={s.kind}
                  color={KIND_ON_LIGHT[s.kind]}
                  code={KIND_CODES[s.kind]}
                  label={KIND_LABELS[s.kind]}
                  count={s.events > 0 ? NUM.format(s.events) : '—'}
                  share={s.share}
                  meterLabel={`${KIND_LABELS[s.kind]}: ${NUM.format(s.share)}% de tu HL en esta ventana`}
                />
              ))}
            </ul>
          </>
        )}
      </Sheet>

      <Sheet
        title="Pieza por pieza"
        note={`${items.length} ${items.length === 1 ? 'PUBLICADA' : 'PUBLICADAS'}`}
        padded={false}
      >
        {items.length === 0 ? (
          <EmptyLine>{'AÚN NO HAS PUBLICADO NADA QUE PUEDA RECIBIRSE.'}</EmptyLine>
        ) : (
          <ul className="flex flex-col">
            {items.map((row) => (
              <ObraItem key={row.id} row={row} />
            ))}
          </ul>
        )}
      </Sheet>

      <MarginNote>
        {`LA RECEPCIÓN POR PIEZA SÓLO EXISTE DESDE EL ${dateLabel(LEDGER_EPOCH)}: ANTES DE ESA FECHA EL ROLLUP BORRABA LOS EVENTOS AL PROCESARLOS Y NO QUEDÓ NADA QUE LEER.`}
        {blind > 0 && (
          <>
            {' '}
            {`LOS PRIMEROS ${blind} ${blind === 1 ? 'DÍA' : 'DÍAS'} DE ESTA VENTANA SON CIEGOS, Y CIEGO NO ES CERO.`}
          </>
        )}{' '}
        {'AQUÍ NUNCA VERÁS QUIÉN GUARDÓ, ABRIÓ O COMENTÓ: LOS GUARDADOS SON ANÓNIMOS POR DISEÑO Y EL SERVIDOR NO DEVUELVE NINGUNA IDENTIDAD.'}
      </MarginNote>
    </div>
  )
}

/** The route's `migracion_pendiente`: a backend half that is not installed. */
function ObraPendiente() {
  return (
    <Sheet title="Pieza por pieza" note="SIN INSTALAR">
      <MarginNote>
        {'LA LECTURA POR PIEZA TODAVÍA NO EXISTE EN ESTA BASE DE DATOS: LA MIGRACIÓN 0050 NO ESTÁ APLICADA. NO ES UN ERROR Y NO ES UN CERO — ES UNA MITAD DEL SISTEMA QUE AÚN NO SE INSTALA. TU PRESENCIA SÍ ESTÁ COMPLETA.'}
      </MarginNote>
    </Sheet>
  )
}

// ── The space ───────────────────────────────────────────────────────────────

export function ReceptionSpace() {
  const [tab, setTab] = useState<ReceptionTab>('presencia')
  const [dias, setDias] = useState<number>(DEFAULT_WINDOW)
  const [reload, setReload] = useState(0)
  const [state, setState] = useState<LoadState>({ phase: 'loading' })

  useEffect(() => {
    // Aborting on a window change is what keeps a slow 90-day read from landing
    // after a fast 7-day one and painting the wrong window under the latch.
    const ac = new AbortController()
    setState({ phase: 'loading' })
    void (async () => {
      try {
        const res = await fetch(`/api/users/me/reception?dias=${dias}`, { signal: ac.signal })
        if (!res.ok) throw new Error(String(res.status))
        setState({ phase: 'ready', data: (await res.json()) as ReceptionPayload })
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setState({ phase: 'error' })
      }
    })()
    return () => ac.abort()
  }, [dias, reload])

  const data = state.phase === 'ready' ? state.data : null
  const obra = data?.obra ?? null

  // Drafts come back too — creator_reception() scopes to `created_by`, not to
  // `published` — and a draft nobody can reach has no reception to report.
  // Newest first: publication order, never performance order.
  const published = useMemo(() => {
    if (!obra) return []
    return obra.items
      .filter((row) => row.published)
      .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
  }, [obra])

  const tabs: readonly SubTab<ReceptionTab>[] = [
    { id: 'presencia', label: 'PRESENCIA' },
    { id: 'obra', label: 'OBRA', count: obra ? published.length : undefined },
  ]

  const sheetTitle = tab === 'presencia' ? 'Presencia' : 'Obra'

  return (
    <div className="flex flex-col gap-6">
      <SpaceHead
        title="Recepción"
        eyebrow="CÓMO SE RECIBIÓ LO QUE HICISTE"
        chips={<Chip>{'SÓLO LECTURA'}</Chip>}
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <WindowLatch dias={dias} onChange={setDias} />
        {data && (
          <p className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
            {'DESDE '}
            <span className="tabular-nums text-ink">{dateLabel(data.presencia.since)}</span>
          </p>
        )}
      </div>

      <SubTabs tabs={tabs} active={tab} onChange={setTab} ariaLabel="Secciones de recepción" />

      <div className="pt-2">
        {state.phase === 'loading' ? (
          <Sheet title={sheetTitle} note={`VENTANA ${dias}D`}>
            <ShimmerLine />
          </Sheet>
        ) : state.phase === 'error' ? (
          <Sheet
            title={sheetTitle}
            note={`VENTANA ${dias}D`}
            action={<InkButton onClick={() => setReload((n) => n + 1)}>REINTENTAR</InkButton>}
          >
            <ErrorLine>{'NO SE PUDO LEER TU RECEPCIÓN.'}</ErrorLine>
          </Sheet>
        ) : tab === 'presencia' ? (
          <PresenciaPanel block={state.data.presencia} dias={state.data.days} />
        ) : state.data.obraEstado === 'migracion_pendiente' ? (
          <ObraPendiente />
        ) : obra ? (
          <ObraPanel
            items={published}
            totals={obra.totals}
            dias={obra.days}
            since={obra.since}
          />
        ) : (
          // obraEstado said 'ok' but no payload came with it — a malformed read,
          // which is a failure and not an absence.
          <Sheet title={sheetTitle} note={`VENTANA ${dias}D`}>
            <ErrorLine>{'NO SE PUDO LEER LA RECEPCIÓN POR PIEZA.'}</ErrorLine>
          </Sheet>
        )}
      </div>
    </div>
  )
}
