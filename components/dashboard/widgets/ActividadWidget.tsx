'use client'

// Unified activity from the provider, filtered locally. Comment actions open
// the publication and addressed comment together; offers open their thread.
// Exposed rows become seen after two seconds; mark-all preserves the watermark.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/auth/useAuth'
import { useDashboardData } from '@/components/dashboard/DashboardDataProvider'
import { SmartImage } from '@/components/SmartImage'
import { FOCUS_RING, WidgetFrame } from '@/components/dashboard/grid/WidgetFrame'
import type { DashboardWidgetProps } from '@/components/dashboard/grid/WidgetGrid'
import { dashWidgetDomId } from '@/components/dashboard/shell/StatusStrip'
import {
  countUnreadActivity,
} from '@/components/dashboard/shell/StatusStrip'
import {
  markActivityRowSeen,
  readSeenActivity,
  advanceLastSeenActivity,
  readLastSeenActivity,
  subscribeLastSeenActivity,
} from '@/lib/dashboard/localState'
import { isActivityUnread, type SeenActivity } from '@/lib/dashboard/activityRead'
import { latestActivityTimestamp, type ActivityRow } from '@/lib/dashboard/activity'
import { useOpenItem } from '@/lib/dashboard/openItem'
import type { User } from '@/lib/types'
import { useResolvedUser } from '@/lib/userOverrides'
import { trophyByKey } from '@/lib/trophies'
import { TrophyGlyph } from '@/components/trophies/TrophyGlyphs'
import { publicationTint, relTimeShort } from '@/components/dashboard/widgets/CrearWidget'

export type ActivityFilter = 'all' | 'comments' | 'reactions' | 'offers'

const DWELL_MS = 2_000

const SOURCE_LABEL: Record<ActivityRow['source'], string> = {
  COMENTARIO: 'COMENTARIO',
  FORO: 'FORO',
  REACCION: 'REACCIÓN',
  LOGRO: 'LOGRO',
  OFERTA: 'OFERTA',
}

// ── Row copy («actor · verbo · objetivo») — names, no dates ─────────────────

function rowSentence(row: ActivityRow, actorName: string): string {
  const t = row.targetTitle ? `«${row.targetTitle}»` : ''
  switch (row.kind) {
    case 'comment_on_item':
      return t ? `${actorName} comentó en ${t}` : `${actorName} comentó en tu publicación`
    case 'reply_to_comment':
      return t
        ? `${actorName} respondió a tu comentario en ${t}`
        : `${actorName} respondió a tu comentario`
    case 'reaction': {
      const n = row.count ?? 1
      const people = n === 1 ? `${actorName} reaccionó` : `${actorName} y otras personas reaccionaron`
      return t ? `${people} a tu comentario en ${t}` : `${people} a tu comentario`
    }
    case 'foro_reply':
      return t ? `${actorName} respondió en tu hilo ${t}` : `${actorName} respondió en tu hilo`
    case 'foro_quote':
      return t
        ? `${actorName} citó tu respuesta en ${t}`
        : `${actorName} citó tu respuesta`
    case 'logro':
      return `Trofeo desbloqueado — ${row.targetTitle}`
    case 'oferta':
      return t ? `${actorName} dejó una oferta en ${t}` : `${actorName} dejó una oferta`
  }
}

// ── Identity block — 24px (the smaller revision-2 register) ─────────────────

function RowIdentityBlock({ row, actor }: { row: ActivityRow; actor: User | undefined }) {
  if (row.kind === 'logro') {
    const sigil = trophyByKey(row.trophyKey ?? '')?.sigil ?? '◇'
    return (
      <span
        aria-hidden
        className="flex h-6 w-6 shrink-0 items-center justify-center border border-ink bg-paper font-mono text-d11 text-ink"
      >
        {sigil}
      </span>
    )
  }
  if (actor?.avatarUrl) {
    return (
      <span aria-hidden className="relative block h-6 w-6 shrink-0 overflow-hidden border border-ink">
        <SmartImage src={actor.avatarUrl} alt="" sizes="24px" className="object-cover" />
      </span>
    )
  }
  const initial = (actor?.displayName || actor?.username || '·').charAt(0).toUpperCase()
  return (
    <span
      aria-hidden
      className="flex h-6 w-6 shrink-0 items-center justify-center border border-ink bg-ink font-mono text-d11 uppercase text-paper"
    >
      {initial}
    </span>
  )
}

// ── Single row — 40px, d13, no timestamp ────────────────────────────────────

export function ActivityRowView({
  row,
  onUnavailable,
  large = false,
}: {
  row: ActivityRow
  onUnavailable: () => void
  large?: boolean
}) {
  const router = useRouter()
  const openItem = useOpenItem()
  const actor = useResolvedUser(row.actorId ?? undefined)
  const actorName = actor ? large ? `@${actor.username}` : actor.displayName || `@${actor.username}` : 'Alguien'
  const { published, saves, events, franja } = useDashboardData()
  const publication = [...published, ...saves, ...events].find((item) => item.slug === row.itemSlug)
  const cover = row.imageUrl || publication?.imageUrl || franja?.listings.find((listing) => listing.id === row.listingId)?.images[0]
  const type = row.itemType ?? publication?.type
  const trophy = trophyByKey(row.trophyKey ?? '')
  const sentence = rowSentence(row, actorName)

  const target: 'item' | 'foro' | 'mercado' | null = row.itemSlug
    ? 'item'
    : row.threadId
      ? 'foro'
      : row.kind === 'oferta'
        ? 'mercado'
        : null

  const body = large ? <>
    <span aria-hidden className={`relative flex h-full min-h-24 w-full items-center justify-center overflow-hidden sm:min-h-36 ${type ? publicationTint(type) : row.kind === 'oferta' ? 'bg-publication-news/40' : 'bg-paper'}`}>
      {cover ? <SmartImage src={cover} alt="" sizes="(max-width: 640px) 80px, 220px" className="object-cover" />
        : row.kind === 'logro' && trophy ? <span className="flex h-14 w-14 items-center justify-center border border-ink"><TrophyGlyph trophyKey={trophy.key} /></span>
        : <RowIdentityBlock row={row} actor={actor} />}
    </span>
    <span className="flex min-w-0 flex-col justify-center gap-2 py-3">
      <span className="font-mono text-d11 tracking-widest text-ink-soft">{SOURCE_LABEL[row.source]}</span>
      <span className="font-grotesk text-d15 font-bold leading-snug sm:text-d18">{sentence}</span>
      {row.excerpt && <span className="line-clamp-3 font-grotesk text-d13 leading-relaxed text-ink sm:text-d15">{row.excerpt}</span>}
      <time dateTime={row.createdAt} className="font-mono text-d11 text-ink-soft">{relTimeShort(row.createdAt)}</time>
    </span>
    {target && <span className="col-start-2 mb-2 font-mono text-d13 font-bold sm:col-start-auto sm:mb-0 sm:px-3">VER ↗</span>}
  </> : (
    <>
      <RowIdentityBlock row={row} actor={actor} />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 font-grotesk text-d13 leading-snug text-ink">{sentence}</p>
        {row.excerpt && (
          <p className="truncate font-grotesk text-d11 text-ink-faint">{row.excerpt}</p>
        )}
      </div>
      <span className="shrink-0 font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
        {target ? 'VER' : SOURCE_LABEL[row.source]}
      </span>
    </>
  )

  if (!target) {
    // Informational row — no destination exists, so no control.
    return <div className={large ? "grid grid-cols-[72px_minmax(0,1fr)] gap-x-4 sm:grid-cols-[160px_minmax(0,1fr)] lg:grid-cols-[200px_minmax(0,1fr)]" : "flex min-h-10 items-center gap-2.5 py-0.5"}>{body}</div>
  }

  const onClick = () => {
    if (target === 'foro' && row.threadId) {
      router.push(`/foro?thread=${encodeURIComponent(row.threadId)}`)
      return
    }
    if (target === 'mercado') {
      router.push(`/dashboard?espacio=mercado&tab=ofertas${row.listingId ? `&listing=${encodeURIComponent(row.listingId)}` : ''}`)
      return
    }
    if (row.itemSlug) {
      // The popup: the content overlay opens in place, comments column
      // addressed — responding happens right there (point 11).
      void openItem(row.itemSlug, { commentId: row.commentId }).then((ok) => {
        if (!ok) onUnavailable()
      })
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      data-cue="tick"
      aria-label={`${sentence}. Ver`}
      className={`${large ? 'grid grid-cols-[72px_minmax(0,1fr)] gap-x-4 sm:grid-cols-[160px_minmax(0,1fr)_auto] lg:grid-cols-[200px_minmax(0,1fr)_auto]' : 'flex min-h-14 items-center gap-2.5 py-2'} w-full text-left hover:bg-paper ${FOCUS_RING}`}
    >
      {body}
    </button>
  )
}

// Read only the row actually exposed, including clipping inside the list.
function ActivityExposure({ row, uid, unread, children, large = false }: { row: ActivityRow; uid: string | null; unread: boolean; children: ReactNode; large?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!uid || !unread || !ref.current) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let visible = false
    const update = () => {
      clearTimeout(timer)
      if (visible && document.visibilityState === 'visible') timer = setTimeout(() => markActivityRowSeen(uid, row.key, row.createdAt), DWELL_MS)
    }
    const observer = new IntersectionObserver(([entry]) => { visible = entry.intersectionRatio >= 0.75; update() }, { threshold: [0, 0.75, 1] })
    observer.observe(ref.current)
    document.addEventListener('visibilitychange', update)
    return () => { observer.disconnect(); clearTimeout(timer); document.removeEventListener('visibilitychange', update) }
  }, [uid, unread, row.key, row.createdAt])
  return <div ref={ref} className={`flex items-center gap-2 border-b border-ink/20 last:border-b-0 ${large ? `py-3 ${unread ? 'bg-publication-text/15' : ''}` : ''}`}>
    <span aria-label={unread ? 'Sin leer' : 'Leído'} className={`h-1.5 w-1.5 shrink-0 ${unread ? 'border border-ink bg-acid' : 'bg-transparent'}`} />
    <div className="min-w-0 flex-1">{children}</div>
  </div>
}

// ── The widget ──────────────────────────────────────────────────────────────

export function ActividadWidget({ size, full = false, embedded = false, activityFilter }: DashboardWidgetProps & { full?: boolean; embedded?: boolean; activityFilter?: ActivityFilter }) {
  const router = useRouter()
  const { currentUser } = useAuth()
  const { activity, engagement, loaded, errors, afterMutation } = useDashboardData()
  const uid = currentUser?.id ?? null
  const [localFilter, setFilter] = useState<ActivityFilter>('all')
  const filter = activityFilter ?? localFilter
  const [seen, setSeen] = useState<SeenActivity>({})
  const [watermark, setWatermark] = useState<string | null>(null)
  useEffect(() => {
    if (!uid) { setWatermark(null); setSeen({}); return }
    const sync = () => { setWatermark(readLastSeenActivity(uid)); setSeen(readSeenActivity(uid)) }
    sync()
    return subscribeLastSeenActivity(sync)
  }, [uid])
  const unread = countUnreadActivity(activity, watermark, seen)
  const latestTs = latestActivityTimestamp(activity)
  const [notice, setNotice] = useState(false)
  const filtered = activity.filter((row) => filter === 'comments' ? ['COMENTARIO', 'FORO'].includes(row.source)
    : filter === 'reactions' ? row.source === 'REACCION' : filter === 'offers' ? row.source === 'OFERTA' : true)
  const cap = full ? filtered.length : size.h >= 4 ? 4 : 2
  const visible = filtered.slice(0, cap)
  const action = full && unread > 0 && uid && latestTs
    ? { label: 'MARCAR VISTO', onClick: () => advanceLastSeenActivity(uid, latestTs) }
    : { label: 'VER TODO', onClick: () => router.push('/dashboard?espacio=recepcion') }

  const feed = <div className="flex min-h-0 flex-col gap-2">
    {embedded && unread > 0 && uid && latestTs && <div className="flex justify-end"><button type="button" onClick={() => advanceLastSeenActivity(uid, latestTs)} className={`min-h-11 font-mono text-d11 underline ${FOCUS_RING}`}>MARCAR TODO COMO VISTO</button></div>}
    {notice && <p role="status" className="font-mono text-d13">No se pudo abrir esta publicación. Inténtalo de nuevo.</p>}
    <div className={full ? '' : 'min-h-0 flex-1 overflow-y-auto'}>
      {visible.map((row) => <ActivityExposure key={row.key} row={row} uid={uid} unread={isActivityUnread(row, watermark, seen)} large={embedded}>
        <ActivityRowView row={row} large={embedded} onUnavailable={() => setNotice(true)} />
      </ActivityExposure>)}
      {!visible.length && <p role="status" className="py-12 font-grotesk text-d15 text-ink-soft">{!loaded.activity && !errors.activity ? 'Cargando actividad…' : errors.activity ? 'No se pudo cargar la actividad.' : 'Todavía no hay actividad en esta sección.'}</p>}
      {errors.activity && <button type="button" onClick={() => void afterMutation()} className={`min-h-11 font-mono text-d13 underline ${FOCUS_RING}`}>REINTENTAR</button>}
    </div>
  </div>
  if (embedded) return <section aria-label="Actividad reciente" className="min-w-0">{feed}</section>

  return <div id={dashWidgetDomId('actividad')} className="h-full scroll-mt-14">
    <WidgetFrame title="ACTIVIDAD" count={unread || undefined} accent action={full && !unread ? undefined : action}>
      <div className="flex h-full min-h-0 flex-col gap-2">
        <nav className="flex shrink-0 flex-wrap gap-x-3" aria-label="Filtrar actividad">
          {([['all', 'TODO'], ['comments', 'COMENTARIOS'], ['reactions', 'REACCIONES'], ['offers', 'OFERTAS']] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)} className={`min-h-9 border-b-2 font-mono text-d11 ${filter === key ? 'border-ink font-bold text-ink' : 'border-transparent text-ink-soft'} ${FOCUS_RING}`}>{label}</button>)}
          <Link href="/dashboard?espacio=recepcion&activity=hp" className={`flex min-h-9 items-center font-mono text-d11 text-hp ${FOCUS_RING}`}>HP</Link>
          <Link href="/dashboard?espacio=recepcion&activity=sales" className={`flex min-h-9 items-center font-mono text-d11 ${FOCUS_RING}`}>VENTAS</Link>
        </nav>
        {filter === 'all' && engagement && <Link href="/dashboard?espacio=recepcion&activity=hp" className={`flex min-h-14 items-center justify-between gap-3 border-b border-ink/15 py-2 ${FOCUS_RING}`}>
          <span className="font-grotesk text-d13 text-ink">Tu presencia <strong className="ml-2 font-mono text-hp">{engagement.hp.toFixed(1)} HP</strong></span><span className="font-mono text-d11 font-bold">VER</span>
        </Link>}
        <div className="min-h-0 flex-1 overflow-y-auto">{feed}</div>
        {!full && filtered.length > cap && <Link href="/dashboard?espacio=recepcion" className={`flex min-h-9 shrink-0 items-center justify-between border-t border-ink/25 font-mono text-d11 ${FOCUS_RING}`}>VER TODA LA ACTIVIDAD <span>→</span></Link>}
      </div>
    </WidgetFrame>
  </div>
}
