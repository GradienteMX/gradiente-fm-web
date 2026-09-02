'use client'

import { useMemo, useRef, useState } from 'react'
import { Loader2, Plus, Save, Upload } from 'lucide-react'
import type { ContentItem, EntityRef } from '@/lib/types'
import { useAuth } from '@/components/auth/useAuth'
import { compressAndUploadImage } from '@/lib/imageUpload'
import { EntityMultiSelectL } from '@/components/dashboard/compose/kit/EntityMultiSelectL'
import { FOCUS_RING } from '@/components/admin/kit'

// Admin events editor — a dense, spreadsheet-style listing where admins edit
// existing events and create new ones inline. Each row is one event; rich
// fields (DJ/venue/promoter pickers, image upload) live in the row. Save is
// per-row → POST /api/admin/events. See plan + app/api/admin/events/route.ts.
//
// «EL PLIEGO» chrome (fase F): each row is a paper sheet with an ink hairline
// border and a mono uppercase field register; the draft row wears an ink
// fill-strip head so it can never be confused with a live one. The entity
// pickers moved to the pliego fork (EntityMultiSelectL) — identical props,
// identical /api/entities contract, paper chrome.
//
// ── KNOWN DEBT: this list is not windowed ───────────────────────────────────
// Every event gets a fully-mounted form, unconditionally, on first paint.
// Production holds 450 type='evento' rows, so /admin?tab=eventos mounts 450
// forms × 3 EntityMultiSelectL = 1,350 picker instances, each with its own
// useState pair and debounce effect, plus ~15 form controls per row (≈6,750
// interactive elements). No network cost — the pickers only fetch on a typed
// query — but the mount, the React tree and the keystroke-time reconciliation
// all scale linearly, and the FILTRAR box narrows the list only AFTER the
// full mount has already happened.
//
// Shape of the fix, when it is worth doing: the row is already two things
// glued together — a one-line identity (fecha · nombre · venue) and an edit
// form. Split them, render the identity line for all 450, and mount the form
// for at most one row at a time via the admin kit's ExpandableRow +
// useSingleOpen (components/admin/kit.tsx), which is the disclosure grammar
// the rest of /admin already uses. That collapses the steady state to 3
// pickers. Paginating or virtualising the identity list is the follow-up if
// 450 plain rows ever stops being cheap. Deliberately NOT done in this pass:
// it is a rewrite of the component, and this pass is defect fixes only.

// <input type="datetime-local"> wants "YYYY-MM-DDTHH:MM" (no seconds/TZ).
function isoToLocal(iso: string | undefined): string {
  return iso ? iso.slice(0, 16) : ''
}
function localToIso(local: string): string {
  return local ? `${local}:00` : ''
}

function venueAddressOf(event: ContentItem): string {
  const venue = event.entities?.find((e) => e.kind === 'venue')
  return venue?.address ?? ''
}

// A cleared <input type="number"> reports '' and a rejected keystroke reports
// NaN; both land on 0 rather than writing NaN into vibeMin/vibeMax (which
// serialises to JSON null and fails the NOT NULL column).
function clampVibe(raw: string): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(10, Math.round(n)))
}

interface RowState {
  event: ContentItem
  venueAddress: string
  dirty: boolean
  saving: boolean
  status: 'idle' | 'ok' | 'error'
  message?: string
}

function emptyEvent(): ContentItem {
  return {
    id: `new-${crypto.randomUUID()}`,
    slug: '',
    type: 'evento',
    title: '',
    vibeMin: 5,
    vibeMax: 5,
    genres: [],
    tags: [],
    imageUrl: '',
    publishedAt: new Date().toISOString(),
    date: '',
    endDate: '',
    entities: [],
    subjectKind: 'event',
    ticketUrl: '',
    price: '',
    editorial: false,
  }
}

function toRow(event: ContentItem): RowState {
  return {
    event,
    venueAddress: venueAddressOf(event),
    dirty: false,
    saving: false,
    status: 'idle',
  }
}

export function AdminEventsEditor({
  initialEvents,
  initialFilter,
}: {
  initialEvents: ContentItem[]
  /**
   * ?filtro= from the URL. 'proximos' opens the list already narrowed to
   * doors inside 48 hours — the destination of the ATENCIÓN row «EVENTOS EN
   * <48H» on RESUMEN. Without this the row linked to a param nothing read and
   * dropped the operator into 450 unfiltered rows, which is the kind of
   * affordance that looks like it works and does not.
   */
  initialFilter?: string
}) {
  const { currentUser } = useAuth()
  const [rows, setRows] = useState<RowState[]>(() =>
    initialEvents.map(toRow),
  )
  const [draft, setDraft] = useState<RowState>(() => toRow(emptyEvent()))
  const [query, setQuery] = useState('')
  const [proximos, setProximos] = useState(initialFilter === 'proximos')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    // The 48h window is computed once per evaluation, not per row, and it is
    // deliberately the SAME predicate buildAttention() counts with in
    // lib/data/adminStats.ts — if the two drift, the row promises a count the
    // destination cannot show.
    const now = Date.now()
    const horizon = now + 48 * 3_600_000
    return rows.filter((r) => {
      if (proximos) {
        const d = r.event.date ? new Date(r.event.date).getTime() : NaN
        if (!Number.isFinite(d) || d <= now || d >= horizon) return false
      }
      if (!q) return true
      const hay = [
        r.event.title,
        ...(r.event.entities ?? []).map((e) => e.name),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [rows, query, proximos])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2 border-b border-ink pb-2">
        <h2 className="font-syne text-d18 font-extrabold uppercase text-ink">
          Eventos
        </h2>
        <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
          {rows.length} EN EL LIBRO
          {proximos && ` · ${filtered.length} EN <48H`} · EDICIÓN DIRECTA
        </span>
        {/* Latch, not a link: the operator arrives here already filtered from
            the ATENCIÓN queue and needs one obvious way back to the full book
            without losing the page. */}
        <button
          type="button"
          onClick={() => setProximos((v) => !v)}
          aria-pressed={proximos}
          data-cue="latch"
          className={`ml-auto min-h-11 border border-ink px-3 font-mono text-d11 font-bold uppercase tracking-widest transition-colors ${FOCUS_RING} ${
            proximos ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-ink hover:text-paper'
          }`}
        >
          PRÓXIMOS 48H
        </button>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrar…"
          aria-label="Filtrar eventos"
          className={`min-h-11 w-48 border border-ink bg-paper-raised px-3 py-2 font-mono text-d13 text-ink transition-colors placeholder:text-ink-faint focus:bg-white ${FOCUS_RING}`}
        />
      </div>

      {/* New event */}
      <EventRow
        key="__new__"
        row={draft}
        userId={currentUser?.id}
        isNew
        onChange={(next) => setDraft(next)}
        onSaved={(saved) => {
          // Promote the saved draft into the list, reset the draft row.
          setRows((rs) => [toRow(saved), ...rs])
          setDraft(toRow(emptyEvent()))
        }}
      />

      {/* Existing events */}
      <div className="flex flex-col gap-3">
        {filtered.map((row, idx) => {
          // Map filtered index back to the rows array for updates.
          const realIdx = rows.indexOf(row)
          return (
            <EventRow
              key={row.event.id}
              row={row}
              userId={currentUser?.id}
              onChange={(next) =>
                setRows((rs) =>
                  rs.map((r, i) => (i === realIdx ? next : r)),
                )
              }
              onSaved={(saved) =>
                setRows((rs) =>
                  rs.map((r, i) =>
                    i === realIdx ? { ...toRow(saved), status: 'ok' } : r,
                  ),
                )
              }
            />
          )
        })}
        {filtered.length === 0 && (
          <p className="border border-ink bg-paper-raised px-4 py-6 text-center font-mono text-d13 uppercase tracking-widest text-ink-faint">
            SIN EVENTOS QUE COINCIDAN
          </p>
        )}
      </div>
    </div>
  )
}

// ── One editable event row ────────────────────────────────────────────────────

function EventRow({
  row,
  userId,
  isNew,
  onChange,
  onSaved,
}: {
  row: RowState
  userId?: string
  isNew?: boolean
  onChange: (next: RowState) => void
  onSaved: (saved: ContentItem) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const { event } = row

  const patch = (p: Partial<ContentItem>) =>
    onChange({ ...row, event: { ...row.event, ...p }, dirty: true, status: 'idle' })

  const setEntities = (entities: EntityRef[]) =>
    onChange({ ...row, event: { ...row.event, entities }, dirty: true, status: 'idle' })

  const setVenueAddress = (venueAddress: string) =>
    onChange({ ...row, venueAddress, dirty: true, status: 'idle' })

  const onUpload = async (file: File) => {
    if (!userId) return
    setUploading(true)
    const res = await compressAndUploadImage(file, userId)
    setUploading(false)
    if (res.ok) patch({ imageUrl: res.url })
    else onChange({ ...row, status: 'error', message: res.error })
  }

  const save = async () => {
    if (!event.title.trim()) {
      onChange({ ...row, status: 'error', message: 'Falta título' })
      return
    }
    onChange({ ...row, saving: true, status: 'idle' })
    try {
      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, venueAddress: row.venueAddress }),
      })
      const data = await res.json()
      if (!res.ok) {
        onChange({ ...row, saving: false, status: 'error', message: data.error })
        return
      }
      // Reflect the server-resolved id/slug back onto the event — AND the
      // address just written to the venue entity. DIRECCIÓN is not an item
      // column: it persists onto entities.address (migration 0039), so the
      // only copy the row holds is the one inside event.entities, captured
      // when the page was rendered. The parent rebuilds the row with
      // toRow(saved), which re-derives the field from that entity ref, so
      // without this patch the input visibly reverts to the pre-save address
      // the instant the save succeeds. Only the FIRST linked venue is
      // updated, mirroring what the route treats as canonical; with no venue
      // linked there is nowhere to store an address and reverting to '' is
      // the honest outcome.
      const address = row.venueAddress.trim()
      const entities = event.entities ?? []
      const venueIdx = entities.findIndex((e) => e.kind === 'venue')
      onSaved({
        ...event,
        id: data.id,
        slug: data.slug,
        entities:
          venueIdx === -1
            ? entities
            : entities.map((e, i) =>
                i === venueIdx ? { ...e, address: address || undefined } : e,
              ),
      })
    } catch (e) {
      onChange({
        ...row,
        saving: false,
        status: 'error',
        message: e instanceof Error ? e.message : 'Error de red',
      })
    }
  }

  return (
    <div className="border border-ink bg-paper-raised">
      {isNew && (
        <p className="border-b border-ink bg-ink px-4 py-2 font-mono text-d11 font-bold uppercase tracking-widest text-paper">
          NUEVO EVENTO
        </p>
      )}

      <div className="flex flex-col gap-4 p-4">
        {/* Top line: title + image + save */}
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-[200px] flex-1">
            <Label>NOMBRE</Label>
            <input
              type="text"
              value={event.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="Nombre del evento"
              className={inputCls}
            />
          </div>

          {/* Image */}
          <div>
            <Label>IMAGEN</Label>
            <div className="flex items-center gap-2">
              {event.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={event.imageUrl}
                  alt=""
                  className="h-11 w-11 border border-ink object-cover"
                />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center border border-dashed border-ink/45 font-mono text-d11 text-ink-faint">
                  —
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) onUpload(f)
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || !userId}
                className={`inline-flex min-h-11 items-center gap-2 border border-ink px-3 font-mono text-d11 font-bold uppercase tracking-widest text-ink transition-colors hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
              >
                {uploading ? (
                  <Loader2 size={12} className="animate-spin motion-reduce:animate-none" />
                ) : (
                  <Upload size={12} />
                )}
                SUBIR
              </button>
            </div>
          </div>

          <div className="self-end">
            {/* The draft's CREAR is the admin's own primary action — the one
                acid fill-block of the row. A live row's GUARDAR is an ink
                fill: same weight class, no competing accent. */}
            <button
              type="button"
              onClick={save}
              disabled={row.saving || !row.dirty}
              className={`inline-flex min-h-11 items-center gap-2 border border-ink px-4 font-mono text-d13 font-bold uppercase tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                isNew
                  ? 'bg-acid text-ink enabled:hover:bg-ink enabled:hover:text-paper'
                  : 'bg-ink text-paper enabled:hover:bg-paper enabled:hover:text-ink'
              } ${FOCUS_RING}`}
            >
              {row.saving ? (
                <Loader2 size={12} className="animate-spin motion-reduce:animate-none" />
              ) : isNew ? (
                <Plus size={12} />
              ) : (
                <Save size={12} />
              )}
              {isNew ? 'CREAR' : 'GUARDAR'}
            </button>
          </div>
        </div>

        {/* Entity pickers */}
        <div className="grid gap-3 md:grid-cols-3">
          <EntityMultiSelectL kind="artist" value={event.entities ?? []} onChange={setEntities} />
          <EntityMultiSelectL kind="venue" value={event.entities ?? []} onChange={setEntities} />
          <EntityMultiSelectL kind="promoter" value={event.entities ?? []} onChange={setEntities} />
        </div>

        {/* Venue address + schedule + price + ticket + vibe */}
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Field label="DIRECCIÓN (VENUE)">
            <input
              type="text"
              value={row.venueAddress}
              onChange={(e) => setVenueAddress(e.target.value)}
              placeholder="Monterrey 56, Roma Norte"
              className={inputCls}
            />
          </Field>
          <Field label="INICIO">
            <input
              type="datetime-local"
              value={isoToLocal(event.date)}
              onChange={(e) => patch({ date: localToIso(e.target.value) })}
              className={inputCls}
            />
          </Field>
          <Field label="FIN">
            <input
              type="datetime-local"
              value={isoToLocal(event.endDate)}
              onChange={(e) => patch({ endDate: localToIso(e.target.value) })}
              className={inputCls}
            />
          </Field>
          <Field label="PRECIO">
            <input
              type="text"
              value={event.price ?? ''}
              onChange={(e) => patch({ price: e.target.value })}
              placeholder="$300"
              className={inputCls}
            />
          </Field>
          <Field label="LINK COMPRA">
            <input
              type="url"
              value={event.ticketUrl ?? ''}
              onChange={(e) => patch({ ticketUrl: e.target.value })}
              placeholder="https://…"
              className={inputCls}
            />
          </Field>
          {/* Vibe is a BAND (vibeMin ≤ vibeMax), not a point — 131 of the 450
              events carry a genuine range. This used to be one number input
              writing { vibeMin: v, vibeMax: v }, so editing ANY field on a
              banded event (a price, a ticket link) collapsed its grading to a
              point on save. Two bounds, each clamping the other, keep the band
              alive; an ungraded 5/5 event still reads and saves as 5/5. The
              two-thumb VibeFieldL is the richer control but registers window
              pointermove/pointerup listeners per instance — at 450 mounted
              rows that is 900 window listeners firing on every mouse move, so
              this surface takes the numeric register instead. */}
          <Field label="VIBE MÍN">
            <input
              type="number"
              min={0}
              max={10}
              value={event.vibeMin}
              onChange={(e) => {
                const v = clampVibe(e.target.value)
                patch({ vibeMin: v, vibeMax: Math.max(v, event.vibeMax) })
              }}
              className={inputCls}
            />
          </Field>
          <Field label="VIBE MÁX">
            <input
              type="number"
              min={0}
              max={10}
              value={event.vibeMax}
              onChange={(e) => {
                const v = clampVibe(e.target.value)
                patch({ vibeMin: Math.min(v, event.vibeMin), vibeMax: v })
              }}
              className={inputCls}
            />
          </Field>
        </div>

        {row.status === 'error' && (
          <p className="border border-sys-red-paper px-3 py-2 font-mono text-d13 font-bold uppercase tracking-widest text-sys-red-paper">
            ⚠ {row.message ?? 'no se pudo guardar'}
          </p>
        )}
        {row.status === 'ok' && (
          <p className="font-mono text-d13 font-bold uppercase tracking-widest text-ink">
            ✓ GUARDADO
          </p>
        )}
      </div>
    </div>
  )
}

const inputCls = `min-h-11 w-full border border-ink bg-paper px-3 py-2 font-mono text-d13 text-ink transition-colors placeholder:text-ink-faint focus:bg-white ${FOCUS_RING}`

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block font-mono text-d11 uppercase tracking-widest text-ink-soft">
      {children}
    </span>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
