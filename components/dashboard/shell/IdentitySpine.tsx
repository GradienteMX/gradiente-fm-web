'use client'

// ── IdentitySpine — the page's identity document (revision-2 points 2/6/7/9) ─
//
// Chrome: not draggable, not removable, not a grid cell. The PERFIL widget is
// retired — its info lives HERE now (point 6): avatar (≤2-click upload),
// @handle (no greeting — point 2), badge, and the direct-edit fields (NOMBRE
// · CIUDAD · BIO · FIRMA) in the document-at-rest register: set ink text at
// rest, underline + EDITAR whisper on hover/focus, ONE debounced PATCH
// /api/users/me 600ms after the last edit (the legacy pendingRef pattern).
// The trophy strip moved up here too (point 9).
//
// Right: the HP block — big «HP · HUMAN PRESENCE» in the HP blue (point 7),
// the raw scalar (owner's own panel — still the only place it renders), the
// próximo-hito progress, and the words-only VIBE PERSONAL readout absorbed
// from the retired widget. No PRIVADO framing line, no boxes — clean type on
// paper with one hairline.
//
// `userOverride` is the LAB-BOUNDARY injection — only app/lab/dashboard
// passes it; edits are disabled without a real session.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth/useAuth'
import { useDashboardData, type VibeSelfCheck } from '@/components/dashboard/DashboardDataProvider'
import type { User } from '@/lib/types'
import { SmartImage } from '@/components/SmartImage'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'
import { TrophyStrip } from '@/components/dashboard/widgets/cultivar/TrophyStrip'
import { useUserRank } from '@/lib/hooks/useUserRank'
import { avatarFrameStyle, badgeFor } from '@/lib/mockUsers'
import { compressAndUploadImage } from '@/lib/imageUpload'
import { hlBracket } from '@/lib/dashboard/hl'
import { trophyByKey } from '@/lib/trophies'
import { VIBE_CHECK_THRESHOLD, VIBE_SLOT_COLORS, vibeRangeLabel } from '@/lib/utils'

// ── Presence thresholds (trophy-progress math, unchanged) ───────────────────

const PRESENCE_THRESHOLDS = [
  { key: 'presence_logged', target: 10 },
  { key: 'presence_deep', target: 25 },
  { key: 'presence_persistent', target: 50 },
  { key: 'presence_insider_track', target: 100 },
] as const

function presenceProgress(hp: number) {
  const next = PRESENCE_THRESHOLDS.find((t) => hp < t.target) ?? null
  let prev = 0
  for (const t of PRESENCE_THRESHOLDS) {
    if (hp >= t.target) prev = t.target
    else break
  }
  const target = next?.target ?? PRESENCE_THRESHOLDS[PRESENCE_THRESHOLDS.length - 1].target
  const pct = next
    ? Math.min(100, Math.max(0, ((hp - prev) / (target - prev)) * 100))
    : 100
  return { next, prev, target, pct }
}

// ── Direct-edit machinery (ported from the retired PerfilWidget) ────────────

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

function fieldsFromUser(u: User | null): FieldState {
  return {
    displayName: u?.displayName ?? '',
    bio: u?.bio ?? '',
    firma: u?.firma ?? '',
    location: u?.location ?? '',
  }
}

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
    return (
      <span className="font-mono text-d13 font-bold tracking-widest text-sys-red-paper">
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

// ── VIBE PERSONAL — words-only readout on paper (absorbed from PERFIL) ──────

const UNLIT_ALPHA = '33'

function median(sortedAsc: number[]): number {
  const n = sortedAsc.length
  const mid = Math.floor(n / 2)
  return n % 2 === 1 ? sortedAsc[mid] : (sortedAsc[mid - 1] + sortedAsc[mid]) / 2
}

function medianBand(checks: VibeSelfCheck[]): [number, number] {
  const lows = checks.map((c) => c.vibeMin).sort((a, b) => a - b)
  const highs = checks.map((c) => c.vibeMax).sort((a, b) => a - b)
  const lo = Math.max(0, Math.min(10, Math.round(median(lows))))
  const hi = Math.max(0, Math.min(10, Math.round(median(highs))))
  return lo <= hi ? [lo, hi] : [hi, lo]
}

function VibePersonalLine({ checks }: { checks: VibeSelfCheck[] }) {
  const count = checks.length
  const enough = count >= VIBE_CHECK_THRESHOLD
  const band = enough ? medianBand(checks) : null
  const words = band ? vibeRangeLabel({ vibeMin: band[0], vibeMax: band[1] }) : null

  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
        VIBE PERSONAL
      </span>
      <div
        role="img"
        aria-label={words ? `VIBE · ${words}` : 'VIBE · SIN SEÑAL SUFICIENTE'}
        className="flex h-2 w-full gap-px"
      >
        {VIBE_SLOT_COLORS.map((color, slot) => {
          const lit = band !== null && slot >= band[0] && slot <= band[1]
          return (
            <span
              key={slot}
              className="min-w-0 flex-1"
              style={{ backgroundColor: lit ? color : `${color}${UNLIT_ALPHA}` }}
            />
          )
        })}
      </div>
      {enough && words ? (
        <span className="font-mono text-d13 font-bold uppercase tracking-widest text-ink">
          {words}
          <span className="ml-2 font-normal tabular-nums text-ink-soft">
            {count} CHECKS
          </span>
        </span>
      ) : (
        <span className="font-mono text-d13 text-ink-soft">
          SEÑAL INSUFICIENTE · {count}/{VIBE_CHECK_THRESHOLD} CHECKS
        </span>
      )}
    </div>
  )
}

// ── The spine ───────────────────────────────────────────────────────────────

export function IdentitySpine({ userOverride }: { userOverride?: User } = {}) {
  const { currentUser: authedUser, username, refreshProfile } = useAuth()
  const { engagement, vibeSelf, errors } = useDashboardData()
  const currentUser = authedUser ?? userOverride ?? null
  const rank = useUserRank(currentUser?.id ?? '')

  // Direct-edit state (real session only — the lab override reads static).
  const canEdit = !!authedUser
  const [fields, setFields] = useState<FieldState>(() => fieldsFromUser(currentUser))
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const saveTimerRef = useRef<number | null>(null)
  const idleTimerRef = useRef<number | null>(null)
  const pendingRef = useRef<Record<string, string | null>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      if (!canEdit) return
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
    [canEdit, currentUser?.displayName, patch],
  )

  const handleAvatarFile = useCallback(
    async (file: File) => {
      if (!currentUser || !canEdit) return
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
    [currentUser, canEdit, patch],
  )

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void handleAvatarFile(file)
    e.target.value = ''
  }

  if (!currentUser) return null

  const handle = (authedUser ? username : null) ?? currentUser.username
  const badge = badgeFor(currentUser, rank)
  const frame = avatarFrameStyle(currentUser, rank)

  const hp = engagement?.hp ?? null
  const progress = hp !== null ? presenceProgress(hp) : null
  const nextLabel = progress?.next ? trophyByKey(progress.next.key)?.label ?? '—' : null

  return (
    <section
      aria-label="Panel de usuario"
      className="flex flex-col gap-8 py-8 lg:flex-row lg:items-start lg:justify-between"
    >
      {/* ── Left: the identity document (PERFIL absorbed — point 6) ───────── */}
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex items-start gap-5">
          {/* Avatar plate — ≤2-click upload; QUITAR overlays on hover/focus. */}
          <div className="group/avatar relative h-24 w-24 shrink-0">
            <button
              type="button"
              onClick={() => canEdit && fileInputRef.current?.click()}
              disabled={avatarUploading || !canEdit}
              aria-label={currentUser.avatarUrl ? 'Cambiar avatar' : 'Subir avatar'}
              className={`group relative block h-24 w-24 overflow-hidden border border-ink bg-paper-raised ${FOCUS_RING}`}
              style={frame}
            >
              {currentUser.avatarUrl ? (
                <SmartImage
                  src={currentUser.avatarUrl}
                  alt={`@${handle}`}
                  className="object-cover"
                  sizes="96px"
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
                canEdit && (
                  <span className="absolute inset-x-0 bottom-0 hidden min-h-6 items-center justify-center bg-ink py-0.5 font-mono text-d11 tracking-widest text-paper group-hover:flex group-focus-visible:flex">
                    {currentUser.avatarUrl ? 'CAMBIAR' : 'SUBIR'}
                  </span>
                )
              )}
            </button>
            {canEdit && currentUser.avatarUrl && (
              <button
                type="button"
                onClick={() => void patch({ avatar_url: null })}
                disabled={avatarUploading}
                className={`pointer-events-none absolute inset-x-0 top-0 z-10 flex min-h-9 items-center justify-center border-b border-ink bg-paper font-mono text-d11 tracking-widest text-ink opacity-0 focus-visible:pointer-events-auto focus-visible:opacity-100 group-hover/avatar:pointer-events-auto group-hover/avatar:opacity-100 group-focus-within/avatar:pointer-events-auto group-focus-within/avatar:opacity-100 hover:underline ${FOCUS_RING}`}
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

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {/* The one display moment — no greeting (point 2). */}
            <h1 className="min-w-0 break-words font-syne text-display font-extrabold leading-none text-ink">
              @{handle}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1.5 border border-ink px-2 py-0.5 font-mono text-d11 font-bold tracking-widest text-ink">
                <span
                  aria-hidden
                  className="h-2 w-2 border border-ink"
                  style={{ backgroundColor: badge.color }}
                />
                {badge.label}
              </span>
              {/* Fase E door: the owner's route to their printed expediente.
                  ↗ = leaves the dashboard surface (house glyph law). */}
              {handle && (
                <Link
                  href={`/u/${handle}`}
                  className={`inline-flex min-h-11 items-center font-mono text-d11 font-bold tracking-widest text-ink underline-offset-2 hover:underline ${FOCUS_RING}`}
                >
                  VER PERFIL PÚBLICO ↗
                </Link>
              )}
              <SaveIndicator status={status} error={error} />
            </div>
          </div>
        </div>

        {/* Direct-edit fields — document at rest, zero chrome until touched. */}
        <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
          <EditField
            label="NOMBRE"
            value={fields.displayName}
            placeholder="Cómo aparece tu firma"
            maxLength={MAX_DISPLAY_NAME_LEN}
            onChange={(v) => update('displayName', v)}
          />
          <EditField
            label="CIUDAD"
            value={fields.location}
            placeholder="CDMX, MTY, GDL…"
            maxLength={MAX_LOCATION_LEN}
            onChange={(v) => update('location', v)}
          />
          <div className="sm:col-span-2">
            <EditArea
              label="BIO"
              value={fields.bio}
              placeholder="Qué cubres, qué escena, qué firma."
              maxLength={MAX_BIO_LEN}
              rows={2}
              onChange={(v) => update('bio', v)}
            />
          </div>
          <div className="sm:col-span-2">
            <EditArea
              label="FIRMA"
              value={fields.firma}
              placeholder="Pie editorial al final de los textos largos."
              maxLength={MAX_FIRMA_LEN}
              rows={1}
              onChange={(v) => update('firma', v)}
            />
          </div>
        </div>

        {/* Trophies — moved up beside the profile (point 9). */}
        <TrophyStrip />
      </div>

      {/* ── Right: HP · HUMAN PRESENCE (point 7) + vibe words ─────────────── */}
      <div className="flex w-full max-w-sm shrink-0 flex-col gap-4 border-ink pl-0 lg:border-l lg:pl-6">
        <div className="flex items-end gap-3">
          <span className="font-syne text-display font-extrabold leading-none text-hp">
            HP
          </span>
          <span className="pb-1 font-mono text-d13 font-bold uppercase tracking-widest text-hp">
            HUMAN
            <br />
            PRESENCE
          </span>
        </div>

        <div className="flex items-baseline justify-between gap-3">
          <span className="font-grotesk text-d28 font-bold tabular-nums text-hp">
            {hp !== null ? hp.toFixed(1) : '—'}
          </span>
          {hp !== null && (
            <span className="font-mono text-d13 tracking-widest text-ink">
              ◇ {hlBracket(hp)}
            </span>
          )}
        </div>

        {errors.engagement && hp === null ? (
          <p className="font-mono text-d13 text-ink">
            SEÑAL INTERRUMPIDA — se reintenta con el próximo sondeo.
          </p>
        ) : progress && progress.next ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between font-mono text-d11 tracking-widest">
              <span className="text-ink-soft">PRÓXIMO HITO</span>
              <span className="text-ink">{nextLabel}</span>
            </div>
            <div className="h-1.5 w-full border border-ink bg-paper">
              <div className="h-full bg-hp" style={{ width: `${progress.pct}%` }} />
            </div>
            <div className="flex justify-between font-mono text-d11 text-ink-faint tabular-nums">
              <span>{progress.prev} ◇</span>
              <span>{progress.target} ◇</span>
            </div>
          </div>
        ) : progress ? (
          <p className="font-mono text-d13 text-ink-soft">
            TODOS LOS UMBRALES DE PRESENCIA CRUZADOS.
          </p>
        ) : null}

        <VibePersonalLine checks={vibeSelf} />
      </div>
    </section>
  )
}
