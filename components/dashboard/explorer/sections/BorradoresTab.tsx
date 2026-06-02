'use client'

import { useCallback, useEffect, useState } from 'react'
import { Calendar, Check, Instagram, MapPin, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'

// MiPartnerSection → BORRADORES tab. Lists the partner's PENDING Instagram
// events (source='scraper:instagram', published=false) — the ones the agent
// extracted from the partner's IG and dropped here for review. Team-shared by
// nature: it queries by partner_id, so any team member sees them (the
// items_partner_team_read RLS policy in migration 0026 gates the read). PUBLICAR
// / DESCARTAR go through the SECURITY-DEFINER RPCs (also 0026), which re-check
// partner membership server-side. Empty until a scraping run lands events.
interface PendingEvent {
  id: string
  title: string
  date: string | null
  venue: string | null
  venueCity: string | null
  artists: string[] | null
  price: string | null
  imageUrl: string | null
}

export function BorradoresTab({ partnerId }: { partnerId: string }) {
  const [events, setEvents] = useState<PendingEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data, error: e } = await supabase
      .from('items')
      .select('id, title, date, venue, venue_city, artists, price, image_url')
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
          title: r.title,
          date: r.date,
          venue: r.venue,
          venueCity: r.venue_city,
          artists: r.artists,
          price: r.price,
          imageUrl: r.image_url,
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
    await load()
    setBusy(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex flex-wrap items-center gap-2 border bg-elevated/30 px-3 py-2 font-mono text-[10px] tracking-widest"
        style={{ borderColor: '#E1306C', color: '#E1306C' }}
      >
        <Instagram size={12} strokeWidth={1.5} />
        <span>//INSTAGRAM · BORRADORES</span>
        <span className="text-muted">· Verifica los datos y publica, o descarta.</span>
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
            <li key={ev.id} className="flex gap-3 border border-border bg-elevated/30 p-2">
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
                  <p className="truncate font-mono text-[10px] text-secondary">
                    {ev.artists.join(' · ')}
                  </p>
                )}
                {ev.price && <p className="font-mono text-[10px] text-muted">{ev.price}</p>}
              </div>
              <div className="flex shrink-0 flex-col gap-1.5">
                <button
                  type="button"
                  disabled={busy === ev.id}
                  onClick={() => act(ev.id, 'publish')}
                  className="flex items-center gap-1 border px-2 py-1 font-mono text-[10px] tracking-widest transition-opacity hover:opacity-80 disabled:opacity-40"
                  style={{ borderColor: 'rgba(74,222,128,0.5)', color: '#4ADE80' }}
                >
                  <Check size={10} strokeWidth={1.5} /> PUBLICAR
                </button>
                <button
                  type="button"
                  disabled={busy === ev.id}
                  onClick={() => act(ev.id, 'discard')}
                  className="flex items-center gap-1 border px-2 py-1 font-mono text-[10px] tracking-widest transition-opacity hover:opacity-80 disabled:opacity-40"
                  style={{ borderColor: 'rgba(248,113,113,0.4)', color: '#F87171' }}
                >
                  <X size={10} strokeWidth={1.5} /> DESCARTAR
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="font-mono text-[10px] leading-relaxed text-muted">
        Estos eventos los extrae el agente desde el Instagram del partner. Si un dato está mal,
        descártalo — o publícalo y corrígelo después con la edición normal del evento.
      </p>
    </div>
  )
}
