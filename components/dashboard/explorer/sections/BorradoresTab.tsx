'use client'

import { useCallback, useEffect, useState } from 'react'
import { Calendar, Check, Eye, Instagram, MapPin, Pencil, Save, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import type { ContentItem } from '@/lib/types'
import { LivePreview } from '@/components/dashboard/LivePreview'
import {
  Section,
  TextField,
  TextArea,
  StringListField,
  VibeField,
  GenreMultiSelect,
  ImageUrlField,
} from '@/components/dashboard/forms/shared/Fields'

// MiPartnerSection → BORRADORES tab. Lists the partner's PENDING Instagram
// events (source='scraper:instagram', published=false) — the ones the agent
// extracted from the partner's IG and dropped here for review. Team-shared by
// nature: it queries by partner_id, so any team member sees them (the
// items_partner_team_read RLS policy in migration 0026 gates the read).
//
// Three actions, all through SECURITY-DEFINER RPCs that re-check partner
// membership server-side (so any team member — not just the creator — can act,
// and none of it depends on the items RLS update policy):
//   - VER      → preview the real EventoOverlay via <LivePreview> (no write)
//   - EDITAR   → the SAME field components as the events composer (Section /
//                TextField / VibeField / GenreMultiSelect / ImageUrlField + a
//                LivePreview), saving via update_partner_event (0027)
//   - PUBLICAR → publish_partner_event (0026); DESCARTAR → discard_partner_event (0026)
// Editing keeps source='scraper:instagram', so the (source, external_id) dedup
// key survives — re-scrapes still recognize the post.
interface PendingEvent {
  id: string
  slug: string | null
  title: string
  subtitle: string | null
  excerpt: string | null
  date: string | null
  endDate: string | null
  venue: string | null
  venueCity: string | null
  artists: string[] | null
  ticketUrl: string | null
  price: string | null
  imageUrl: string | null
  vibeMin: number | null
  vibeMax: number | null
  genres: string[] | null
  tags: string[] | null
  partnerId: string | null
  partnerKind: string | null
  publishedAt: string | null
}

const SELECT =
  'id, slug, title, subtitle, excerpt, date, end_date, venue, venue_city, artists, ticket_url, price, image_url, vibe_min, vibe_max, genres, tags, partner_id, partner_kind, published_at'

// CDMX is -06:00 year-round (Mexico dropped DST in 2022), matching how the
// scraper stamps event times. Convert a stored ISO ↔ the wall-clock a
// <input type="datetime-local"> wants, pinned to CDMX regardless of the
// editor's browser timezone. (The composer's own isoToLocal slices naively,
// which is correct for composer-authored naive-local strings but NOT for these
// UTC-stamped scraped rows — so BORRADORES keeps its own CDMX-aware pair.)
const CDMX_OFFSET = '-06:00'
function isoToLocalInput(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso)
      .toLocaleString('sv-SE', { timeZone: 'America/Mexico_City' })
      .slice(0, 16)
      .replace(' ', 'T')
  } catch {
    return ''
  }
}
function localInputToIso(local: string): string {
  if (!local) return ''
  return `${local}:00${CDMX_OFFSET}`
}

// PendingEvent / draft → a ContentItem good enough for EventoOverlay to render
// in the preview. partner events publish with editorial=true (rail + mosaic),
// so the preview sets it to match the live result.
function toContentItem(
  src: {
    id: string
    slug: string | null
    title: string
    subtitle?: string | null
    excerpt?: string | null
    vibeMin?: number | null
    vibeMax?: number | null
    genres?: string[] | null
    tags?: string[] | null
    imageUrl?: string | null
    publishedAt?: string | null
    date?: string | null
    endDate?: string | null
    venue?: string | null
    venueCity?: string | null
    artists?: string[] | null
    ticketUrl?: string | null
    price?: string | null
    partnerKind?: string | null
    partnerId?: string | null
  },
): ContentItem {
  return {
    id: src.id,
    slug: src.slug ?? src.id,
    type: 'evento',
    title: src.title,
    subtitle: src.subtitle ?? undefined,
    excerpt: src.excerpt ?? undefined,
    vibeMin: (src.vibeMin ?? 5) as ContentItem['vibeMin'],
    vibeMax: (src.vibeMax ?? 5) as ContentItem['vibeMax'],
    genres: src.genres ?? [],
    tags: src.tags ?? [],
    imageUrl: src.imageUrl ?? undefined,
    publishedAt: src.publishedAt ?? new Date().toISOString(),
    date: src.date ?? undefined,
    endDate: src.endDate ?? undefined,
    venue: src.venue ?? undefined,
    venueCity: src.venueCity ?? undefined,
    artists: src.artists ?? undefined,
    ticketUrl: src.ticketUrl ?? undefined,
    price: src.price ?? undefined,
    elevated: false,
    editorial: true,
    pinned: false,
    partnerKind: (src.partnerKind ?? undefined) as ContentItem['partnerKind'],
    partnerId: src.partnerId ?? undefined,
  }
}

export function BorradoresTab({ partnerId }: { partnerId: string }) {
  const [events, setEvents] = useState<PendingEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Which event has an open panel, and which kind.
  const [open, setOpen] = useState<{ id: string; kind: 'edit' | 'preview' } | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data, error: e } = await supabase
      .from('items')
      .select(SELECT)
      .eq('partner_id', partnerId)
      .eq('source', 'scraper:instagram')
      .eq('published', false)
      .order('date', { ascending: true })
    if (e) {
      setError(e.message.toUpperCase())
    } else {
      setEvents(
        (data ?? []).map((r) => ({
          id: r.id,
          slug: r.slug,
          title: r.title,
          subtitle: r.subtitle,
          excerpt: r.excerpt,
          date: r.date,
          endDate: r.end_date,
          venue: r.venue,
          venueCity: r.venue_city,
          artists: r.artists,
          ticketUrl: r.ticket_url,
          price: r.price,
          imageUrl: r.image_url,
          vibeMin: r.vibe_min,
          vibeMax: r.vibe_max,
          genres: r.genres,
          tags: r.tags,
          partnerId: r.partner_id,
          partnerKind: r.partner_kind,
          publishedAt: r.published_at,
        })),
      )
    }
    setLoading(false)
  }, [partnerId])

  useEffect(() => {
    void load()
  }, [load])

  const act = async (id: string, action: 'publish' | 'discard') => {
    setBusy(id)
    setError(null)
    const supabase = createClient()
    const fn = action === 'publish' ? 'publish_partner_event' : 'discard_partner_event'
    const { data, error: e } = await supabase.rpc(fn, { p_item_id: id })
    const r = data as unknown as { ok: boolean; error?: string } | null
    if (e || !r?.ok) {
      setError((e?.message ?? r?.error ?? 'FALLÓ').toString().toUpperCase())
      setBusy(null)
      return
    }
    setOpen(null)
    await load()
    setBusy(null)
  }

  const toggle = (id: string, kind: 'edit' | 'preview') =>
    setOpen((cur) => (cur && cur.id === id && cur.kind === kind ? null : { id, kind }))

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex flex-wrap items-center gap-2 border bg-elevated/30 px-3 py-2 font-mono text-[10px] tracking-widest"
        style={{ borderColor: '#E1306C', color: '#E1306C' }}
      >
        <Instagram size={12} strokeWidth={1.5} />
        <span>//INSTAGRAM · BORRADORES</span>
        <span className="text-muted">· Revisa, edita y publica — o descarta.</span>
      </div>

      {error && <p className="font-mono text-[10px] text-sys-red">// {error}</p>}

      {loading ? (
        <div className="border border-dashed border-border bg-elevated/30 px-4 py-8 font-mono text-[11px] text-muted">
          //CARGANDO…
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-start gap-1 border border-dashed border-border bg-elevated/30 px-4 py-8 font-mono text-[11px] text-muted">
          <span className="tracking-widest" style={{ color: '#3a3a3a' }}>
            ◇ SIN BORRADORES
          </span>
          <p>No hay eventos pendientes desde Instagram. Aparecerán aquí tras la próxima sincronización.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {events.map((ev) => (
            <li key={ev.id} className="flex flex-col gap-2 border border-border bg-elevated/30 p-2">
              <div className="flex gap-3">
                <div className="h-20 w-20 shrink-0 overflow-hidden border border-border bg-base">
                  {ev.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ev.imageUrl} alt="" className="h-full w-full object-cover object-top" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="truncate font-syne text-sm font-bold text-primary">{ev.title}</p>
                  <p className="flex items-center gap-1 font-mono text-[10px] text-muted">
                    <Calendar size={10} strokeWidth={1.5} />
                    {ev.date ? format(parseISO(ev.date), "d MMM yyyy · HH:mm", { locale: es }) : 'sin fecha'}
                  </p>
                  {(ev.venue || ev.venueCity) && (
                    <p className="flex items-center gap-1 truncate font-mono text-[10px] text-muted">
                      <MapPin size={10} strokeWidth={1.5} />
                      {[ev.venue, ev.venueCity].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {ev.artists && ev.artists.length > 0 && (
                    <p className="truncate font-mono text-[10px] text-secondary">{ev.artists.join(' · ')}</p>
                  )}
                  {ev.price && <p className="font-mono text-[10px] text-muted">{ev.price}</p>}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-1.5">
                <ActionButton
                  active={open?.id === ev.id && open.kind === 'preview'}
                  onClick={() => toggle(ev.id, 'preview')}
                  color="#9CA3AF"
                  icon={<Eye size={10} strokeWidth={1.5} />}
                  label="VER"
                />
                <ActionButton
                  active={open?.id === ev.id && open.kind === 'edit'}
                  onClick={() => toggle(ev.id, 'edit')}
                  color="#60A5FA"
                  icon={<Pencil size={10} strokeWidth={1.5} />}
                  label="EDITAR"
                />
                <ActionButton
                  disabled={busy === ev.id}
                  onClick={() => act(ev.id, 'publish')}
                  color="#4ADE80"
                  icon={<Check size={10} strokeWidth={1.5} />}
                  label="PUBLICAR"
                />
                <ActionButton
                  disabled={busy === ev.id}
                  onClick={() => act(ev.id, 'discard')}
                  color="#F87171"
                  icon={<X size={10} strokeWidth={1.5} />}
                  label="DESCARTAR"
                />
              </div>

              {open?.id === ev.id && open.kind === 'edit' && (
                <EditPanel
                  ev={ev}
                  onCancel={() => setOpen(null)}
                  onSaved={async () => {
                    setOpen(null)
                    await load()
                  }}
                />
              )}
              {open?.id === ev.id && open.kind === 'preview' && (
                <div className="border-t border-border pt-3">
                  <LivePreview draft={toContentItem(ev)} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="font-mono text-[10px] leading-relaxed text-muted">
        Estos eventos los extrae el agente desde el Instagram del partner. Corrige lo que esté mal con
        EDITAR (mismo editor que el compositor de eventos), revisa con VER cómo se verá, y publica — o descarta.
      </p>
    </div>
  )
}

function ActionButton({
  onClick,
  color,
  icon,
  label,
  active = false,
  disabled = false,
}: {
  onClick: () => void
  color: string
  icon: React.ReactNode
  label: string
  active?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex items-center gap-1 border px-2 py-1 font-mono text-[10px] tracking-widest transition-opacity hover:opacity-80 disabled:opacity-40"
      style={{
        borderColor: active ? color : `${color}80`,
        color,
        background: active ? `${color}1A` : 'transparent',
      }}
    >
      {icon} {label}
    </button>
  )
}

// Same field components + layout as the events composer (EventoForm) — Sections
// on the left, a sticky LivePreview on the right — but the save routes through
// the update_partner_event RPC (pending partner event, source unchanged) instead
// of the publish workbench.
interface EditDraft {
  title: string
  subtitle: string
  date: string
  endDate: string
  venue: string
  venueCity: string
  artists: string[]
  ticketUrl: string
  price: string
  excerpt: string
  imageUrl: string
  vibeMin: number
  vibeMax: number
  genres: string[]
}

function EditPanel({
  ev,
  onSaved,
  onCancel,
}: {
  ev: PendingEvent
  onSaved: () => void | Promise<void>
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<EditDraft>(() => ({
    title: ev.title ?? '',
    subtitle: ev.subtitle ?? '',
    date: ev.date ?? '',
    endDate: ev.endDate ?? '',
    venue: ev.venue ?? '',
    venueCity: ev.venueCity ?? '',
    artists: ev.artists ?? [],
    ticketUrl: ev.ticketUrl ?? '',
    price: ev.price ?? '',
    excerpt: ev.excerpt ?? '',
    imageUrl: ev.imageUrl ?? '',
    vibeMin: ev.vibeMin ?? 5,
    vibeMax: ev.vibeMax ?? 5,
    genres: ev.genres ?? [],
  }))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const patch = (p: Partial<EditDraft>) => setDraft((d) => ({ ...d, ...p }))

  const previewItem = toContentItem({
    id: ev.id,
    slug: ev.slug,
    tags: ev.tags,
    publishedAt: ev.publishedAt,
    partnerKind: ev.partnerKind,
    partnerId: ev.partnerId,
    ...draft,
  })

  const save = async () => {
    if (!draft.title.trim()) {
      setErr('FALTA EL TÍTULO')
      return
    }
    if (!draft.date) {
      setErr('FALTA LA FECHA DE INICIO')
      return
    }
    setSaving(true)
    setErr(null)
    const supabase = createClient()
    const { data, error } = await supabase.rpc('update_partner_event', {
      p_item_id: ev.id,
      p_title: draft.title.trim(),
      p_subtitle: draft.subtitle.trim(),
      p_excerpt: draft.excerpt.trim(),
      p_date: draft.date,
      p_end_date: draft.endDate || null,
      p_venue: draft.venue.trim(),
      p_venue_city: draft.venueCity.trim(),
      p_artists: draft.artists.map((a) => a.trim()).filter(Boolean),
      p_ticket_url: draft.ticketUrl.trim(),
      p_price: draft.price.trim(),
      p_image_url: draft.imageUrl.trim(),
      p_genres: draft.genres.map((g) => g.trim().toLowerCase()).filter(Boolean),
      p_vibe_min: draft.vibeMin,
      p_vibe_max: draft.vibeMax,
    })
    const r = data as unknown as { ok: boolean; error?: string } | null
    if (error || !r?.ok) {
      setErr((error?.message ?? r?.error ?? 'FALLÓ').toString().toUpperCase())
      setSaving(false)
      return
    }
    setSaving(false)
    await onSaved()
  }

  return (
    <div className="border-t border-border pt-3">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-4">
          {err && <p className="font-mono text-[10px] text-sys-red">// {err}</p>}

          <Section label="01" title="IDENTIDAD">
            <TextField label="TÍTULO" value={draft.title} onChange={(v) => patch({ title: v })} required />
            <TextField
              label="SUBTÍTULO"
              value={draft.subtitle}
              onChange={(v) => patch({ subtitle: v })}
              placeholder="Club Japan · Roma Norte"
            />
          </Section>

          <Section label="02" title="FECHAS">
            <TextField
              label="INICIO (CDMX)"
              type="datetime-local"
              mono
              required
              value={isoToLocalInput(draft.date)}
              onChange={(v) => patch({ date: localInputToIso(v) })}
            />
            <TextField
              label="FIN (opcional)"
              type="datetime-local"
              mono
              value={isoToLocalInput(draft.endDate)}
              onChange={(v) => patch({ endDate: localInputToIso(v) })}
            />
          </Section>

          <Section label="03" title="UBICACIÓN">
            <TextField label="VENUE" value={draft.venue} onChange={(v) => patch({ venue: v })} placeholder="Club Japan" />
            <TextField
              label="CIUDAD / DIRECCIÓN"
              value={draft.venueCity}
              onChange={(v) => patch({ venueCity: v })}
              placeholder="CDMX · Roma Norte"
            />
          </Section>

          <Section label="04" title="LINE-UP">
            <StringListField
              label="ARTISTAS"
              placeholder="Surgeon"
              values={draft.artists}
              onChange={(artists) => patch({ artists })}
              addLabel="AÑADIR ARTISTA"
            />
          </Section>

          <Section label="05" title="DESCRIPCIÓN">
            <TextArea
              label="DESCRIPCIÓN"
              value={draft.excerpt}
              onChange={(v) => patch({ excerpt: v })}
              rows={5}
              placeholder="La parte descriptiva del evento — el concepto, la vibra…"
            />
          </Section>

          <Section label="06" title="VIBE + GÉNEROS">
            <VibeField
              valueMin={draft.vibeMin}
              valueMax={draft.vibeMax}
              onChange={(min, max) => patch({ vibeMin: min, vibeMax: max })}
            />
            <GenreMultiSelect value={draft.genres} onChange={(genres) => patch({ genres })} />
          </Section>

          <Section label="07" title="MEDIA + BOLETOS">
            <ImageUrlField
              label="FLYER"
              value={draft.imageUrl}
              onChange={(v) => patch({ imageUrl: v })}
              placeholder="Sube un archivo o pega una URL"
            />
            <TextField
              label="TICKET URL"
              value={draft.ticketUrl}
              onChange={(v) => patch({ ticketUrl: v })}
              mono
              placeholder="https://..."
            />
            <TextField
              label="PRECIO"
              value={draft.price}
              onChange={(v) => patch({ price: v })}
              placeholder="Primeras 100 gratis · general $350"
            />
          </Section>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="flex items-center gap-1.5 border px-4 py-2 font-mono text-[11px] tracking-widest transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ borderColor: 'rgba(96,165,250,0.5)', color: '#60A5FA', background: 'rgba(96,165,250,0.12)' }}
            >
              <Save size={12} strokeWidth={1.5} /> {saving ? 'GUARDANDO…' : 'GUARDAR'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={onCancel}
              className="flex items-center gap-1.5 border border-border px-4 py-2 font-mono text-[11px] tracking-widest text-muted transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              <X size={12} strokeWidth={1.5} /> CANCELAR
            </button>
          </div>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <LivePreview draft={previewItem} />
        </div>
      </div>
    </div>
  )
}
