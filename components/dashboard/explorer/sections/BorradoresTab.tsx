'use client'

import { useCallback, useEffect, useState } from 'react'
import { Calendar, Check, Eye, Instagram, MapPin, Pencil, Save, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import type { ContentItem } from '@/lib/types'
import { LivePreview } from '@/components/dashboard/LivePreview'

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
//   - EDITAR   → fix agent-extracted data + set vibe/genres → update_partner_event (0027)
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
// editor's browser timezone.
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
function localInputToIso(local: string): string | null {
  if (!local) return null
  return `${local}:00${CDMX_OFFSET}`
}

// PendingEvent → a ContentItem good enough for EventoOverlay to render in the
// preview. partner events publish with editorial=true (rail + mosaic), so the
// preview sets it to match the live result.
function toContentItem(ev: PendingEvent): ContentItem {
  return {
    id: ev.id,
    slug: ev.slug ?? ev.id,
    type: 'evento',
    title: ev.title,
    subtitle: ev.subtitle ?? undefined,
    excerpt: ev.excerpt ?? undefined,
    vibeMin: (ev.vibeMin ?? 5) as ContentItem['vibeMin'],
    vibeMax: (ev.vibeMax ?? 5) as ContentItem['vibeMax'],
    genres: ev.genres ?? [],
    tags: ev.tags ?? [],
    imageUrl: ev.imageUrl ?? undefined,
    publishedAt: ev.publishedAt ?? new Date().toISOString(),
    date: ev.date ?? undefined,
    endDate: ev.endDate ?? undefined,
    venue: ev.venue ?? undefined,
    venueCity: ev.venueCity ?? undefined,
    artists: ev.artists ?? undefined,
    ticketUrl: ev.ticketUrl ?? undefined,
    price: ev.price ?? undefined,
    elevated: false,
    editorial: true,
    pinned: false,
    partnerKind: (ev.partnerKind ?? undefined) as ContentItem['partnerKind'],
    partnerId: ev.partnerId ?? undefined,
  }
}

const INPUT_CLS =
  'w-full border border-border bg-base px-2 py-1 font-mono text-[11px] text-primary outline-none focus:border-secondary'
const LABEL_CLS = 'font-mono text-[9px] uppercase tracking-widest text-muted'

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
        EDITAR (y ponle vibe + géneros), revisa con VER cómo se verá, y publica — o descarta.
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

function EditPanel({
  ev,
  onSaved,
  onCancel,
}: {
  ev: PendingEvent
  onSaved: () => void | Promise<void>
  onCancel: () => void
}) {
  const [title, setTitle] = useState(ev.title ?? '')
  const [dateLocal, setDateLocal] = useState(isoToLocalInput(ev.date))
  const [endLocal, setEndLocal] = useState(isoToLocalInput(ev.endDate))
  const [venue, setVenue] = useState(ev.venue ?? '')
  const [venueCity, setVenueCity] = useState(ev.venueCity ?? '')
  const [artists, setArtists] = useState((ev.artists ?? []).join('\n'))
  const [price, setPrice] = useState(ev.price ?? '')
  const [ticketUrl, setTicketUrl] = useState(ev.ticketUrl ?? '')
  const [excerpt, setExcerpt] = useState(ev.excerpt ?? '')
  const [genres, setGenres] = useState((ev.genres ?? []).join(', '))
  const [imageUrl, setImageUrl] = useState(ev.imageUrl ?? '')
  const [vibeMin, setVibeMin] = useState(String(ev.vibeMin ?? 5))
  const [vibeMax, setVibeMax] = useState(String(ev.vibeMax ?? 5))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const save = async () => {
    if (!title.trim()) {
      setErr('TÍTULO REQUERIDO')
      return
    }
    if (!dateLocal) {
      setErr('FECHA REQUERIDA')
      return
    }
    setSaving(true)
    setErr(null)
    const supabase = createClient()
    const { data, error } = await supabase.rpc('update_partner_event', {
      p_item_id: ev.id,
      p_title: title.trim(),
      p_subtitle: ev.subtitle ?? '', // preserve — not editable here
      p_excerpt: excerpt.trim(),
      p_date: localInputToIso(dateLocal) as string,
      p_end_date: endLocal ? localInputToIso(endLocal) : null,
      p_venue: venue.trim(),
      p_venue_city: venueCity.trim(),
      p_artists: artists
        .split('\n')
        .map((a) => a.trim())
        .filter(Boolean),
      p_ticket_url: ticketUrl.trim(),
      p_price: price.trim(),
      p_image_url: imageUrl.trim(),
      p_genres: genres
        .split(',')
        .map((g) => g.trim().toLowerCase())
        .filter(Boolean),
      p_vibe_min: Number(vibeMin) || 0,
      p_vibe_max: Number(vibeMax) || 0,
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
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      {err && <p className="font-mono text-[10px] text-sys-red">// {err}</p>}

      <div className="flex flex-col gap-0.5">
        <label className={LABEL_CLS}>Título</label>
        <input className={INPUT_CLS} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-0.5">
          <label className={LABEL_CLS}>Fecha (CDMX)</label>
          <input
            type="datetime-local"
            className={INPUT_CLS}
            value={dateLocal}
            onChange={(e) => setDateLocal(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className={LABEL_CLS}>Fin (opcional)</label>
          <input
            type="datetime-local"
            className={INPUT_CLS}
            value={endLocal}
            onChange={(e) => setEndLocal(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-0.5">
          <label className={LABEL_CLS}>Lugar</label>
          <input className={INPUT_CLS} value={venue} onChange={(e) => setVenue(e.target.value)} />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className={LABEL_CLS}>Ciudad</label>
          <input className={INPUT_CLS} value={venueCity} onChange={(e) => setVenueCity(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-col gap-0.5">
        <label className={LABEL_CLS}>Artistas (uno por línea)</label>
        <textarea
          className={`${INPUT_CLS} min-h-[60px] resize-y`}
          value={artists}
          onChange={(e) => setArtists(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-0.5">
          <label className={LABEL_CLS}>Precio</label>
          <input className={INPUT_CLS} value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className={LABEL_CLS}>Boletos (URL)</label>
          <input className={INPUT_CLS} value={ticketUrl} onChange={(e) => setTicketUrl(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-col gap-0.5">
        <label className={LABEL_CLS}>Descripción</label>
        <textarea
          className={`${INPUT_CLS} min-h-[60px] resize-y`}
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-0.5">
        <label className={LABEL_CLS}>Géneros (separados por coma)</label>
        <input
          className={INPUT_CLS}
          value={genres}
          placeholder="techno, ambient, dub"
          onChange={(e) => setGenres(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-0.5">
          <label className={LABEL_CLS}>Vibe mín (0–10)</label>
          <input
            type="number"
            min={0}
            max={10}
            className={INPUT_CLS}
            value={vibeMin}
            onChange={(e) => setVibeMin(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className={LABEL_CLS}>Vibe máx (0–10)</label>
          <input
            type="number"
            min={0}
            max={10}
            className={INPUT_CLS}
            value={vibeMax}
            onChange={(e) => setVibeMax(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-0.5">
        <label className={LABEL_CLS}>Imagen (URL)</label>
        <input className={INPUT_CLS} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
      </div>

      <div className="mt-1 flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="flex items-center gap-1 border px-3 py-1.5 font-mono text-[10px] tracking-widest transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{ borderColor: 'rgba(96,165,250,0.5)', color: '#60A5FA', background: 'rgba(96,165,250,0.1)' }}
        >
          <Save size={10} strokeWidth={1.5} /> {saving ? 'GUARDANDO…' : 'GUARDAR'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onCancel}
          className="flex items-center gap-1 border border-border px-3 py-1.5 font-mono text-[10px] tracking-widest text-muted transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          <X size={10} strokeWidth={1.5} /> CANCELAR
        </button>
      </div>
    </div>
  )
}
