'use client'

// The Franja workspace: publication gallery, agenda, profile and team.
// Existing profile autosave and team permission gates remain authoritative.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

import { useAuth } from '@/components/auth/useAuth'
import { useDashboardData } from '@/components/dashboard/DashboardDataProvider'
import { isComposeType, useComposeNav } from '@/components/dashboard/widgets/cultivar/CrearZone'
import {
  Chip,
  EmptyLine,
  ErrorLine,
  FOCUS_RING,
  InkButton,
  MarginNote,
  Row,
  Sheet,
  ShimmerLine,
} from '@/components/dashboard/espacios/kit'
import { usePrompt } from '@/components/prompt/usePrompt'
import { SmartImage } from '@/components/SmartImage'
import { useOpenItem } from '@/lib/dashboard/openItem'
import { publicationTint } from '@/components/dashboard/widgets/CrearWidget'
import { publicationLabel } from '@/lib/dashboard/publications'
import { setPublishedItemLocal } from '@/lib/publishedItemsCache'
import { useFranjaPublications } from '@/components/dashboard/espacios/useFranjaPublications'
import { useSearchParams } from 'next/navigation'
import { compressAndUploadImage } from '@/lib/imageUpload'
import {
  FRANJA_PUBLISHABLE_TYPES,
  canCreateContent,
  canManageFranjaTeam,
} from '@/lib/permissions'
import type { ContentItem, ContentType, FranjaKind, Role, User } from '@/lib/types'
import {
  ADD_BUSY_KEY,
  useFranjaTeam,
  type FranjaTeamMember,
} from '@/components/dashboard/espacios/useFranjaTeam'

// ── Constants ───────────────────────────────────────────────────────────────

type FranjaView = 'publicaciones' | 'equipo' | 'perfil'
type CollectionFilter = 'all' | 'published' | 'draft' | 'upcoming' | 'past'
type CollectionSort = 'date' | 'title' | 'type'

const DEBOUNCE_MS = 600
const MAX_DESC_LEN = 600
const MAX_LOCATION_LEN = 120
const MAX_URL_LEN = 300

/** The 10 franja kinds. A value outside this set is data we cannot label. */
const FRANJA_KINDS: readonly FranjaKind[] = [
  'label',
  'promoter',
  'venue',
  'dealer',
  'colectivo',
  'festival',
  'club',
  'medios',
  'mix-series',
  'plataforma',
]

const FRANJA_KIND_LABELS: Record<FranjaKind, string> = {
  label: 'SELLO',
  promoter: 'PROMOTORA',
  venue: 'RECINTO',
  dealer: 'DEALER',
  colectivo: 'COLECTIVO',
  festival: 'FESTIVAL',
  club: 'CLUB',
  medios: 'MEDIOS',
  'mix-series': 'SERIE DE MIXES',
  plataforma: 'PLATAFORMA',
}

const ROLE_LABELS: Record<Role, string> = {
  user: 'USUARIO',
  curator: 'CURADOR',
  guide: 'GUÍA',
  insider: 'INSIDER',
  admin: 'ADMIN DEL SITIO',
}

// ── Small honest helpers ────────────────────────────────────────────────────

/** Epoch ms, 0 when the stamp is missing or unparseable (never NaN in a sort). */
function tsOf(iso: string | undefined | null): number {
  if (!iso) return 0
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : 0
}

function dateLabel(iso: string | undefined | null): string {
  if (!iso) return '—'
  try {
    return format(parseISO(iso), 'd MMM yyyy', { locale: es }).toUpperCase()
  } catch {
    return '—'
  }
}

function kindOf(raw: string | null | undefined): FranjaKind | null {
  return raw && (FRANJA_KINDS as readonly string[]).includes(raw) ? (raw as FranjaKind) : null
}

/** Start of today, local — the same boundary the provider's events query uses. */
function startOfTodayMs(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/**
 * The author line. `item.author` is the free-text byline the composer writes;
 * when it is missing but the row is demonstrably the viewer's own (created_by
 * matches), use the viewer's handle. Omit unknown bylines.
 */
function authorLabel(item: ContentItem, me: User | null): string {
  if (item.author) return item.author
  if (me && item.createdById && item.createdById === me.id) return `@${me.username}`
  return ''
}

// ── Monogram plate ──────────────────────────────────────────────────────────

/** Real image when there is one, the first letter when there is not. */
function Plate({
  src,
  alt,
  label,
  size,
  sizes,
}: {
  src: string | null | undefined
  alt: string
  label: string
  size: string
  sizes: string
}) {
  return (
    <span
      className={`relative block shrink-0 overflow-hidden border border-ink bg-paper-raised ${size}`}
    >
      {src ? (
        <SmartImage src={src} alt={alt} className="object-cover" sizes={sizes} />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-syne text-d18 font-extrabold uppercase text-ink-faint">
          {label.slice(0, 1) || '·'}
        </span>
      )}
    </span>
  )
}

interface ObraRow {
  key: string
  item: ContentItem
  state: 'draft' | 'published'
  at: number
  upcoming: boolean
}

function IdentityHead({ title, slug, imageUrl, kind, location, onEdit }: {
  title: string; slug: string; imageUrl: string; kind: FranjaKind | null
  location: string | null; onEdit: () => void
}) {
  return <header className="flex flex-wrap items-center gap-4 border-b border-ink/30 pb-5 md:gap-6">
    <div className="relative h-20 w-20 shrink-0 sm:h-28 sm:w-28">
      {imageUrl ? <SmartImage src={imageUrl} alt={title} className="object-contain" sizes="112px" />
        : <span className="flex h-full items-center justify-center bg-publication-news font-syne text-4xl font-bold">{title.charAt(0)}</span>}
    </div>
    <div className="min-w-0 flex-1">
      <h2 className="break-words font-syne text-d28 font-extrabold uppercase leading-tight md:text-4xl">{title}</h2>
      <p className="mt-2 font-mono text-d13 text-ink-soft">{[kind && FRANJA_KIND_LABELS[kind], location].filter(Boolean).join(' · ')}</p>
    </div>
    <div className="flex w-full flex-wrap gap-2 sm:w-auto">
      <InkButton href={`/f/${slug}`} external>VER FRANJA</InkButton>
      <InkButton onClick={onEdit}>EDITAR PERFIL</InkButton>
    </div>
  </header>
}

// ── Profile editor ──────────────────────────────────────────────────────────
//
// The document-at-rest interaction ported from IdentitySpine: set ink text at
// rest, an EDITAR whisper on hover/focus, ONE debounced PATCH 600ms after the
// last keystroke through the pendingRef the spine uses. The fields are the
// four the franja route whitelists for a team member — franja_url, image_url,
// marketplace_description, marketplace_location. `marketplace_enabled` and
// `marketplace_currency` are deliberately ABSENT: they belong to MERCADO, and
// two sheets writing the same lever is how a lever gets fought over.

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface ProfileFields {
  description: string
  location: string
  url: string
}

function fieldsFromFranja(f: {
  marketplaceDescription: string | null
  marketplaceLocation: string | null
  franjaUrl: string | null
} | null): ProfileFields {
  return {
    description: f?.marketplaceDescription ?? '',
    location: f?.marketplaceLocation ?? '',
    url: f?.franjaUrl ?? '',
  }
}

function SaveIndicator({ status, error }: { status: SaveStatus; error: string | null }) {
  if (status === 'saving') {
    return <span className="font-mono text-d11 tracking-widest text-ink-soft">GUARDANDO…</span>
  }
  if (status === 'saved') {
    return <span className="font-mono text-d11 tracking-widest text-ink">◉ GUARDADO</span>
  }
  if (status === 'error') {
    return (
      <span className="font-mono text-d11 font-bold tracking-widest text-sys-red-paper">
        ⚠ {error ?? 'ERROR AL GUARDAR'}
      </span>
    )
  }
  return null
}

function FieldLabel({
  label,
  value,
  maxLength,
}: {
  label: string
  value: string
  maxLength: number
}) {
  const nearLimit = value.length >= Math.floor(maxLength * 0.8)
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="flex items-baseline gap-2">
        <span className="font-mono text-d11 tracking-widest text-ink-soft">{label}</span>
        <span
          aria-hidden
          className="font-mono text-d11 tracking-widest text-ink-faint opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
        >
          EDITAR
        </span>
      </span>
      {nearLimit && (
        <span className="font-mono text-d11 tabular-nums text-ink-faint">
          {value.length}/{maxLength}
        </span>
      )}
    </div>
  )
}

function EditField({
  label,
  value,
  placeholder,
  maxLength,
  inputMode,
  onChange,
}: {
  label: string
  value: string
  placeholder?: string
  maxLength: number
  inputMode?: 'url'
  onChange: (v: string) => void
}) {
  return (
    <label className="group flex min-h-11 min-w-0 flex-col justify-center gap-0.5">
      <FieldLabel label={label} value={value} maxLength={maxLength} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        type={inputMode === 'url' ? 'url' : 'text'}
        className={`w-full border-b border-transparent bg-transparent pb-0.5 font-grotesk text-d15 text-ink placeholder:text-ink-faint hover:border-ink focus:border-ink ${FOCUS_RING}`}
      />
    </label>
  )
}

function EditArea({
  label,
  value,
  placeholder,
  maxLength,
  rows,
  onChange,
}: {
  label: string
  value: string
  placeholder?: string
  maxLength: number
  rows: number
  onChange: (v: string) => void
}) {
  return (
    <label className="group flex min-h-11 min-w-0 flex-col gap-0.5">
      <FieldLabel label={label} value={value} maxLength={maxLength} />
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={rows}
        className={`w-full resize-none border-b border-transparent bg-transparent pb-0.5 font-grotesk text-d15 leading-snug text-ink placeholder:text-ink-faint hover:border-ink focus:border-ink ${FOCUS_RING}`}
      />
    </label>
  )
}

function PerfilEditor({
  franjaId,
  title,
  imageUrl,
  fieldsSource,
  userId,
  onSaved,
}: {
  franjaId: string
  title: string
  imageUrl: string
  fieldsSource: {
    marketplaceDescription: string | null
    marketplaceLocation: string | null
    franjaUrl: string | null
  }
  userId: string | null
  onSaved: () => Promise<void>
}) {
  const [fields, setFields] = useState<ProfileFields>(() => fieldsFromFranja(fieldsSource))
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const saveTimerRef = useRef<number | null>(null)
  const idleTimerRef = useRef<number | null>(null)
  const pendingRef = useRef<Record<string, string | null>>({})
  // While the user is mid-edit, a post-mutation slice refresh must not stomp
  // the text under their cursor. Cleared the instant pendingRef is drained,
  // so a keystroke landing during the request correctly re-dirties and wins.
  const dirtyRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // A stable identity for the three server values. JSON.stringify, not a
  // joined string: a separator that could occur inside a free-text field
  // would make two different server states look identical.
  const sourceKey = JSON.stringify([
    fieldsSource.marketplaceDescription,
    fieldsSource.marketplaceLocation,
    fieldsSource.franjaUrl,
  ])

  useEffect(() => {
    if (dirtyRef.current) return
    setFields(fieldsFromFranja(fieldsSource))
    // Keyed on the VALUES, not the object: the provider hands back a fresh
    // slice object on every poll, which would otherwise reset on a 5-min tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey])

  useEffect(
    () => () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current)
    },
    [],
  )

  const patch = useCallback(
    async (body: Record<string, string | null>): Promise<boolean> => {
      setStatus('saving')
      setError(null)
      try {
        const res = await fetch(`/api/franjas/${encodeURIComponent(franjaId)}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          setError(
            res.status === 403
              ? 'SIN PERMISO PARA EDITAR ESTA FRANJA.'
              : res.status === 401
                ? 'SESIÓN EXPIRADA — VUELVE A ENTRAR.'
                : 'ERROR AL GUARDAR',
          )
          setStatus('error')
          return false
        }
        setStatus('saved')
        if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current)
        idleTimerRef.current = window.setTimeout(() => setStatus('idle'), 1800)
        // The one post-mutation recipe (§3.10).
        await onSaved()
        return true
      } catch {
        setError('ERROR AL GUARDAR — SIN CONEXIÓN.')
        setStatus('error')
        return false
      }
    },
    [franjaId, onSaved],
  )

  const update = useCallback(
    (key: keyof ProfileFields, value: string) => {
      setFields((prev) => ({ ...prev, [key]: value }))
      dirtyRef.current = true
      const dbKey =
        key === 'description'
          ? 'marketplace_description'
          : key === 'location'
            ? 'marketplace_location'
            : 'franja_url'
      // Empty collapses to null — the route reads that as «clear the field».
      pendingRef.current[dbKey] = value.trim() || null
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = window.setTimeout(() => {
        const body = pendingRef.current
        pendingRef.current = {}
        if (Object.keys(body).length === 0) return
        dirtyRef.current = false
        void patch(body)
      }, DEBOUNCE_MS)
    },
    [patch],
  )

  const onFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file || !userId) return
      if (file.type === 'image/gif' && file.size > 10 * 1024 * 1024) {
        setError('EL GIF DEBE PESAR HASTA 10 MB.'); setStatus('error'); return
      }
      setUploading(true)
      setError(null)
      try {
        const result = await compressAndUploadImage(file, userId, {
          maxSizeMB: 0.4,
          maxWidthOrHeight: 512,
        })
        if (!result.ok) {
          setError(result.error.toUpperCase())
          setStatus('error')
          return
        }
        await patch({ image_url: result.url })
      } finally {
        setUploading(false)
      }
    },
    [patch, userId],
  )

  return (
    <Sheet
      title="PERFIL DE LA FRANJA"
      action={<SaveIndicator status={status} error={error} />}
    >
      <div className="flex flex-col gap-4">
        <EditArea
          label="DESCRIPCIÓN"
          value={fields.description}
          placeholder="Qué es esta franja, en una o dos frases."
          maxLength={MAX_DESC_LEN}
          rows={3}
          onChange={(v) => update('description', v)}
        />
        <EditField
          label="UBICACIÓN"
          value={fields.location}
          placeholder="Monterrey 56, Roma Norte · CDMX"
          maxLength={MAX_LOCATION_LEN}
          onChange={(v) => update('location', v)}
        />
        <EditField
          label="ENLACE"
          value={fields.url}
          placeholder="https://…"
          maxLength={MAX_URL_LEN}
          inputMode="url"
          onChange={(v) => update('url', v)}
        />

        <div className="flex flex-wrap items-center gap-4 border-t border-ink/15 pt-4">
          <Plate
            src={imageUrl}
            alt={title}
            label={title}
            size="h-28 w-28"
            sizes="112px"
          />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-mono text-d11 tracking-widest text-ink-soft">LOGO</span>
            <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
              {uploading ? 'SUBIENDO…' : 'JPG · PNG · WEBP · GIF HASTA 10 MB'}
            </span>
          </div>
          <div className="ml-auto">
            <InkButton onClick={() => fileInputRef.current?.click()} disabled={uploading || !userId}>
              {uploading ? 'SUBIENDO…' : 'CAMBIAR LOGO'}
            </InkButton>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onFileChange(e)}
          />
        </div>


      </div>
    </Sheet>
  )
}

// ── EQUIPO: add-member control ──────────────────────────────────────────────

function AddMemberRow({
  franjaId,
  team,
}: {
  franjaId: string
  team: ReturnType<typeof useFranjaTeam>
}) {
  const { confirm } = usePrompt()
  const [handle, setHandle] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const busy = team.busyId === ADD_BUSY_KEY

  const submit = useCallback(async () => {
    setNotice(null)
    team.clearWriteError()
    const resolved = await team.resolveHandle(handle)
    if (!resolved.ok) {
      setNotice(resolved.error)
      return
    }
    if (resolved.currentFranjaId === franjaId) {
      setNotice(`@${resolved.username.toUpperCase()} YA ESTÁ EN ESTE EQUIPO.`)
      return
    }
    if (resolved.currentFranjaId) {
      // franja_team_add sets franja_id unconditionally — adding someone who
      // already belongs elsewhere MOVES them. Never silently.
      const ok = await confirm({
        title: `MOVER A @${resolved.username}`,
        body: `@${resolved.username} ya pertenece a otra franja. Añadirlo aquí lo mueve a este equipo y le quita el acceso al anterior.`,
        confirmLabel: 'MOVER',
        cancelLabel: 'CANCELAR',
      })
      if (!ok) return
    }
    const result = await team.addMember(resolved.id)
    if (result.ok) {
      setHandle('')
      setNotice(`@${resolved.username.toUpperCase()} AÑADIDO AL EQUIPO.`)
    }
  }, [confirm, franjaId, handle, team])

  return (
    <div className="flex flex-col gap-2 border-t border-ink pt-4">
      <span className="font-mono text-d11 tracking-widest text-ink-soft">AÑADIR AL EQUIPO</span>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <label className="flex min-w-0 flex-1 items-center gap-2 border-b border-ink">
          <span className="font-mono text-d15 text-ink-faint">@</span>
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="usuario"
            maxLength={40}
            autoComplete="off"
            aria-label="Nombre de usuario a añadir"
            className={`min-h-11 w-full min-w-0 bg-transparent font-mono text-d15 text-ink placeholder:text-ink-faint ${FOCUS_RING}`}
          />
        </label>
        <InkButton type="submit" disabled={busy || handle.trim().length === 0}>
          {busy ? 'AÑADIENDO…' : 'AÑADIR'}
        </InkButton>
      </form>
      {notice && (
        <p className="font-mono text-d11 uppercase tracking-widest text-ink-soft">{notice}</p>
      )}

    </div>
  )
}

// ── EQUIPO: one roster row ──────────────────────────────────────────────────

function MemberRow({
  member,
  isSelf,
  canWrite,
  busy,
  onToggleAdmin,
  onRemove,
  last,
}: {
  member: FranjaTeamMember
  isSelf: boolean
  canWrite: boolean
  busy: boolean
  onToggleAdmin: () => void
  onRemove: () => void
  last: boolean
}) {
  return (
    <Row last={last}>
      <Plate
        src={member.avatarUrl}
        alt={`@${member.username}`}
        label={member.username}
        size="h-10 w-10"
        sizes="40px"
      />
      <div className="flex min-w-0 flex-col">
        <span className="font-mono text-d13 font-bold tracking-widest text-ink">
          @{member.username}
          {isSelf && <span className="ml-2 font-normal text-ink-faint">· TÚ</span>}
        </span>
        {member.displayName && (
          <span className="truncate font-grotesk text-d13 text-ink-soft">
            {member.displayName}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Chip>{ROLE_LABELS[member.role]}</Chip>
        {member.franjaAdmin && <Chip filled>ADMIN</Chip>}
      </div>
      <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
        DESDE {dateLabel(member.joinedAt)}
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {canWrite && !isSelf ? (
          <>
            <InkButton onClick={onToggleAdmin} disabled={busy}>
              {member.franjaAdmin ? 'QUITAR ADMIN' : 'HACER ADMIN'}
            </InkButton>
            <InkButton tone="red" onClick={onRemove} disabled={busy}>
              RETIRAR
            </InkButton>
          </>
        ) : (
          // Own row: retiring or demoting yourself locks you out of the desk
          // you are standing in, so the controls are not drawn at all.
          <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
            {canWrite && isSelf ? 'TÚ' : ''}
          </span>
        )}
      </div>
    </Row>
  )
}

// ── The space ───────────────────────────────────────────────────────────────

export function FranjaSpace() {
  const { currentUser } = useAuth()
  const { franja, published, drafts, events, loaded, errors, afterMutation } = useDashboardData()
  const composeNav = useComposeNav()
  const openItem = useOpenItem()
  const [unavailable, setUnavailable] = useState(false)
  const openPublication = async (slug: string) => {
    setUnavailable(false)
    if (!await openItem(slug)) setUnavailable(true)
  }
  const search = useSearchParams()
  const { confirm } = usePrompt()
  const view: FranjaView = search.get('franjaView') === 'equipo' ? 'equipo' : search.get('franjaView') === 'perfil' ? 'perfil' : 'publicaciones'
  const filter = (search.get('franjaFilter') ?? 'all') as CollectionFilter
  const sort = (search.get('franjaSort') ?? 'date') as CollectionSort
  const franjaId = franja?.id ?? null
  const history = useFranjaPublications(franjaId, published)
  const team = useFranjaTeam(franjaId)
  const canWriteTeam = canManageFranjaTeam(currentUser, franjaId ?? '')
  const onSaved = useCallback(() => afterMutation('franja'), [afterMutation])
  const select = (key: string, value: string) => {
    const params = new URLSearchParams(window.location.search)
    params.set(key, value)
    window.history.replaceState(null, '', `${window.location.pathname}?${params}`)
  }

  const rows = useMemo<ObraRow[]>(() => {
    if (!franjaId) return []
    const today = startOfTodayMs()
    const byId = new Map<string, ObraRow>()
    for (const item of [...history.items, ...published, ...events]) {
      if (item.franjaId !== franjaId || item.type === 'franja') continue
      byId.set(item.id, { key: item.id, item, state: 'published', at: tsOf(item.publishedAt),
        upcoming: item.type === 'evento' && tsOf(item.endDate || item.date) >= today })
    }
    for (const item of drafts) {
      if (item._draftState !== 'draft' || (item.franjaId !== franjaId && item.attributeFranja !== true)) continue
      byId.set(item.id, { key: item.id, item, state: 'draft', at: tsOf(item._updatedAt), upcoming: false })
    }
    return [...byId.values()]
  }, [franjaId, history.items, published, drafts, events])

  const upcoming = rows.filter((row) => row.upcoming).sort((a, b) => tsOf(a.item.date) - tsOf(b.item.date))
  const visible = rows.filter((row) => filter === 'draft' ? row.state === 'draft'
    : filter === 'published' ? row.state === 'published' : filter === 'upcoming' ? row.upcoming
    : filter === 'past' ? row.state === 'published' && row.item.type === 'evento' && !row.upcoming : true)
    .sort((a, b) => (sort === 'title' ? a.item.title.localeCompare(b.item.title, 'es')
      : sort === 'type' ? publicationLabel(a.item.type).localeCompare(publicationLabel(b.item.type), 'es')
      : b.at - a.at) || a.key.localeCompare(b.key))
  const choices = (['mix', 'listicle', 'evento', 'opinion', 'noticia'] as const)
    .filter((type) => FRANJA_PUBLISHABLE_TYPES.includes(type) && canCreateContent(currentUser, type))
  const [page, setPage] = useState(1)
  useEffect(() => setPage(1), [filter, sort, franjaId])
  const removeMember = async (member: FranjaTeamMember) => {
    if (await confirm({ title: `RETIRAR A @${member.username}`,
      body: `@${member.username} dejará de tener acceso a la franja. Sus publicaciones seguirán atribuidas a ella.`,
      confirmLabel: 'RETIRAR', cancelLabel: 'CANCELAR', destructive: true })) await team.removeMember(member.id)
  }

  if (!franja) return <div className="py-5">
    {errors.franja ? <><ErrorLine>No se pudo cargar la franja.</ErrorLine><InkButton onClick={() => void onSaved()}>REINTENTAR</InkButton></>
      : loaded.franja ? <EmptyLine>No perteneces a ninguna franja.</EmptyLine> : <ShimmerLine />}
  </div>

  const teamContent = team.status === 'loading' ? <ShimmerLine /> : team.status === 'error'
    ? <><ErrorLine>{team.error ?? 'No se pudo cargar el equipo.'}</ErrorLine><InkButton onClick={() => void team.reload()}>REINTENTAR</InkButton></>
    : !team.team.length ? <EmptyLine>El equipo está vacío.</EmptyLine> : team.team.slice(0, 5).map((member) =>
      <div key={member.id} className="flex items-center gap-3 border-b border-ink/15 py-4 last:border-b-0">
        <Plate src={member.avatarUrl} alt={`@${member.username}`} label={member.username} size="h-14 w-14" sizes="56px" />
        <div className="min-w-0"><p className="truncate font-grotesk text-d18 font-bold">@{member.username}</p>
          <p className="mt-1 font-mono text-d11 text-ink-soft">{member.franjaAdmin ? 'Administrador' : 'Miembro'}</p></div>
      </div>)

  return <section className="flex flex-col gap-5 pb-10">
    <IdentityHead title={franja.title} slug={franja.slug} imageUrl={franja.imageUrl}
      kind={kindOf(franja.franjaKind)} location={franja.marketplaceLocation}
      onEdit={() => select('franjaView', view === 'perfil' ? 'publicaciones' : 'perfil')} />
    {unavailable && <p role="status" className="font-grotesk text-d15 text-sys-red-paper">No se pudo abrir esta publicación. Inténtalo de nuevo.</p>}
    {view !== 'publicaciones' && <div><InkButton onClick={() => select('franjaView', 'publicaciones')}>← PUBLICACIONES</InkButton></div>}
    {/* Keep pending autosaves alive when returning to the gallery or team. */}
    <div hidden={view !== 'perfil'} className="max-w-3xl"><PerfilEditor key={franja.id} franjaId={franja.id} title={franja.title} imageUrl={franja.imageUrl}
      fieldsSource={franja} userId={currentUser?.id ?? null} onSaved={onSaved} /></div>
    {view === 'equipo' && <Sheet title="EQUIPO">
      {team.status === 'error' || team.status === 'loading' ? teamContent : team.team.map((member, index) =>
        <MemberRow key={member.id} member={member} isSelf={member.id === currentUser?.id} canWrite={canWriteTeam}
          busy={team.busyId === member.id} onToggleAdmin={() => void team.setAdmin(member.id, !member.franjaAdmin)}
          onRemove={() => void removeMember(member)} last={index === team.team.length - 1} />)}
      {team.writeError && <ErrorLine>{team.writeError}</ErrorLine>}
      {canWriteTeam && team.status === 'ready' && <AddMemberRow franjaId={franja.id} team={team} />}
    </Sheet>}
    {view === 'publicaciones' && <>
      <section className="flex flex-col gap-3 border-b border-ink/30 pb-5" aria-label="Publicar en la franja">
        <h2 className="font-syne text-d18 font-extrabold uppercase md:text-d28">PUBLICAR EN {franja.title}</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {choices.map((type) => <button key={type} type="button" onClick={() => composeNav(type)}
            className={`min-h-16 border border-ink/15 px-3 py-4 font-syne text-d18 font-extrabold transition-transform hover:-translate-y-1 hover:border-ink motion-reduce:transform-none ${publicationTint(type)} ${FOCUS_RING}`}>{publicationLabel(type)}</button>)}
        </div>
      </section>
      <div className="grid items-start gap-6 lg:grid-cols-4">
        <section className="min-w-0 lg:col-span-3" aria-label="Publicaciones de la franja">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-syne text-[clamp(1rem,5vw,1.75rem)] font-extrabold sm:text-d28">PUBLICACIONES</h2>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              <label className="min-w-0 flex-1 sm:flex-none"><span className="sr-only">Mostrar publicaciones</span>
                <select value={filter} onChange={(event) => select('franjaFilter', event.target.value)} className={`min-h-11 w-full border border-ink/30 bg-paper-raised px-3 font-mono text-d13 ${FOCUS_RING}`}>
                  <option value="all">Todas</option><option value="published">Publicadas</option><option value="draft">Borradores</option><option value="upcoming">Próximos eventos</option><option value="past">Eventos pasados</option>
                </select></label>
              <label className="min-w-0 flex-1 sm:flex-none"><span className="sr-only">Ordenar publicaciones</span>
                <select value={sort} onChange={(event) => select('franjaSort', event.target.value)} className={`min-h-11 w-full border border-ink/30 bg-paper-raised px-3 font-mono text-d13 ${FOCUS_RING}`}>
                  <option value="date">{filter === 'draft' ? 'Última edición' : 'Fecha de publicación'}</option><option value="title">Orden alfabético</option><option value="type">Tipo de publicación</option>
                </select></label>
            </div>
          </div>
          {history.error && <div className="mb-4 flex flex-wrap items-center gap-3"><p role="status" className="font-grotesk text-d13">No se pudo actualizar el historial de la franja.</p><InkButton onClick={history.retry}>REINTENTAR</InkButton></div>}
          {!visible.length ? history.loading ? <ShimmerLine /> : <EmptyLine>{filter === 'all' ? 'Tus publicaciones aparecerán aquí.' : 'No hay publicaciones en esta vista.'}</EmptyLine>
            : <div className="grid gap-4 sm:grid-cols-2">{visible.slice(0, page * 12).map((row) =>
              <FranjaPublicationCard key={row.key} row={row} me={currentUser} composeNav={composeNav} onOpen={openPublication} />)}</div>}
          {visible.length > page * 12 && <div className="mt-5"><InkButton onClick={() => setPage((value) => value + 1)}>VER MÁS</InkButton></div>}
        </section>
        <aside className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
          <Sheet title="AGENDA">
            {errors.events ? <><ErrorLine>No se pudo actualizar la agenda.</ErrorLine><InkButton onClick={() => void afterMutation()}>REINTENTAR</InkButton></>
              : !loaded.events && !upcoming.length ? <ShimmerLine />
              : !upcoming.length ? <p className="py-5 font-grotesk text-d15 text-ink-soft">Sin próximos eventos.</p>
              : upcoming.slice(0, 4).map(({ item }) => <button type="button" key={item.id} onClick={() => void openPublication(item.slug)}
                className={`flex w-full gap-3 border-b border-ink/15 py-3 text-left ${FOCUS_RING}`}>
                <div className="relative h-16 w-16 shrink-0 bg-publication-event">{item.imageUrl && <SmartImage src={item.imageUrl} alt="" sizes="64px" className="object-cover" />}</div>
                <div className="min-w-0"><p className="font-grotesk text-d15 font-bold">{item.title}</p><p className="mt-1 font-mono text-d11 text-ink-soft">{dateLabel(item.date)}</p></div>
              </button>)}
            {choices.includes('evento') && <button type="button" onClick={() => composeNav('evento')} className={`mt-3 min-h-11 w-full bg-publication-event px-4 font-mono text-d13 ${FOCUS_RING}`}>CREAR EVENTO</button>}
          </Sheet>
          <Sheet title="EQUIPO">{teamContent}<button type="button" onClick={() => select('franjaView', 'equipo')}
            className={`mt-4 min-h-11 w-full border border-ink/40 px-3 font-mono text-d13 ${FOCUS_RING}`}>{canWriteTeam ? 'GESTIONAR EQUIPO' : 'VER EQUIPO'} ↗</button></Sheet>
        </aside>
      </div>
    </>}
  </section>
}

function FranjaPublicationCard({ row, me, composeNav, onOpen }: {
  row: ObraRow; me: User | null; composeNav: ReturnType<typeof useComposeNav>; onOpen: (slug: string) => Promise<void>
}) {
  const { item } = row
  const byline = authorLabel(item, me)
  const stateLabel = row.state === 'draft' ? 'BORRADOR' : item.type === 'evento' && !row.upcoming ? 'PASADO' : ''
  // The publish route permits site admins, authors, and the attributed team.
  const editable = !!me && isComposeType(item.type) && canCreateContent(me, item.type) &&
    (me.role === 'admin' || item.createdById === me.id || item.franjaId === me.franjaId || row.state === 'draft')
  const edit = () => {
    if (!isComposeType(item.type)) return
    if (row.state === 'published') setPublishedItemLocal(item)
    composeNav(item.type, item.id)
  }
  return <article className="flex min-w-0 flex-col border border-ink/25 bg-paper-raised">
    <div className={`relative aspect-[5/4] overflow-hidden ${publicationTint(item.type)}`}>
      {item.imageUrl ? <SmartImage src={item.imageUrl} alt={item.title} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 640px" className="object-cover" />
        : <span className="flex h-full items-center justify-center font-syne text-3xl font-extrabold">{publicationLabel(item.type)}</span>}
    </div>
    <div className="flex flex-1 flex-col gap-2 p-4">
      <span className="flex items-center gap-2 font-mono text-d11 tracking-widest"><span aria-hidden className={`h-3 w-3 ${publicationTint(item.type)}`} />{publicationLabel(item.type)}</span>
      <h3 className="font-grotesk text-d18 font-bold leading-snug md:text-xl">{item.title || 'Sin título'}</h3>
      {(byline || stateLabel) && <p className="font-mono text-d11 text-ink-soft">{[byline ? `Por ${byline}` : '', stateLabel].filter(Boolean).join(' · ')}</p>}
      <div className="mt-auto flex flex-wrap gap-5 border-t border-ink/20 pt-2">
        {row.state === 'published' && item.slug && <button type="button" onClick={() => void onOpen(item.slug)} className={`flex min-h-11 items-center font-mono text-d13 ${FOCUS_RING}`}>VER ↗</button>}
        {editable && <button type="button" onClick={edit} className={`min-h-11 font-mono text-d13 ${FOCUS_RING}`}>{row.state === 'draft' ? 'CONTINUAR' : 'EDITAR'}</button>}
      </div>
    </div>
  </article>
}
