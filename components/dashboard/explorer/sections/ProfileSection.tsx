'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { User, MapPin, Headphones, Calendar, Upload, X, Loader2 } from 'lucide-react'
import { useAuth } from '@/components/auth/useAuth'
import { useUserRank } from '@/lib/hooks/useUserRank'
import {
  badgeFor,
  flagsFor,
  FLAG_COLOR,
  FLAG_LABEL,
} from '@/lib/mockUsers'
import { compressAndUploadImage } from '@/lib/imageUpload'
import { EngagementWidget } from './EngagementWidget'

const MAX_BIO_LEN = 600
const MAX_FIRMA_LEN = 140
const MAX_LOCATION_LEN = 80
const MAX_DISPLAY_NAME_LEN = 60

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

export function ProfileSection() {
  const { currentUser, username, refreshProfile } = useAuth()
  const rank = useUserRank(currentUser?.id ?? '')
  const badge = currentUser
    ? badgeFor(currentUser, rank)
    : { label: '—', color: '#9CA3AF' }
  const flags = currentUser ? flagsFor(currentUser) : []
  const joinedAt = currentUser?.joinedAt
  const altaDate = joinedAt ? joinedAt.slice(0, 10) : '—'

  const [fields, setFields] = useState<FieldState>(fieldsFromUser(currentUser))
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const saveTimerRef = useRef<number | null>(null)
  // Accumulates changes across rapid edits in different fields so the single
  // debounce timer flushes them together instead of overwriting earlier
  // patches with later ones.
  const pendingRef = useRef<Record<string, string | null>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Re-sync local field state when the auth profile changes (login / refresh
  // / post-PATCH refreshProfile). Depends on the whole user reference — fine
  // since auth profile updates produce a new object via setProfile.
  useEffect(() => {
    setFields(fieldsFromUser(currentUser))
  }, [currentUser])

  const patch = async (body: Record<string, string | null>) => {
    setStatus('saving')
    setError(null)
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Save failed' }))
        setError(data.error ?? 'Save failed')
        setStatus('error')
        return false
      }
      await refreshProfile()
      setStatus('saved')
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = window.setTimeout(() => setStatus('idle'), 1800)
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
      setStatus('error')
      return false
    }
  }

  // Debounced text-field saves. Local state updates immediately; the server
  // sync fires 600ms after the last keystroke. Per-field changes accumulate
  // in `pendingRef` so a quick switch from one field to another flushes
  // both updates together rather than dropping the first one.
  const update = <K extends keyof FieldState>(key: K, value: FieldState[K]) => {
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
    }, 600)
  }

  const handleAvatarFile = async (file: File) => {
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
        return
      }
      await patch({ avatar_url: result.url })
    } finally {
      setAvatarUploading(false)
    }
  }

  const clearAvatar = async () => {
    await patch({ avatar_url: null })
  }

  if (!currentUser) {
    return (
      <p className="font-mono text-[11px] text-muted">
        Inicia sesión para editar tu perfil.
      </p>
    )
  }

  const publicHref = `/u/${username}`

  return (
    <div className="flex flex-col gap-4">
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      {/* Avatar / identity card */}
      <div className="flex flex-col gap-3 border border-border bg-surface p-4">
        <div
          className="relative flex aspect-square w-full items-center justify-center border border-dashed border-border/60 bg-base"
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
          }}
          onDrop={(e) => {
            e.preventDefault()
            const file = e.dataTransfer.files?.[0]
            if (file) void handleAvatarFile(file)
          }}
        >
          {currentUser.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentUser.avatarUrl}
              alt={`avatar ${currentUser.username}`}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <User size={64} strokeWidth={1} className="text-sys-orange" />
          )}
          {avatarUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
              <Loader2 size={24} className="animate-spin text-sys-orange" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarUploading}
            className="flex flex-1 items-center justify-center gap-1.5 border border-border bg-base px-2 py-1.5 font-mono text-[10px] tracking-widest text-secondary transition-colors hover:border-sys-orange hover:text-sys-orange disabled:opacity-50"
          >
            <Upload size={11} strokeWidth={1.5} />
            {currentUser.avatarUrl ? 'CAMBIAR' : 'SUBIR AVATAR'}
          </button>
          {currentUser.avatarUrl && (
            <button
              type="button"
              onClick={() => void clearAvatar()}
              disabled={avatarUploading}
              className="border border-border bg-base px-2 py-1.5 font-mono text-[10px] tracking-widest text-muted transition-colors hover:border-sys-red hover:text-sys-red disabled:opacity-50"
              title="Quitar avatar"
            >
              <X size={11} strokeWidth={1.5} />
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleAvatarFile(file)
            e.target.value = ''
          }}
        />

        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted">USUARIO</span>
          <span className="font-syne text-xl font-black text-primary">@{username ?? '—'}</span>
        </div>
        <dl className="flex flex-col gap-1 border-t border-dashed border-border/60 pt-2 font-mono text-[10px]">
          <Row icon={<MapPin size={11} strokeWidth={1.5} />} label="ZONA" value={fields.location || '—'} />
          <Row icon={<Calendar size={11} strokeWidth={1.5} />} label="ALTA" value={altaDate} />
          <Row
            icon={<Headphones size={11} strokeWidth={1.5} />}
            label="ROL"
            value={
              <div className="flex flex-wrap items-center gap-1">
                <Chip label={badge.label} color={badge.color} />
                {flags.map((f) => (
                  <Chip key={f} label={FLAG_LABEL[f]} color={FLAG_COLOR[f]} />
                ))}
              </div>
            }
          />
        </dl>

        <Link
          href={publicHref}
          className="mt-1 border border-border bg-base px-2 py-1.5 text-center font-mono text-[10px] tracking-widest text-secondary transition-colors hover:border-sys-orange hover:text-sys-orange"
        >
          VER PERFIL PÚBLICO →
        </Link>
      </div>

      {/* Editable fields */}
      <div className="flex flex-col gap-4 border border-border bg-surface p-4">
        <header className="flex items-center justify-between border-b border-dashed border-border/60 pb-2 font-mono text-[10px] tracking-widest">
          <span className="text-secondary">// PERFIL EDITABLE</span>
          <span
            className={
              status === 'saving'
                ? 'text-muted'
                : status === 'saved'
                  ? 'text-sys-green'
                  : status === 'error'
                    ? 'text-sys-red'
                    : 'text-muted'
            }
          >
            {status === 'saving'
              ? 'GUARDANDO…'
              : status === 'saved'
                ? '◉ GUARDADO'
                : status === 'error'
                  ? `⚠ ${error ?? 'ERROR'}`
                  : 'SIN CAMBIOS'}
          </span>
        </header>

        <Field
          label="NOMBRE EDITORIAL"
          value={fields.displayName}
          placeholder="Cómo aparece tu firma"
          maxLength={MAX_DISPLAY_NAME_LEN}
          onChange={(v) => update('displayName', v)}
        />

        <Field
          label="CIUDAD"
          value={fields.location}
          placeholder="CDMX, MTY, GDL…"
          maxLength={MAX_LOCATION_LEN}
          onChange={(v) => update('location', v)}
        />

        <FieldArea
          label="BIO"
          value={fields.bio}
          placeholder="Qué cubres, qué escena, qué firma."
          maxLength={MAX_BIO_LEN}
          onChange={(v) => update('bio', v)}
        />

        <FieldArea
          label="FIRMA"
          value={fields.firma}
          placeholder="Pie editorial usado al final de los textos largos."
          maxLength={MAX_FIRMA_LEN}
          onChange={(v) => update('firma', v)}
          rows={2}
        />

        <p className="font-mono text-[10px] leading-relaxed text-muted">
          Los cambios se guardan automáticamente. Tu perfil público es visible en{' '}
          <Link href={publicHref} className="text-sys-orange hover:underline">
            {publicHref}
          </Link>
          .
        </p>
      </div>
    </div>

    <EngagementWidget />
    </div>
  )
}

function Row({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  valueColor?: string
}) {
  const isString = typeof value === 'string'
  return (
    <div className="grid grid-cols-[16px_70px_1fr] items-center gap-2">
      <span className="text-muted">{icon}</span>
      <dt className="tracking-widest text-muted">{label}</dt>
      <dd
        className={isString ? 'truncate text-secondary' : 'text-secondary'}
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </dd>
    </div>
  )
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="border px-1.5 py-px font-mono text-[9px] tracking-widest"
      style={{ borderColor: color, color }}
    >
      {label}
    </span>
  )
}

function Field({
  label,
  value,
  placeholder,
  maxLength,
  onChange,
}: {
  label: string
  value: string
  placeholder?: string
  maxLength?: number
  onChange: (v: string) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-widest text-muted">{label}</span>
        {maxLength && (
          <span className="font-mono text-[9px] text-muted/60">
            {value.length}/{maxLength}
          </span>
        )}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full border border-border bg-base px-2 py-1.5 font-mono text-[11px] text-primary placeholder:text-muted/60 focus:border-sys-orange focus:outline-none"
      />
    </label>
  )
}

function FieldArea({
  label,
  value,
  placeholder,
  maxLength,
  onChange,
  rows = 4,
}: {
  label: string
  value: string
  placeholder?: string
  maxLength?: number
  onChange: (v: string) => void
  rows?: number
}) {
  return (
    <label className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-widest text-muted">{label}</span>
        {maxLength && (
          <span className="font-mono text-[9px] text-muted/60">
            {value.length}/{maxLength}
          </span>
        )}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={rows}
        className="w-full resize-none border border-border bg-base px-2 py-1.5 font-mono text-[11px] leading-relaxed text-primary placeholder:text-muted/60 focus:border-sys-orange focus:outline-none"
      />
    </label>
  )
}
