'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Chip,
  EmptyLine,
  ErrorLine,
  FOCUS_RING,
  InkButton,
  MarginNote,
  Sheet,
  SheetTable,
  ShimmerLine,
  SpaceHead,
  SubTabs,
  Td,
} from '@/components/admin/kit'
import { adminTabHref } from '@/lib/admin/tabs'

// ── MODERACIÓN — la cola de reportes ────────────────────────────────────────
//
// The first real moderation surface in the product. Before migration 0049 §7
// there was no reports table, no reporting gesture and therefore nothing to
// queue: prod's entire moderation history is ONE action across four months.
// That is why this file is careful about zeros — an empty queue here means
// "nobody has reported anything", not "the community is clean", and the two
// readings are one MarginNote apart.
//
// Fetches its own data (no props). The queue is not part of the server page's
// prefetch because it is the only tab whose rows change while you are looking
// at them, and because /admin is force-dynamic — a server prefetch would still
// need a client refetch after every PATCH.
//
// ACID: none, deliberately. The surface's one fill-block is spent on RESUMEN's
// create rail (see app/admin/page.tsx). The SubTabs `dot` affordance is acid
// and is NOT used here: the open count is already carried by the tab-bar latch
// upstairs, and a second acid mark for the same fact would spend a ration this
// tab does not own.
//
// COLOUR: nothing in this queue speaks in sys-red. Neither RESOLVER nor
// DESCARTAR destroys anything — there is no DELETE on reports, in the route or
// in RLS — so the destructive register would be a lie about what the buttons do.

type Estado = 'abierto' | 'resuelto' | 'descartado'

const ESTADOS: readonly Estado[] = ['abierto', 'resuelto', 'descartado']

const ESTADO_LABEL: Record<Estado, string> = {
  abierto: 'ABIERTO',
  resuelto: 'RESUELTO',
  descartado: 'DESCARTADO',
}

// target_type and reason are TEXT + CHECK, not enums — 0048 is the reason (a
// single enum rename broke five plpgsql bodies), and the migration says so out
// loud: widening a CHECK is one ALTER. So both are typed `string` here and both
// label maps fall back to the raw value uppercased. A value added in SQL next
// month must render as itself, never crash the queue and never print
// `undefined` where a motive belongs.
const TARGET_LABEL: Record<string, string> = {
  item: 'CONTENIDO',
  comment: 'COMENTARIO',
  foro_thread: 'HILO',
  foro_reply: 'RESPUESTA',
  listing: 'ANUNCIO',
}

const REASON_LABEL: Record<string, string> = {
  spam: 'SPAM',
  acoso: 'ACOSO',
  odio: 'ODIO',
  sexual: 'SEXUAL',
  violencia: 'VIOLENCIA',
  // Stored unaccented — the CHECK constraint's literal is `enganoso`. Only the
  // display carries the ñ.
  enganoso: 'ENGAÑOSO',
  copyright: 'COPYRIGHT',
  otro: 'OTRO',
}

/** The route's own ceiling. A full page means "at least 200", not "200". */
const QUERY_CAP = 200

/** Postgres tolerates a long IN list; a URL does not. Resolve in batches. */
const SLUG_BATCH = 200

// PostgREST embeds a to-one FK as an object, but nothing type-checks that
// here: the route selects through `.from('reports' as never)`, so the shape
// arrives as untyped JSON on both sides of the wire. Accept object OR array
// rather than print "[object Object]" into the REPORTADO POR column.
type Embed = { username: string | null } | { username: string | null }[] | null

interface ApiReport {
  id: number
  target_type: string
  target_id: string
  reason: string
  note: string | null
  status: string
  created_at: string
  resolved_at: string | null
  resolution: string | null
  reporter: Embed
  resolver: Embed
}

function usernameOf(embed: Embed): string | null {
  const one = Array.isArray(embed) ? embed[0] : embed
  return one?.username ?? null
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
}

/**
 * A link to the reported object, or null when one cannot be built from the
 * report row.
 *
 * The two live contracts, both verified against their consumers rather than
 * assumed:
 *
 *   · items    → `/dashboard?item=<SLUG>`. The overlay stack keys on SLUG
 *     (components/overlay/useOverlay.tsx, PARAM = 'item') while target_id
 *     carries items.id — they are NOT the same string (`ev-nn-club-coco` vs
 *     `club-coco-cdmx-nochenegra-2024`), so the id is resolved to a slug
 *     first. /dashboard rather than / because DashOverlayHost is the one host
 *     that survives a cold cache: it fetches by slug and, when the slug
 *     resolves to nothing, shows an honest CONTENIDO NO DISPONIBLE notice
 *     instead of a click that does nothing.
 *   · foro_thread → `/foro?thread=<id>`, keyed by id, so it builds straight
 *     from the report row.
 *
 * Everything else has no constructible link and prints its id plainly:
 * a comment deep link needs its parent item's slug (`?item=…&comment=…`), a
 * foro_reply needs its parent thread id, and a listing needs its franja slug
 * (`/marketplace?franja=…&listing=…`). None of the three is on the report row.
 */
function objectHref(targetType: string, targetId: string, slug?: string): string | null {
  if (targetType === 'item') {
    return slug ? `/dashboard?item=${encodeURIComponent(slug)}` : null
  }
  if (targetType === 'foro_thread') {
    return `/foro?thread=${encodeURIComponent(targetId)}`
  }
  return null
}

async function fetchEstado(estado: Estado): Promise<{ rows: ApiReport[]; unavailable: boolean }> {
  const res = await fetch(`/api/admin/reports?estado=${estado}`, { cache: 'no-store' })
  const json = (await res.json().catch(() => ({}))) as {
    rows?: ApiReport[]
    unavailable?: boolean
    error?: string
  }
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
  return { rows: json.rows ?? [], unavailable: json.unavailable === true }
}

type Lists = Record<Estado, ApiReport[] | null>

const EMPTY_LISTS: Lists = { abierto: null, resuelto: null, descartado: null }

export function ModeracionTab() {
  const [active, setActive] = useState<Estado>('abierto')
  const [lists, setLists] = useState<Lists>(EMPTY_LISTS)
  const [slugs, setSlugs] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)

  // Which row has its close form open, and which of the two outcomes it is
  // arming. One at a time — two half-written rulings on screen is a way to
  // file the wrong one.
  const [form, setForm] = useState<{ id: number; status: Estado } | null>(null)
  const [resolution, setResolution] = useState('')

  const load = useCallback(async (estados: readonly Estado[]) => {
    setBusy(true)
    setError(null)
    try {
      const results = await Promise.all(estados.map(fetchEstado))
      // The 42P01 branch of the route answers every state identically, so one
      // unavailable answer means the table is missing, not that one query lost.
      setUnavailable(results.some((r) => r.unavailable))
      setLists((prev) => {
        const next = { ...prev }
        estados.forEach((e, i) => {
          next[e] = results[i].rows
        })
        return next
      })
    } catch (e) {
      setError((e instanceof Error ? e.message : 'FALLÓ LA CARGA DE LA COLA').toUpperCase())
    } finally {
      setBusy(false)
    }
  }, [])

  // All three states on mount: the sub-tab counts are part of the reading (a
  // queue you have worked is as informative as one you have not), and a count
  // that only appears after you visit its tab is not a count, it is a reward
  // for clicking. Refetch on switch keeps the visible list fresh.
  useEffect(() => {
    void load(ESTADOS)
  }, [load])

  // items.id → items.slug for the deep links. Bounded, batched, and cached
  // including the MISSES: an id that resolves to nothing is asked for once and
  // then printed plainly. A miss is NOT read as "the object was deleted" —
  // items_staff_read admits guide+admin, so a mod who is only `is_mod` sees
  // published rows only, and an unresolved id there means "not visible to
  // you", which is a different sentence entirely.
  useEffect(() => {
    const wanted = new Set<string>()
    for (const list of Object.values(lists)) {
      for (const r of list ?? []) if (r.target_type === 'item') wanted.add(r.target_id)
    }
    const batch = [...wanted].filter((id) => !(id in slugs)).slice(0, SLUG_BATCH)
    if (batch.length === 0) return

    let cancelled = false
    void (async () => {
      let found: { id: string; slug: string | null }[] = []
      try {
        const { data } = await createClient().from('items').select('id, slug').in('id', batch)
        found = (data ?? []) as { id: string; slug: string | null }[]
      } catch {
        // Deliberately silent, and deliberately still marked below. A failed
        // slug lookup costs the row its link, not its place in the queue —
        // surfacing it as a queue error would say the reports failed to load
        // when they did not.
      }
      if (cancelled) return
      setSlugs((prev) => {
        const next = { ...prev }
        for (const id of batch) next[id] = ''
        for (const row of found) if (row.slug) next[row.id] = row.slug
        return next
      })
    })()
    return () => {
      cancelled = true
    }
  }, [lists, slugs])

  const select = (next: Estado) => {
    setActive(next)
    setForm(null)
    setResolution('')
    void load([next])
  }

  const arm = (id: number, status: Estado) => {
    setForm({ id, status })
    setResolution('')
    setError(null)
  }

  const close = async () => {
    if (!form) return
    const text = resolution.trim()
    // Mirrors the route's own guard (0049's PATCH rejects under 3 chars) so the
    // refusal is stated before the round trip, not translated back from a 400.
    if (text.length < 3) return

    const list = lists.abierto ?? []
    const index = list.findIndex((r) => r.id === form.id)
    if (index === -1) return
    const row = list[index]

    setLists((prev) => ({
      ...prev,
      abierto: (prev.abierto ?? []).filter((r) => r.id !== form.id),
    }))
    setForm(null)
    setResolution('')
    setBusy(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/reports/${form.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: form.status, resolution: text }),
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(json.error ?? `HTTP ${res.status}`)
      }
      // Reload rather than move the row locally: who closed it and when are
      // the database's answers, and this component does not know its own
      // username. Inventing the resolver line would be the one fabrication
      // this table exists to prevent.
      void load(ESTADOS)
    } catch (e) {
      setLists((prev) => {
        const restored = [...(prev.abierto ?? [])]
        restored.splice(Math.min(index, restored.length), 0, row)
        return { ...prev, abierto: restored }
      })
      setError((e instanceof Error ? e.message : 'NO SE PUDO CERRAR EL REPORTE').toUpperCase())
    } finally {
      setBusy(false)
    }
  }

  const rows = lists[active]
  const isOpenQueue = active === 'abierto'
  const head = isOpenQueue
    ? (['FECHA', 'OBJETO', 'MOTIVO', 'REPORTADO POR', 'NOTA', 'ACCIÓN'] as const)
    : (['FECHA', 'OBJETO', 'MOTIVO', 'REPORTADO POR', 'NOTA', 'CIERRE'] as const)

  const sheetNote = unavailable
    ? undefined
    : rows === null
      ? undefined
      : rows.length >= QUERY_CAP
        ? `MOSTRANDO ${QUERY_CAP} · TOPE DE LA CONSULTA`
        : `${rows.length} EN ESTA COLA`

  return (
    <div className="flex w-full flex-col">
      <SpaceHead
        as="h2"
        eyebrow="ESPACIO"
        title="MODERACIÓN"
        chips={<Chip>COLA DE REPORTES</Chip>}
        right={
          <InkButton onClick={() => void load(ESTADOS)} disabled={busy}>
            RECARGAR
          </InkButton>
        }
      />

      <div className="py-4">
        <MarginNote>
          {
            'UN REPORTE NO GUARDA LLAVE FORÁNEA HACIA SU OBJETO: SOBREVIVE AL BORRADO DE LO REPORTADO, Y EL PANEL NO PUEDE DISTINGUIR ALGO ELIMINADO DE ALGO QUE NO LOGRA RESOLVER. UN ID SIN ENLACE SIGNIFICA «NO SE PUDO CONSTRUIR EL ENLACE», NUNCA «YA NO EXISTE». NINGÚN REPORTE SE BORRA, NI AQUÍ NI EN LA BASE: UNO CERRADO ES EL REGISTRO DE QUE ALGUIEN LO MIRÓ.'
          }
        </MarginNote>
      </div>

      <SubTabs
        tabs={ESTADOS.map((e) => ({
          id: e,
          label: ESTADO_LABEL[e],
          count: lists[e]?.length,
        }))}
        active={active}
        onChange={select}
        ariaLabel="Estados de la cola de reportes"
      />

      <div className="flex flex-col gap-6 pt-4">
        <Sheet title="REPORTES" note={sheetNote} padded={false}>
          {unavailable ? (
            <div className="flex flex-col gap-4 px-4 pb-4">
              <ErrorLine>LA TABLA DE REPORTES NO ESTÁ EN LA BASE DE DATOS</ErrorLine>
              <MarginNote>
                {
                  'LA MIGRACIÓN 0049 §7 NO ESTÁ APLICADA EN ESTE ENTORNO. LA COLA NO ESTÁ VACÍA: NO EXISTE, Y MIENTRAS TANTO NINGÚN REPORTE SE ESTÁ REGISTRANDO. APLICA 0049 PARA QUE ESTA PANTALLA TENGA SUSTRATO.'
                }
              </MarginNote>
            </div>
          ) : (
            <>
              {error && <ErrorLine>{error}</ErrorLine>}
              {rows === null ? (
                <ShimmerLine />
              ) : rows.length === 0 ? (
                <div className="flex flex-col gap-4 px-4 pb-4">
                  <EmptyLine>SIN REPORTES EN «{ESTADO_LABEL[active]}»</EmptyLine>
                  {isOpenQueue && (
                    <MarginNote>
                      {
                        'REPORTAR ES UN GESTO NUEVO DEL PRODUCTO: ANTES DE 0049 NO EXISTÍA NI LA TABLA NI EL BOTÓN. UNA COLA VACÍA SIGNIFICA QUE NADIE HA REPORTADO NADA TODAVÍA — NO ES UNA MEDICIÓN DE LA SALUD DE LA COMUNIDAD.'
                      }
                    </MarginNote>
                  )}
                </div>
              ) : (
                <SheetTable head={head}>
                  {/* The route orders oldest-first on purpose (a queue is
                      worked from the front); rendering in arrival order is
                      what keeps the oldest complaint from sinking. */}
                  {rows.map((r) => (
                    <ReportRow
                      key={r.id}
                      row={r}
                      slug={slugs[r.target_id] || undefined}
                      openQueue={isOpenQueue}
                      form={form && form.id === r.id ? form.status : null}
                      resolution={resolution}
                      busy={busy}
                      onArm={arm}
                      onResolutionChange={setResolution}
                      onCancel={() => setForm(null)}
                      onConfirm={() => void close()}
                    />
                  ))}
                </SheetTable>
              )}
            </>
          )}
        </Sheet>

        {/* MODERADORES — a pointer, not a second editor. Who may work this
            queue is one fact with one home (the USUARIOS user editor writes
            `is_mod` / `role`), and RLS reads that same pair through
            private.auth_is_mod_or_admin(). A duplicate control here would be a
            second place to disagree about the same permission. */}
        <Sheet title="MODERADORES" note="SE ADMINISTRAN EN USUARIOS">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <p className="max-w-prose font-grotesk text-d15 leading-relaxed text-ink-soft">
              Quién puede trabajar esta cola se decide en el editor de usuarios: la marca{' '}
              <span className="font-mono text-d13 uppercase tracking-widest text-ink">MOD</span> y el
              rol <span className="font-mono text-d13 uppercase tracking-widest text-ink">ADMIN</span>{' '}
              son las dos llaves que abren la política{' '}
              <span className="font-mono text-d13 text-ink">reports_read_staff</span>. Esta pantalla
              no las edita: sería un segundo lugar donde el mismo permiso puede decir otra cosa.
            </p>
            <div className="ml-auto">
              <InkButton href={adminTabHref('usuarios')}>IR A USUARIOS</InkButton>
            </div>
          </div>
        </Sheet>
      </div>
    </div>
  )
}

// ── Una fila ────────────────────────────────────────────────────────────────

/**
 * The close form is hand-rolled rather than built on the kit's ExpandableRow:
 * that primitive owns a single ABRIR/CERRAR toggle in its last cell, and this
 * row has TWO entry points (RESOLVER, DESCARTAR) that open the same panel in
 * two different modes. Bending ExpandableRow to that would have meant either a
 * toggle that lies about what it opens or a second `open` prop nobody else
 * needs.
 */
function ReportRow({
  row,
  slug,
  openQueue,
  form,
  resolution,
  busy,
  onArm,
  onResolutionChange,
  onCancel,
  onConfirm,
}: {
  row: ApiReport
  slug?: string
  openQueue: boolean
  /** Non-null when this row's close form is armed, carrying the outcome. */
  form: Estado | null
  resolution: string
  busy: boolean
  onArm: (id: number, status: Estado) => void
  onResolutionChange: (value: string) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const href = objectHref(row.target_type, row.target_id, slug)
  const reporter = usernameOf(row.reporter)
  const resolver = usernameOf(row.resolver)
  const fieldId = `resolucion-${row.id}`
  const tooShort = resolution.trim().length < 3

  return (
    <>
      <tr>
        <Td>
          <span className="whitespace-nowrap tabular-nums text-ink-soft">
            {fmtDate(row.created_at)}
          </span>
        </Td>

        <Td>
          <div className="flex min-w-0 flex-col items-start gap-1">
            <Chip>{TARGET_LABEL[row.target_type] ?? row.target_type.toUpperCase()}</Chip>
            {href ? (
              <Link
                href={href}
                className={`inline-flex min-h-11 max-w-[18rem] items-center gap-1 break-all text-ink underline decoration-ink/40 underline-offset-4 hover:decoration-ink ${FOCUS_RING}`}
              >
                {slug ?? row.target_id}
                <span aria-hidden>↗</span>
              </Link>
            ) : (
              <span className="max-w-[18rem] break-all text-ink-soft">{row.target_id}</span>
            )}
          </div>
        </Td>

        <Td>
          <span className="whitespace-nowrap text-ink">
            {REASON_LABEL[row.reason] ?? row.reason.toUpperCase()}
          </span>
        </Td>

        <Td>
          <span className="whitespace-nowrap text-ink-soft">
            {reporter ? `@${reporter}` : '—'}
          </span>
        </Td>

        <Td mono={false}>
          {row.note ? (
            <p className="max-w-[22rem] text-d13 leading-snug text-ink-soft">{row.note}</p>
          ) : (
            <span className="font-mono text-ink-faint">—</span>
          )}
        </Td>

        <Td right>
          {openQueue ? (
            <div className="flex flex-wrap justify-end gap-2">
              <InkButton onClick={() => onArm(row.id, 'resuelto')} disabled={busy}>
                RESOLVER
              </InkButton>
              <InkButton onClick={() => onArm(row.id, 'descartado')} disabled={busy}>
                DESCARTAR
              </InkButton>
            </div>
          ) : (
            <div className="ml-auto flex max-w-[22rem] flex-col items-end gap-1">
              <span className="whitespace-nowrap text-d11 uppercase tracking-widest text-ink-faint">
                {resolver ? `@${resolver}` : '—'} · {fmtDate(row.resolved_at)}
              </span>
              {row.resolution && (
                <p className="text-right font-grotesk text-d13 leading-snug text-ink">
                  {row.resolution}
                </p>
              )}
            </div>
          )}
        </Td>
      </tr>

      {form && (
        <tr>
          <td colSpan={6} className="border-b border-ink bg-paper px-4 py-5">
            <div className="flex flex-col gap-3">
              <label
                htmlFor={fieldId}
                className="font-mono text-d11 uppercase tracking-widest text-ink-faint"
              >
                {form === 'resuelto'
                  ? 'RESOLVER — QUÉ ACCIÓN SE TOMÓ'
                  : 'DESCARTAR — POR QUÉ NO PROCEDÍA'}
              </label>
              <textarea
                id={fieldId}
                value={resolution}
                onChange={(e) => onResolutionChange(e.target.value)}
                rows={3}
                maxLength={1000}
                autoFocus
                className={`w-full border border-ink bg-paper-raised px-3 py-2 font-grotesk text-d15 leading-relaxed text-ink placeholder:text-ink-faint ${FOCUS_RING}`}
                placeholder="Borré el comentario y avisé al autor."
              />
              <p className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
                {/* The route rejects under 3 characters. The next moderator to
                    meet this object reads this line and nothing else. */}
                MÍNIMO 3 CARACTERES · QUEDA EN EL REGISTRO PERMANENTE DEL REPORTE
              </p>
              <div className="flex flex-wrap gap-2">
                <InkButton onClick={onConfirm} disabled={busy || tooShort} tone="filled">
                  {form === 'resuelto' ? 'CONFIRMAR RESUELTO' : 'CONFIRMAR DESCARTADO'}
                </InkButton>
                <InkButton onClick={onCancel} disabled={busy}>
                  CANCELAR
                </InkButton>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
