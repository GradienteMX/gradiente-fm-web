'use client'

// Compact profile, trophies, personal HP and vibe. Edit mode reveals the
// existing autosave fields; avatar uploads keep the existing upload limits.
// userOverride is confined to the development fixture harness.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
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
          {count}/{VIBE_CHECK_THRESHOLD} CHECKS PARA TU VIBE
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
  const [editingProfile, setEditingProfile] = useState(false)
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

  return <section aria-label="Panel de usuario" className="flex flex-col gap-4 py-4">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={!canEdit || avatarUploading} aria-label={currentUser.avatarUrl ? 'Cambiar avatar' : 'Subir avatar'} style={frame} className={`relative h-20 w-20 shrink-0 overflow-hidden border border-ink bg-paper-raised ${FOCUS_RING}`}>
          {currentUser.avatarUrl ? <SmartImage src={currentUser.avatarUrl} alt={`@${handle}`} sizes="80px" className="object-cover"/> : <span className="font-syne text-3xl font-bold">{handle[0]}</span>}
          {avatarUploading && <span className="absolute inset-0 flex items-center justify-center bg-ink/80 font-mono text-d11 text-paper">SUBIENDO</span>}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange}/>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <h1 className="break-words font-syne text-3xl font-extrabold leading-tight text-ink md:text-4xl">@{handle}</h1>
            <span className="border border-ink/30 px-1.5 py-0.5 font-mono text-[10px] tracking-widest">{badge.label}</span>
            {canEdit && <button type="button" onClick={() => setEditingProfile((value) => !value)} aria-expanded={editingProfile} aria-controls="dashboard-profile-fields" className={`min-h-9 font-mono text-d11 hover:underline ${FOCUS_RING}`}>{editingProfile ? 'LISTO' : 'EDITAR PERFIL'}</button>}
            <SaveIndicator status={status} error={error}/>
          </div>
          <p className="my-1 line-clamp-2 font-grotesk text-d13 leading-snug text-ink-soft">{[fields.location, fields.bio].filter(Boolean).join(' · ')}</p>
          <TrophyStrip compact/>
        </div>
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-5 border-ink/25 lg:w-[360px] lg:border-l lg:pl-5">
        <div>
          <div className="flex items-baseline gap-2 text-hp"><span className="font-syne text-d18 font-extrabold">HP</span><span className="font-grotesk text-3xl font-bold tabular-nums">{hp !== null ? hp.toFixed(1) : '—'}</span></div>
          {hp !== null && <p className="font-mono text-[10px] tracking-widest text-ink-soft">HUMAN PRESENCE · {hlBracket(hp)}</p>}
          {progress?.next && <div className="mt-2 h-1 w-full bg-ink/10" role="progressbar" aria-label={`Próximo trofeo: ${nextLabel}`} aria-valuenow={hp ?? 0} aria-valuemin={progress.prev} aria-valuemax={progress.target}><div className="h-full bg-hp" style={{width: `${progress.pct}%`}}/></div>}
          {errors.engagement && hp === null && <p role="status" className="font-mono text-d11">No se pudo cargar tu HP.</p>}
        </div>
        <VibePersonalLine checks={vibeSelf}/>
      </div>
    </div>
    <div id="dashboard-profile-fields" className={`${editingProfile ? 'grid' : 'hidden'} max-w-3xl grid-cols-1 gap-x-6 gap-y-2 border-t border-ink/25 pt-4 sm:grid-cols-2`}>
      <EditField label="NOMBRE" value={fields.displayName} placeholder="Cómo aparece tu firma" maxLength={MAX_DISPLAY_NAME_LEN} onChange={(value) => update('displayName', value)}/>
      <EditField label="CIUDAD" value={fields.location} placeholder="CDMX, MTY, GDL…" maxLength={MAX_LOCATION_LEN} onChange={(value) => update('location', value)}/>
      <div className="sm:col-span-2"><EditArea label="BIO" value={fields.bio} placeholder="Qué cubres, qué escena, qué firma." maxLength={MAX_BIO_LEN} rows={2} onChange={(value) => update('bio', value)}/></div>
      <div className="sm:col-span-2"><EditArea label="FIRMA" value={fields.firma} placeholder="Pie editorial al final de los textos largos." maxLength={MAX_FIRMA_LEN} rows={1} onChange={(value) => update('firma', value)}/></div>
      {currentUser.avatarUrl && <button type="button" onClick={() => void patch({avatar_url: null})} disabled={avatarUploading} className={`min-h-11 text-left font-mono text-d11 underline ${FOCUS_RING}`}>QUITAR AVATAR</button>}
    </div>
  </section>
}
