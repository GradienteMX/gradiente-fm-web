'use client'

// ── PERFIL — direct-edit identity (FINAL_SPEC §3.8, w6×h2 / w4×h3) ──────────
//
// Two size states from the stored vocabulary (§2.5), each composed to its
// slot (judge fix 12 — a printed dossier never ends mid-rule):
//   {6,2} short banner (default) — exactly the blocks that COMPLETE inside
//   the ~133px content box: avatar plate | @handle + badge + SaveIndicator +
//   NOMBRE/CIUDAD | VIBE PERSONAL panel. No hidden scroll rail at desktop
//   widths; «EDITAR BIO Y FIRMA» snaps to the tall state in place through
//   the provider's ONE layout write path (the MAPA precedent).
//   {4,3} tall dossier — the full document: identity + all four fields +
//   VIBE PERSONAL + FLAIR + «VISTA BREVE» return snap (whole blocks stack;
//   this opt-in state may scroll).
//
// Keeps today's direct manipulation, ported from the legacy ProfileSection
// and restyled to the light system: displayName / bio / firma / location are
// edit-in-place fields — 0 clicks to start editing a visible field, NO
// save/cancel pair, NO edit-mode toggle. Local state updates per keystroke;
// the server sync is ONE debounced PATCH /api/users/me 600ms after the last
// edit, with per-field changes accumulated so a quick hop between fields
// flushes together (the legacy pendingRef pattern). SaveIndicator reads the
// sync state; errors render in full voice per the consequence-copy rule.
//
// Avatar ≤2 clicks: click the plate (1) → system file picker → upload runs
// (compressAndUploadImage, 512px / 0.4MB) and PATCHes avatar_url. QUITAR is
// always visible while an avatar exists.
//
// Rank/badge render via the live badgeFor/avatarFrameStyle helpers in the
// IdentitySpine graphic-dot idiom — colors as outlined graphics, never text
// color on paper. VIBE PERSONAL (§3.8) ships per the WP0-C probe verdict and
// reads the provider's vibeSelf slice; the black panel sits inside the
// widget's cream padding (R5 mat). Flair: the earned-trophy strip (provider
// `trophies` slice) — locked trophies are silhouettes with the named unlock,
// no monetization teasers.
//
// Data flow: reads useDashboardData() + useAuth() only; the PATCH +
// refreshProfile pair is the §3.8-named mutation recipe (auth context is the
// render source for identity — a heartbeat revalidation adds nothing here).

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/useAuth'
import { useDashboardData } from '@/components/dashboard/DashboardDataProvider'
import type { DashboardWidgetProps } from '@/components/dashboard/grid/WidgetGrid'
import { FOCUS_RING, WidgetFrame } from '@/components/dashboard/grid/WidgetFrame'
import { dashWidgetDomId } from '@/components/dashboard/shell/StatusStrip'
import { SmartImage } from '@/components/SmartImage'
import { useUserRank } from '@/lib/hooks/useUserRank'
import { avatarFrameStyle, badgeFor } from '@/lib/mockUsers'
import { compressAndUploadImage } from '@/lib/imageUpload'
import { TROPHY_CATALOG } from '@/lib/trophies'
import { VibePersonalPanel } from './perfil/VibePersonalPanel'

const MAX_BIO_LEN = 600
const MAX_FIRMA_LEN = 140
const MAX_LOCATION_LEN = 80
const MAX_DISPLAY_NAME_LEN = 60
const DEBOUNCE_MS = 600

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface FieldState {
  displayName: string
  bio: string
  firma: string
  location: string
}

function fieldsFromUser(u: ReturnType<typeof useAuth>['currentUser']): FieldState {
  return {
    displayName: u?.displayName ?? '',
    bio: u?.bio ?? '',
    firma: u?.firma ?? '',
    location: u?.location ?? '',
  }
}

// Mono system-voice readout of the debounced sync — the §3.8 SaveIndicator.
function SaveIndicator({ status, error }: { status: SaveStatus; error: string | null }) {
  if (status === 'saving') {
    return (
      <span className="font-mono text-d11 tracking-widest text-ink-soft">GUARDANDO…</span>
    )
  }
  if (status === 'saved') {
    return <span className="font-mono text-d11 tracking-widest text-ink">◉ GUARDADO</span>
  }
  if (status === 'error') {
    // Consequence copy in full voice — soft tiers never carry warnings.
    return (
      <span className="font-mono text-d13 font-bold tracking-widest text-sys-red-paper">
        ⚠ {error ?? 'ERROR AL GUARDAR'}
      </span>
    )
  }
  return (
    <span className="font-mono text-d11 tracking-widest text-ink-faint">AUTOGUARDADO</span>
  )
}

export function PerfilWidget({ size, compact }: DashboardWidgetProps) {
  const router = useRouter()
  const { currentUser, username, refreshProfile } = useAuth()
  const ctx = useDashboardData()
  const { vibeSelf, trophies, loaded, errors } = ctx
  const rank = useUserRank(currentUser?.id ?? '')

  const [fields, setFields] = useState<FieldState>(() => fieldsFromUser(currentUser))
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const saveTimerRef = useRef<number | null>(null)
  const idleTimerRef = useRef<number | null>(null)
  // Accumulates changes across rapid edits in different fields so the single
  // debounce flushes them together instead of dropping earlier patches.
  const pendingRef = useRef<Record<string, string | null>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Re-sync when the auth profile changes (login / refreshProfile after PATCH).
  useEffect(() => {
    setFields(fieldsFromUser(currentUser))
  }, [currentUser])

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
        const res = await fetch('/api/users/me', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const data = (await res.json().catch(() => ({ error: 'ERROR AL GUARDAR' }))) as {
            error?: string
          }
          setError(data.error ?? 'ERROR AL GUARDAR')
          setStatus('error')
          return false
        }
        await refreshProfile()
        setStatus('saved')
        if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current)
        idleTimerRef.current = window.setTimeout(() => setStatus('idle'), 1800)
        return true
      } catch (e) {
        setError(e instanceof Error ? e.message : 'ERROR AL GUARDAR')
        setStatus('error')
        return false
      }
    },
    [refreshProfile],
  )

  const update = useCallback(
    <K extends keyof FieldState>(key: K, value: FieldState[K]) => {
      setFields((prev) => ({ ...prev, [key]: value }))
      const dbKey =
        key === 'displayName' ? 'display_name' : (key as 'bio' | 'firma' | 'location')
      const trimmed = value.trim()
      pendingRef.current[dbKey] =
        dbKey === 'display_name'
          ? trimmed || (currentUser?.displayName ?? '')
          : trimmed || null
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = window.setTimeout(() => {
        const body = pendingRef.current
        pendingRef.current = {}
        if (Object.keys(body).length > 0) void patch(body)
      }, DEBOUNCE_MS)
    },
    [currentUser?.displayName, patch],
  )

  const handleAvatarFile = useCallback(
    async (file: File) => {
      if (!currentUser) return
      setAvatarUploading(true)
      setError(null)
      try {
        const result = await compressAndUploadImage(file, currentUser.id, {
          maxSizeMB: 0.4,
          maxWidthOrHeight: 512,
        })
        if (!result.ok) {
          setError(result.error)
          setStatus('error')
          return
        }
        await patch({ avatar_url: result.url })
      } finally {
        setAvatarUploading(false)
      }
    },
    [currentUser, patch],
  )

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void handleAvatarFile(file)
    e.target.value = ''
  }

  // Size snap between the two stored states (§2.5 {6,2}/{4,3}) through the
  // provider's ONE layout write path — the MAPA expand/collapse precedent
  // (judge fix 12): the {6,2} banner completes cleanly and BIO/FIRMA/FLAIR
  // stay one working gesture away instead of dangling on a hidden scroll.
  const setPerfilSize = useCallback(
    (w: number, h: number) => {
      const current = ctx.layoutMeta
      ctx.commitLayout({
        ...current,
        layout: current.layout.map((entry) =>
          entry.id === 'perfil' ? { ...entry, w, h } : entry,
        ),
      })
    },
    [ctx],
  )
  const expandDossier = useCallback(() => setPerfilSize(4, 3), [setPerfilSize])
  const collapseDossier = useCallback(() => setPerfilSize(6, 2), [setPerfilSize])

  const handle = username ?? currentUser?.username ?? null
  const publicHref = handle ? `/u/${handle}` : null

  if (!currentUser || !handle) {
    return (
      <div id={dashWidgetDomId('perfil')} className="h-full">
        <WidgetFrame title="PERFIL" compact>
          <p className="truncate font-grotesk text-d15 text-ink">
            Inicia sesión para editar tu identidad editorial.
          </p>
        </WidgetFrame>
      </div>
    )
  }

  const badge = badgeFor(currentUser, rank)
  const frame = avatarFrameStyle(currentUser, rank)
  const altaDate = currentUser.joinedAt ? currentUser.joinedAt.slice(0, 10) : null
  // §2.5 stored vocabulary: {6,2} = short banner, {4,3} = tall dossier.
  const short = size.h <= 2

  if (compact) {
    return (
      <div id={dashWidgetDomId('perfil')} className="h-full">
        <WidgetFrame
          title="PERFIL"
          compact
          action={
            publicHref
              ? { label: 'VER PERFIL ↗', onClick: () => router.push(publicHref) }
              : undefined
          }
        >
          {/* Copy budgeted to the narrowest stored width — wraps, never clamps. */}
          <p className="min-w-0 font-grotesk text-d15 text-ink">
            @{handle} — edita tu nombre, bio y firma.
          </p>
        </WidgetFrame>
      </div>
    )
  }

  // ── Shared blocks (identical at both stored sizes) ──────────────────────

  const frameAction = publicHref
    ? { label: 'VER PERFIL PÚBLICO ↗', onClick: () => router.push(publicHref) }
    : undefined

  // group/avatar scopes the QUITAR reveal to this plate — the document reads
  // calm at rest, the affordance appears on hover/focus (judge fix 20).
  const avatarPlate = (
    <div className="group/avatar flex shrink-0 flex-col gap-1.5">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={avatarUploading}
        aria-label={currentUser.avatarUrl ? 'Cambiar avatar' : 'Subir avatar'}
        className={`group relative block h-20 w-20 shrink-0 overflow-hidden border border-ink bg-paper ${FOCUS_RING}`}
        style={frame}
      >
        {currentUser.avatarUrl ? (
          <SmartImage
            src={currentUser.avatarUrl}
            alt={`avatar @${handle}`}
            className="object-cover"
            sizes="80px"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-syne text-d28 font-extrabold uppercase text-ink">
            {handle.slice(0, 1)}
          </span>
        )}
        {avatarUploading ? (
          <span className="absolute inset-0 flex items-center justify-center bg-ink/80 font-mono text-d11 tracking-widest text-paper motion-safe:animate-blink">
            SUBIENDO
          </span>
        ) : (
          <span className="absolute inset-x-0 bottom-0 hidden justify-center bg-ink py-0.5 font-mono text-d11 tracking-widest text-paper group-hover:flex group-focus-visible:flex">
            {currentUser.avatarUrl ? 'CAMBIAR' : 'SUBIR'}
          </span>
        )}
      </button>
      {currentUser.avatarUrl && (
        // De-alarmed ink-outline chip (judge fix 20): revealed on avatar
        // hover/focus only. It stays in the DOM at opacity-0 so the keyboard
        // path holds (tab reaches it; focus reveals it); pointer-events are
        // gated so an invisible chip can never swallow a stray tap. ::before
        // pads the hit area to ≥44px.
        <button
          type="button"
          onClick={() => void patch({ avatar_url: null })}
          disabled={avatarUploading}
          className={`pointer-events-none relative inline-flex w-20 items-center justify-center border border-ink bg-paper px-2 py-0.5 font-mono text-d11 tracking-widest text-ink opacity-0 before:absolute before:-inset-y-3.5 before:inset-x-0 before:content-[''] focus-visible:opacity-100 group-hover/avatar:pointer-events-auto group-hover/avatar:opacity-100 group-focus-within/avatar:pointer-events-auto group-focus-within/avatar:opacity-100 hover:underline ${FOCUS_RING}`}
        >
          QUITAR
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />
    </div>
  )

  // badgeFor graphic-dot idiom (IdentitySpine): color as an outlined graphic,
  // never as text color on paper.
  const badgeChip = (
    <span className="inline-flex w-fit shrink-0 items-center gap-1.5 border border-ink px-2 py-0.5 font-mono text-d11 font-bold tracking-widest text-ink">
      <span
        aria-hidden
        className="h-2 w-2 border border-ink"
        style={{ backgroundColor: badge.color }}
      />
      {badge.label}
    </span>
  )

  const nameField = (
    <EditField
      label="NOMBRE"
      value={fields.displayName}
      placeholder="Cómo aparece tu firma"
      maxLength={MAX_DISPLAY_NAME_LEN}
      onChange={(v) => update('displayName', v)}
    />
  )
  const cityField = (
    <EditField
      label="CIUDAD"
      value={fields.location}
      placeholder="CDMX, MTY, GDL…"
      maxLength={MAX_LOCATION_LEN}
      onChange={(v) => update('location', v)}
    />
  )

  const vibePanel = (
    <VibePersonalPanel
      checks={vibeSelf}
      loaded={!!loaded.vibeSelf}
      error={!!errors.vibeSelf}
    />
  )

  // ── {6,2} short banner (judge fix 12) — completes cleanly, whole rows ────
  // The 96×2+24 slot leaves ~133px of content: the banner carries exactly the
  // blocks that finish inside it — avatar plate | @handle + badge +
  // SaveIndicator + NOMBRE/CIUDAD | VIBE panel — and nothing dangles on a
  // hidden scroll rail. BIO, FIRMA, ALTA and FLAIR live at the {4,3} dossier,
  // one real size snap away («EDITAR BIO Y FIRMA»). Direct-edit-in-place and
  // the words-only vibe readout are untouched.
  if (short) {
    return (
      <div id={dashWidgetDomId('perfil')} className="h-full">
        <WidgetFrame title="PERFIL" action={frameAction}>
          <div className="grid h-full min-h-0 grid-cols-1 content-start gap-x-5 gap-y-4 overflow-y-auto lg:grid-cols-[auto_minmax(0,1fr)_minmax(200px,220px)]">
            {avatarPlate}

            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="min-w-0 truncate font-syne text-d18 font-extrabold text-ink">
                  @{handle}
                </span>
                {badgeChip}
                <span className="flex-1" />
                <SaveIndicator status={status} error={error} />
              </div>
              {nameField}
              {cityField}
            </div>

            <div className="flex min-w-0 flex-col gap-1.5">
              {vibePanel}
              <SizeSnap label="EDITAR BIO Y FIRMA" onClick={expandDossier} />
            </div>
          </div>
        </WidgetFrame>
      </div>
    )
  }

  // ── {4,3} tall dossier — the full identity document ──────────────────────
  return (
    <div id={dashWidgetDomId('perfil')} className="h-full">
      <WidgetFrame title="PERFIL" action={frameAction}>
        <div className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto">
          {/* ── Identity: avatar (≤2 clicks) + handle + earned badge ──────── */}
          <div className="flex min-w-0 items-start gap-4">
            {avatarPlate}
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="truncate font-syne text-d18 font-extrabold text-ink">
                @{handle}
              </span>
              {badgeChip}
              {altaDate && (
                <span className="font-mono text-d11 tracking-widest text-ink-faint tabular-nums">
                  ALTA {altaDate}
                </span>
              )}
            </div>
          </div>

          {/* ── Direct-edit fields — no save/cancel, no edit-mode toggle ──── */}
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
                {'// IDENTIDAD EDITORIAL'}
              </span>
              <SaveIndicator status={status} error={error} />
            </div>
            {nameField}
            {cityField}
            <EditArea
              label="BIO"
              value={fields.bio}
              placeholder="Qué cubres, qué escena, qué firma."
              maxLength={MAX_BIO_LEN}
              rows={3}
              onChange={(v) => update('bio', v)}
            />
            <EditArea
              label="FIRMA"
              value={fields.firma}
              placeholder="Pie editorial al final de los textos largos."
              maxLength={MAX_FIRMA_LEN}
              rows={2}
              onChange={(v) => update('firma', v)}
            />
          </div>

          {/* ── VIBE PERSONAL — black panel on the widget's cream mat ─────── */}
          <div className="min-w-0">{vibePanel}</div>

          {/* ── Flair (§3.8) — TrophyGrid-style earned cosmetics. Same idiom
              as CULTIVAR's TrophyStrip (catalog hexes are dark-ground, so on
              cream: earned = ink fill, locked = outline silhouette with the
              NAMED unlock in title/aria). Monetization cosmetics render only
              when equippable — none exist yet, so nothing teases. */}
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 border-t border-ink pt-2.5">
            <span className="font-mono text-d11 font-bold tracking-widest text-ink-soft">
              {'// FLAIR GANADO'}
            </span>
            <div className="flex flex-wrap items-center gap-1">
              {TROPHY_CATALOG.map((t) => {
                const earned = trophies.has(t.key)
                return (
                  <span
                    key={t.key}
                    title={
                      earned
                        ? `${t.label} — ${t.description}`
                        : `BLOQUEADO — ${t.description}`
                    }
                    aria-label={
                      earned
                        ? `Trofeo ganado: ${t.label}`
                        : `Trofeo bloqueado: ${t.description}`
                    }
                    className={`flex h-6 w-6 items-center justify-center border border-ink font-mono text-d13 font-bold ${
                      earned ? 'bg-ink text-paper' : 'bg-transparent text-ink-faint'
                    }`}
                  >
                    {t.sigil}
                  </span>
                )
              })}
            </div>
          </div>

          <SizeSnap label="VISTA BREVE" onClick={collapseDossier} />
        </div>
      </WidgetFrame>
    </div>
  )
}

// In-place size snap (the MAPA expand/collapse precedent — §2.4 one write
// path, cue 'latch', no ↗ because nothing leaves the panel). Visual d13 mark;
// the ::before inset pads the hit area to ≥44px so the completed banner rows
// never inflate.
function SizeSnap({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-cue="latch"
      className={`relative w-fit self-start font-mono text-d13 uppercase tracking-widest text-ink underline-offset-4 before:absolute before:-inset-y-3.5 before:inset-x-0 before:content-[''] hover:underline ${FOCUS_RING}`}
    >
      {label}
    </button>
  )
}

// ── Edit-in-place fields — document-at-rest (judge fix 20) ──────────────────
// At rest the value reads as set ink text: no box, no hairline, no chrome.
// Hover/focus reveals the subtle edit affordance — the underline plus a mono
// «EDITAR» whisper by the label. Editing still starts at 0 clicks (the text
// IS the input); zero save/cancel pair. The wrapping <label> is the ≥44px
// hit target, so the visual mark never inflates.

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
        {/* Hover/focus whisper — inputs are already semantically editable. */}
        <span
          aria-hidden
          className="font-mono text-d11 tracking-widest text-ink-faint opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
        >
          EDITAR
        </span>
      </span>
      {nearLimit && (
        <span className="font-mono text-d11 text-ink-faint tabular-nums">
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
  onChange,
}: {
  label: string
  value: string
  placeholder?: string
  maxLength: number
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
