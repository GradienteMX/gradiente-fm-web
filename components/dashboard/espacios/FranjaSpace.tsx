'use client'

// ── FRANJA — the franja team's desk (PLIEGO fase D) ─────────────────────────
//
// The third of the four ESPACIOS, and the one with a job the other three do
// not have: it is the FIRST UI for backend that has been live and unreachable.
// /api/franjas/[id]/team has carried four working methods since migration
// 0033 with zero callers, and PATCH /api/franjas/[id] lost its consumer when
// MiFranjaSection was retired. Everything drawn here is wired to one of them.
//
// The two authorities this sheet has to keep straight, because the server
// does:
//   · TEAM MEMBER   reads the roster, publishes as the franja, edits the
//                   franja's public profile.
//   · FRANJA ADMIN  additionally adds, promotes and retires team-mates.
// Every write affordance in EQUIPO is gated on `canManageFranjaTeam` — the
// exact predicate the route's gate uses — and HIDDEN, not disabled, when it
// is false. A greyed button the server would answer with 403 is the dead
// affordance the house bans.
//
// Laws, in the order it would be tempting to break them:
//   · TWO STATES. BORRADOR and PUBLICADO. No scheduling, no visibility
//     levels, no «archivado» flag — ARCHIVO is a VIEW over published rows,
//     not a state, and it says so.
//   · ATTRIBUTION NEVER HIDES THE AUTHOR. The PUBLICACIONES table prints the
//     real writer beside the franja stamp. Trust here is mediated by
//     transparent attribution, not by anonymity — that is the whole reason
//     the //PRESENTA mark is worth anything.
//   · NO ENGAGEMENT, NO VANITY. No follower counts, no views, no numeric
//     vibe, no HP for anyone but the viewer (and the viewer's HP lives on the
//     identity spine, not here). «EQUIPO · N» is an operational roster size,
//     not a popularity number.
//   · ACID IS A FILL. One AcidBlock — publishing as the franja — with ink on
//     top. Destructive work (RETIRAR) is sys-red-paper.
//   · HONEST STATES. EmptyLine names what is absent, ErrorLine names what
//     failed, ShimmerLine is the only load motion. Never a spinner.
//
// Declared limits, drawn as MarginNotes rather than hidden:
//   · The dashboard's data layer carries the VIEWER's published work plus the
//     GLOBAL upcoming-events pool. There is no franja-scoped items endpoint
//     (getItemsByFranja is server-only, with no route in front of it), so a
//     team-mate's past articles are not listed here. Said out loud, not faked.
//   · The team route's projection has no avatar_url, so the roster enriches
//     it separately and falls back to a monogram plate — never a stock face.
//   · The franja slice carries no `verified` flag, so no VERIFICADA mark is
//     drawn. MERCADO ACTIVO/INACTIVO is drawn, because that one IS backed.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

import { useAuth } from '@/components/auth/useAuth'
import { useDashboardData } from '@/components/dashboard/DashboardDataProvider'
import { isComposeType, useComposeNav } from '@/components/dashboard/widgets/cultivar/CrearZone'
import {
  AcidBlock,
  Chip,
  EmptyLine,
  ErrorLine,
  FOCUS_RING,
  InkButton,
  MarginNote,
  Row,
  Sheet,
  SheetTable,
  ShimmerLine,
  SubTabs,
  Td,
  type SubTab,
} from '@/components/dashboard/espacios/kit'
import { usePrompt } from '@/components/prompt/usePrompt'
import { SmartImage } from '@/components/SmartImage'
import { ESPACIO_PARAM } from '@/lib/dashboard/espacios'
import { categoryColorOnLight, typeDisplayLabel } from '@/lib/dashboard/palette'
import { franjaAttributionPrefix } from '@/lib/franjaAttribution'
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

type FranjaTab = 'resumen' | 'publicaciones' | 'archivo' | 'equipo'

const PUBLICACIONES_HEAD = ['TÍTULO', 'TIPO', 'AUTOR', 'ESTADO', 'ACCIONES'] as const

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

/**
 * The item overlay contract. `?item=<slug>` resolves in place — DashOverlayHost
 * on a cold link, OverlayRouter off the warm cache the provider primes — and
 * `?espacio=franja` rides along so closing the overlay lands back on THIS
 * sheet instead of dumping the reader on PANEL.
 */
function itemHref(slug: string): string {
  return `/dashboard?${ESPACIO_PARAM}=franja&item=${encodeURIComponent(slug)}`
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
 * matches), the viewer's handle is the true answer. Otherwise «—»: an unknown
 * author is stated, never invented.
 */
function authorLabel(item: ContentItem, me: User | null): string {
  if (item.author) return item.author
  if (me && item.createdById && item.createdById === me.id) return `@${me.username}`
  return '—'
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

// ── Filter chip — the Chip register, made pressable ─────────────────────────

function FilterChip({
  on,
  onClick,
  swatch,
  children,
}: {
  on: boolean
  onClick: () => void
  swatch?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      data-cue="latch"
      className={`inline-flex min-h-9 items-center gap-1.5 border px-2 py-1 font-mono text-d11 font-bold uppercase tracking-widest ${FOCUS_RING} ${
        on ? 'border-ink bg-ink text-paper' : 'border-ink text-ink hover:bg-ink hover:text-paper'
      }`}
    >
      {swatch && (
        <span
          aria-hidden
          className="inline-block h-2 w-2 shrink-0"
          style={{ backgroundColor: swatch }}
        />
      )}
      {children}
    </button>
  )
}

// ── Row model ───────────────────────────────────────────────────────────────

type ObraState = 'draft' | 'published'

interface ObraRow {
  key: string
  id: string
  slug?: string
  title: string
  type: ContentType
  author: string
  state: ObraState
  at: number
  /** An evento still to come — it belongs to PRÓXIMOS, not to ARCHIVO. */
  upcoming: boolean
}

// ── Identity head ───────────────────────────────────────────────────────────
//
// SpaceHead's exact register (Syne d28 extrabold over an ink hairline, mono
// d11 chrome) with the mockup's logo plate seated in it. Built here rather
// than bent out of SpaceHead because this head carries a 96px plate and a
// location line the shared banner has no slot for — the TYPE is the kit's,
// the anatomy is this space's.

function IdentityHead({
  title,
  slug,
  imageUrl,
  kind,
  location,
  marketplaceEnabled,
}: {
  title: string
  slug: string
  imageUrl: string
  kind: FranjaKind | null
  location: string | null
  marketplaceEnabled: boolean
}) {
  return (
    <div className="flex flex-wrap items-start gap-x-6 gap-y-4 border-b border-ink py-4">
      <Plate
        src={imageUrl}
        alt={title}
        label={title}
        size="h-24 w-24"
        sizes="96px"
      />
      <div className="flex min-w-0 flex-col gap-2">
        <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
          ESPACIO · FRANJA
        </span>
        <h1 className="min-w-0 break-words font-syne text-d28 font-extrabold uppercase text-ink">
          {title}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {kind && (
            <Chip swatch={categoryColorOnLight('franja')}>{FRANJA_KIND_LABELS[kind]}</Chip>
          )}
          {/* Backed by franja.marketplaceEnabled. The lever that flips it
              lives in MERCADO — this is a readout, not a switch. */}
          <Chip filled={marketplaceEnabled}>
            MERCADO · {marketplaceEnabled ? 'ACTIVO' : 'INACTIVO'}
          </Chip>
        </div>
        {location && (
          <span className="font-mono text-d13 uppercase tracking-widest text-ink-soft">
            {location}
          </span>
        )}
      </div>
      <div className="ml-auto flex flex-col items-start gap-1 sm:items-end">
        <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
          EQUIPO ACTIVO
        </span>
        <span className="font-mono text-d13 font-bold uppercase tracking-widest text-ink">
          {title}
        </span>
        <InkButton href={`/f/${slug}`} external>
          VER /F/{slug.toUpperCase()}
        </InkButton>
      </div>
    </div>
  )
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
      title="// PERFIL DE LA FRANJA"
      note="SE PUBLICA EN /F"
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
            size="h-16 w-16"
            sizes="64px"
          />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-mono text-d11 tracking-widest text-ink-soft">LOGO</span>
            <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
              {uploading ? 'SUBIENDO…' : 'JPG · PNG · WEBP'}
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

        {/* A real limit of the route, not decoration: PATCH rejects an empty
            image_url, so a franja can replace its logo but never go blank. */}
        <MarginNote>
          EL LOGO SE PUEDE REEMPLAZAR, NO VACIAR — LA FRANJA SIEMPRE LLEVA MARCA.
        </MarginNote>
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
      <p className="font-mono text-d11 uppercase leading-relaxed tracking-widest text-ink-faint">
        SE BUSCA POR @USUARIO EXACTO — NO HAY BUSCADOR DE CUENTAS PARA LA FRANJA.
      </p>
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
            {canWrite && isSelf ? 'TU PROPIA FILA' : '—'}
          </span>
        )}
      </div>
    </Row>
  )
}

// ── The space ───────────────────────────────────────────────────────────────

export function FranjaSpace() {
  const { currentUser } = useAuth()
  const { franja, published, drafts, events, loaded, errors, afterMutation } =
    useDashboardData()
  const composeNav = useComposeNav()
  const { confirm } = usePrompt()

  const [tab, setTab] = useState<FranjaTab>('resumen')
  const [archiveType, setArchiveType] = useState<ContentType | null>(null)

  const franjaId = franja?.id ?? null
  const team = useFranjaTeam(franjaId)
  const canWriteTeam = canManageFranjaTeam(currentUser, franjaId ?? '')

  const onSaved = useCallback(() => afterMutation('franja'), [afterMutation])

  // ── The franja's body of work, from the slices the provider carries ──────
  const rows = useMemo<ObraRow[]>(() => {
    if (!franjaId) return []
    const today = startOfTodayMs()
    const seen = new Set<string>()
    const out: ObraRow[] = []

    const pushItem = (item: ContentItem) => {
      if (seen.has(item.id)) return
      seen.add(item.id)
      const upcoming = item.type === 'evento' && tsOf(item.date) >= today
      out.push({
        key: `p:${item.id}`,
        id: item.id,
        slug: item.slug,
        title: item.title || 'Sin título',
        type: item.type,
        author: authorLabel(item, currentUser),
        state: 'published',
        at: upcoming ? tsOf(item.date) : tsOf(item.publishedAt),
        upcoming,
      })
    }

    // The viewer's own published work, franja-stamped by /api/items.
    published.filter((i) => i.franjaId === franjaId).forEach(pushItem)
    // The GLOBAL upcoming-events pool, narrowed to this franja — the one
    // slice that carries team-mates' work as well as the viewer's own.
    events.filter((i) => i.franjaId === franjaId).forEach(pushItem)

    // Drafts have no franja_id yet: /api/items stamps attribution at publish
    // time. `attributeFranja === true` is the composer's real, stored
    // intention to stamp — the honest signal that this draft is franja work.
    drafts
      .filter(
        (d) =>
          d._draftState === 'draft' && (d.franjaId === franjaId || d.attributeFranja === true),
      )
      .forEach((d) => {
        if (seen.has(d.id)) return
        seen.add(d.id)
        out.push({
          key: `d:${d.id}`,
          id: d.id,
          title: d.title || 'Sin título',
          type: d.type,
          author: authorLabel(d, currentUser),
          state: 'draft',
          at: tsOf(d._updatedAt),
          upcoming: false,
        })
      })

    // Drafts first — they are the only rows that still need a decision —
    // then everything else newest first.
    return out.sort((a, b) => {
      if (a.state !== b.state) return a.state === 'draft' ? -1 : 1
      return b.at - a.at
    })
  }, [currentUser, drafts, events, franjaId, published])

  const upcomingEvents = useMemo(
    () => rows.filter((r) => r.upcoming).sort((a, b) => a.at - b.at),
    [rows],
  )

  const archivo = useMemo(
    () => rows.filter((r) => r.state === 'published' && !r.upcoming),
    [rows],
  )

  const archivoTypes = useMemo(() => {
    const set = new Set<ContentType>()
    archivo.forEach((r) => set.add(r.type))
    return Array.from(set)
  }, [archivo])

  const archivoRows = useMemo(
    () => (archiveType ? archivo.filter((r) => r.type === archiveType) : archivo),
    [archivo, archiveType],
  )

  // A filter chip whose type has left the archive must not stay latched.
  useEffect(() => {
    if (archiveType && !archivoTypes.includes(archiveType)) setArchiveType(null)
  }, [archiveType, archivoTypes])

  // The feed preview's representative piece: the newest published thing the
  // franja actually has. Real attribution, real artwork — not a mock card.
  const previewItem = useMemo<ContentItem | null>(() => {
    if (!franjaId) return null
    const pool = [
      ...published.filter((i) => i.franjaId === franjaId),
      ...events.filter((i) => i.franjaId === franjaId),
    ]
    if (pool.length === 0) return null
    const byId = new Map(pool.map((i) => [i.id, i]))
    return (
      Array.from(byId.values()).sort(
        (a, b) => tsOf(b.publishedAt) - tsOf(a.publishedAt),
      )[0] ?? null
    )
  }, [events, franjaId, published])

  const composableTypes = useMemo(
    () =>
      FRANJA_PUBLISHABLE_TYPES.filter(
        (t) => isComposeType(t) && canCreateContent(currentUser, t),
      ),
    [currentUser],
  )

  const handleToggleAdmin = useCallback(
    async (member: FranjaTeamMember) => {
      await team.setAdmin(member.id, !member.franjaAdmin)
    },
    [team],
  )

  const handleRemove = useCallback(
    async (member: FranjaTeamMember) => {
      const ok = await confirm({
        title: `RETIRAR A @${member.username}`,
        body: `@${member.username} deja de formar parte del equipo y pierde el acceso a este espacio. Su trabajo publicado sigue atribuido a la franja.`,
        confirmLabel: 'RETIRAR',
        cancelLabel: 'CANCELAR',
        destructive: true,
      })
      if (!ok) return
      await team.removeMember(member.id)
    },
    [confirm, team],
  )

  // ── Slice-level honest states ────────────────────────────────────────────
  if (errors.franja) {
    return (
      <section className="flex flex-col gap-4 pb-10">
        <ErrorLine>NO SE PUDO CARGAR LA FRANJA — SE REINTENTA EN EL PRÓXIMO SONDEO.</ErrorLine>
      </section>
    )
  }
  if (!franja) {
    return (
      <section className="flex flex-col gap-4 pb-10">
        {loaded.franja ? (
          <EmptyLine>NO PERTENECES A NINGUNA FRANJA.</EmptyLine>
        ) : (
          <ShimmerLine />
        )}
      </section>
    )
  }

  const kind = kindOf(franja.franjaKind)
  const stampPrefix = kind ? franjaAttributionPrefix(kind) : 'PRESENTA'

  const tabs: readonly SubTab<FranjaTab>[] = [
    { id: 'resumen', label: 'RESUMEN' },
    { id: 'publicaciones', label: 'PUBLICACIONES', count: rows.length },
    { id: 'archivo', label: 'ARCHIVO', count: archivo.length },
    {
      id: 'equipo',
      label: 'EQUIPO',
      count: team.status === 'ready' ? team.team.length : undefined,
    },
  ]

  return (
    <section className="flex flex-col gap-6 pb-10">
      <IdentityHead
        title={franja.title}
        slug={franja.slug}
        imageUrl={franja.imageUrl}
        kind={kind}
        location={franja.marketplaceLocation}
        marketplaceEnabled={franja.marketplaceEnabled}
      />

      <SubTabs tabs={tabs} active={tab} onChange={setTab} ariaLabel="Secciones de la franja" />

      {/* ── RESUMEN ─────────────────────────────────────────────────────── */}
      {tab === 'resumen' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <AcidBlock
              title="Publicar como franja"
              note="EL SELLO //PRESENTA VIAJA CON LA PIEZA"
            >
              {composableTypes.length > 0 ? (
                composableTypes.map((t) => (
                  <InkButton key={t} onClick={() => isComposeType(t) && composeNav(t)}>
                    <span
                      aria-hidden
                      className="inline-block h-2 w-2 shrink-0 border border-ink"
                      style={{ backgroundColor: categoryColorOnLight(t) }}
                    />
                    {typeDisplayLabel(t)}
                  </InkButton>
                ))
              ) : (
                <span className="font-mono text-d11 uppercase tracking-widest text-ink-soft">
                  TU CUENTA NO PUEDE PUBLICAR TODAVÍA.
                </span>
              )}
            </AcidBlock>

            <Sheet title="Próximos eventos" note="FUENTE · AGENDA PÚBLICA">
              {!loaded.events && upcomingEvents.length === 0 ? (
                <ShimmerLine />
              ) : errors.events ? (
                <ErrorLine>NO SE PUDO LEER LA AGENDA.</ErrorLine>
              ) : upcomingEvents.length === 0 ? (
                <EmptyLine>SIN EVENTOS PRÓXIMOS ATRIBUIDOS A LA FRANJA.</EmptyLine>
              ) : (
                upcomingEvents.slice(0, 6).map((r, i, arr) => (
                  <Row key={r.key} last={i === arr.length - 1}>
                    <span className="font-mono text-d11 uppercase tracking-widest tabular-nums text-ink-faint">
                      {dateLabel(new Date(r.at).toISOString())}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-grotesk text-d15 text-ink">
                      {r.title}
                    </span>
                    {r.slug && (
                      <InkButton href={itemHref(r.slug)} cue="tick">
                        VER
                      </InkButton>
                    )}
                  </Row>
                ))
              )}
            </Sheet>
          </div>

          <div className="flex flex-col gap-6">
            <Sheet
              title="// ASÍ SE VE EN EL FEED PÚBLICO"
              note="ATRIBUCIÓN REAL · NO ES UNA MAQUETA"
            >
              {previewItem ? (
                <div className="border border-ink bg-paper">
                  <span className="relative block aspect-[4/3] w-full overflow-hidden border-b border-ink bg-paper-raised">
                    {previewItem.imageUrl ? (
                      <SmartImage
                        src={previewItem.imageUrl}
                        alt={previewItem.title}
                        className="object-cover"
                        sizes="(max-width: 1024px) 100vw, 400px"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center font-mono text-d11 uppercase tracking-widest text-ink-faint">
                        SIN IMAGEN
                      </span>
                    )}
                  </span>
                  <div className="flex flex-col gap-2 p-3">
                    <span className="font-mono text-[10px] font-bold tracking-widest text-sys-red-paper">
                      {'//'}
                      {stampPrefix} · {franja.title.toUpperCase()}
                    </span>
                    <span className="font-syne text-d18 font-extrabold uppercase leading-tight text-ink">
                      {previewItem.title}
                    </span>
                    <div>
                      <Chip swatch={categoryColorOnLight(previewItem.type)}>
                        {typeDisplayLabel(previewItem.type)}
                      </Chip>
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyLine>AÚN NO HAY PIEZA ATRIBUIDA QUE PREVISUALIZAR.</EmptyLine>
              )}
            </Sheet>

            <Sheet
              title="Equipo"
              note={team.status === 'ready' ? `· ${team.team.length}` : undefined}
              action={
                <InkButton onClick={() => setTab('equipo')} cue="latch">
                  GESTIONAR →
                </InkButton>
              }
            >
              {team.status === 'loading' ? (
                <ShimmerLine />
              ) : team.status === 'error' ? (
                <ErrorLine>{team.error ?? 'NO SE PUDO LEER EL EQUIPO.'}</ErrorLine>
              ) : team.team.length === 0 ? (
                <EmptyLine>EL EQUIPO ESTÁ VACÍO.</EmptyLine>
              ) : (
                team.team.slice(0, 5).map((m, i, arr) => (
                  <Row key={m.id} last={i === arr.length - 1}>
                    <Plate
                      src={m.avatarUrl}
                      alt={`@${m.username}`}
                      label={m.username}
                      size="h-8 w-8"
                      sizes="32px"
                    />
                    <span className="min-w-0 flex-1 truncate font-mono text-d13 tracking-widest text-ink">
                      @{m.username}
                    </span>
                    {m.franjaAdmin && <Chip filled>ADMIN</Chip>}
                  </Row>
                ))
              )}
            </Sheet>

            <PerfilEditor
              franjaId={franja.id}
              title={franja.title}
              imageUrl={franja.imageUrl}
              fieldsSource={{
                marketplaceDescription: franja.marketplaceDescription,
                marketplaceLocation: franja.marketplaceLocation,
                franjaUrl: franja.franjaUrl,
              }}
              userId={currentUser?.id ?? null}
              onSaved={onSaved}
            />
          </div>
        </div>
      )}

      {/* ── PUBLICACIONES ───────────────────────────────────────────────── */}
      {tab === 'publicaciones' && (
        <div className="flex flex-col gap-4">
          <Sheet title="Publicaciones" note="CON EL SELLO DE LA FRANJA" padded={false}>
            {!loaded.published && !loaded.events && rows.length === 0 ? (
              <div className="p-4">
                <ShimmerLine />
              </div>
            ) : rows.length === 0 ? (
              <EmptyLine>LA FRANJA NO TIENE PIEZAS ATRIBUIDAS TODAVÍA.</EmptyLine>
            ) : (
              <ObraTable rows={rows} composeNav={composeNav} />
            )}
          </Sheet>
          <MarginNote>
            ESTA MESA LEE TU OBRA PUBLICADA MÁS LA AGENDA PÚBLICA DE LA FRANJA. NO EXISTE UN
            ENDPOINT POR FRANJA, ASÍ QUE LOS TEXTOS ANTIGUOS DE OTRAS PERSONAS DEL EQUIPO NO
            APARECEN AQUÍ — SE VEN EN /F/{franja.slug.toUpperCase()}.
          </MarginNote>
        </div>
      )}

      {/* ── ARCHIVO ─────────────────────────────────────────────────────── */}
      {tab === 'archivo' && (
        <div className="flex flex-col gap-4">
          <Sheet
            title="Archivo"
            note="PUBLICADO · SIN EVENTOS POR VENIR"
            padded={false}
            action={
              archivoTypes.length > 1 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <FilterChip on={archiveType === null} onClick={() => setArchiveType(null)}>
                    TODO
                  </FilterChip>
                  {archivoTypes.map((t) => (
                    <FilterChip
                      key={t}
                      on={archiveType === t}
                      swatch={categoryColorOnLight(t)}
                      onClick={() => setArchiveType(t)}
                    >
                      {typeDisplayLabel(t)}
                    </FilterChip>
                  ))}
                </div>
              ) : undefined
            }
          >
            {archivoRows.length === 0 ? (
              <EmptyLine>
                {archivo.length === 0
                  ? 'EL ARCHIVO DE LA FRANJA ESTÁ VACÍO.'
                  : 'NINGUNA PIEZA DE ESE TIPO EN EL ARCHIVO.'}
              </EmptyLine>
            ) : (
              <ObraTable rows={archivoRows} composeNav={composeNav} />
            )}
          </Sheet>
          <MarginNote>
            ARCHIVO ES UNA VISTA, NO UN ESTADO: SON LAS PIEZAS PUBLICADAS QUE YA NO ESTÁN POR
            VENIR. NO EXISTE ARCHIVAR NI DESARCHIVAR EN ESTE SISTEMA.
          </MarginNote>
        </div>
      )}

      {/* ── EQUIPO ──────────────────────────────────────────────────────── */}
      {tab === 'equipo' && (
        <div className="flex flex-col gap-4">
          <Sheet
            title="Equipo"
            note={canWriteTeam ? 'PUEDES GESTIONAR ESTE EQUIPO' : 'SOLO LECTURA'}
          >
            {team.status === 'loading' ? (
              <ShimmerLine />
            ) : team.status === 'error' ? (
              <ErrorLine>{team.error ?? 'NO SE PUDO LEER EL EQUIPO.'}</ErrorLine>
            ) : team.team.length === 0 ? (
              <EmptyLine>EL EQUIPO ESTÁ VACÍO.</EmptyLine>
            ) : (
              <div className="flex flex-col">
                {team.team.map((m, i, arr) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    isSelf={m.id === currentUser?.id}
                    canWrite={canWriteTeam}
                    busy={team.busyId === m.id}
                    onToggleAdmin={() => void handleToggleAdmin(m)}
                    onRemove={() => void handleRemove(m)}
                    last={i === arr.length - 1}
                  />
                ))}
              </div>
            )}

            {team.writeError && <ErrorLine>{team.writeError}</ErrorLine>}

            {canWriteTeam && team.status !== 'error' && (
              <AddMemberRow franjaId={franja.id} team={team} />
            )}
          </Sheet>

          {!canWriteTeam && (
            <MarginNote>
              SOLO LA ADMINISTRACIÓN DE LA FRANJA PUEDE AÑADIR, PROMOVER O RETIRAR GENTE. EL
              SERVIDOR APLICA LA MISMA REGLA, ASÍ QUE AQUÍ NO SE DIBUJAN BOTONES QUE NO
              FUNCIONARÍAN.
            </MarginNote>
          )}
        </div>
      )}
    </section>
  )
}

// ── The shared obra table (PUBLICACIONES + ARCHIVO) ─────────────────────────
//
// One table, two views. AUTOR is a first-class column and never collapses into
// the franja: the //PRESENTA stamp says who PRESENTS the piece, this column
// says who WROTE it, and the desk shows both.

function ObraTable({
  rows,
  composeNav,
}: {
  rows: ObraRow[]
  composeNav: ReturnType<typeof useComposeNav>
}) {
  return (
    <SheetTable head={PUBLICACIONES_HEAD}>
      {rows.map((r) => (
        <tr key={r.key}>
          <Td mono={false}>
            <span className="block max-w-[28ch] truncate" title={r.title}>
              {r.title}
            </span>
          </Td>
          <Td>
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-2 w-2 shrink-0 border border-ink"
                style={{ backgroundColor: categoryColorOnLight(r.type) }}
              />
              {typeDisplayLabel(r.type)}
            </span>
          </Td>
          <Td>
            <span className="block max-w-[20ch] truncate" title={r.author}>
              {r.author}
            </span>
          </Td>
          <Td>
            <Chip filled={r.state === 'published'}>
              {r.state === 'published' ? 'PUBLICADO' : 'BORRADOR'}
            </Chip>
          </Td>
          <Td right>
            <span className="inline-flex flex-wrap items-center justify-end gap-2">
              {isComposeType(r.type) && (
                <InkButton onClick={() => isComposeType(r.type) && composeNav(r.type, r.id)}>
                  EDITAR
                </InkButton>
              )}
              {r.state === 'published' && r.slug && (
                <InkButton href={itemHref(r.slug)}>VER</InkButton>
              )}
            </span>
          </Td>
        </tr>
      ))}
    </SheetTable>
  )
}
