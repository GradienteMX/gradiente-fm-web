'use client'

import { useEffect, useState } from 'react'
import { User, Mail, MapPin, Headphones, Calendar } from 'lucide-react'
import { useAuth } from '@/components/auth/useAuth'
import { useUserRank } from '@/lib/comments'
import { useResolvedUser } from '@/lib/userOverrides'
import {
  badgeFor,
  flagsFor,
  FLAG_COLOR,
  FLAG_LABEL,
} from '@/lib/mockUsers'

const STORAGE_KEY = 'gradiente:dashboard:profile'

interface ProfileState {
  displayName: string
  bio: string
  city: string
  signature: string
}

const DEFAULT_PROFILE: ProfileState = {
  displayName: '',
  bio: '',
  city: 'CDMX',
  signature: '',
}

function readProfile(): ProfileState {
  if (typeof window === 'undefined') return DEFAULT_PROFILE
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PROFILE
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_PROFILE, ...parsed }
  } catch {
    return DEFAULT_PROFILE
  }
}

function writeProfile(p: ProfileState) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {}
}

export function ProfileSection() {
  const { currentUser, username } = useAuth()
  // Resolve through the override layer so admin self-edits in
  // [[PermisosSection]] reflect on the profile card. The auth context still
  // returns the seed user, so dashboard breadcrumb chrome lags until reload
  // — that's a known limitation; fixing it here gives the user *something*
  // current after a self-edit.
  const resolved = useResolvedUser(currentUser?.id ?? null)
  const rank = useUserRank(currentUser?.id ?? '')
  const badge = resolved
    ? badgeFor(resolved, rank)
    : { label: '—', color: '#9CA3AF' }
  const flags = resolved ? flagsFor(resolved) : []
  const joinedAt = resolved?.joinedAt
  const altaDate = joinedAt ? joinedAt.slice(0, 10) : '—'
  const [profile, setProfile] = useState<ProfileState>(DEFAULT_PROFILE)
  const [hydrated, setHydrated] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  useEffect(() => {
    setProfile(readProfile())
    setHydrated(true)
  }, [])

  const update = <K extends keyof ProfileState>(key: K, value: ProfileState[K]) => {
    const next = { ...profile, [key]: value }
    setProfile(next)
    writeProfile(next)
    setSavedAt(new Date().toISOString())
  }

  if (!hydrated) return null

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      {/* Avatar / identity card */}
      <div className="flex flex-col gap-3 border border-border bg-surface p-4">
        <div className="flex aspect-square w-full items-center justify-center border border-dashed border-border/60 bg-base">
          <User size={64} strokeWidth={1} className="text-sys-orange" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted">USUARIO</span>
          <span className="font-syne text-xl font-black text-primary">@{username ?? '—'}</span>
        </div>
        <dl className="flex flex-col gap-1 border-t border-dashed border-border/60 pt-2 font-mono text-[10px]">
          <Row icon={<Mail size={11} strokeWidth={1.5} />} label="EMAIL" value={`${username ?? 'unit'}@gradiente.fm`} />
          <Row icon={<MapPin size={11} strokeWidth={1.5} />} label="ZONA" value={profile.city || '—'} />
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
      </div>

      {/* Editable fields */}
      <div className="flex flex-col gap-4 border border-border bg-surface p-4">
        <header className="flex items-center justify-between border-b border-dashed border-border/60 pb-2 font-mono text-[10px] tracking-widest">
          <span className="text-secondary">// PERFIL EDITABLE</span>
          <span className="text-muted">
            {savedAt ? 'GUARDADO LOCAL' : 'SIN CAMBIOS'}
          </span>
        </header>

        <Field
          label="NOMBRE EDITORIAL"
          value={profile.displayName}
          placeholder="Cómo aparece tu firma"
          onChange={(v) => update('displayName', v)}
        />

        <Field
          label="CIUDAD"
          value={profile.city}
          placeholder="CDMX, MTY, GDL…"
          onChange={(v) => update('city', v)}
        />

        <FieldArea
          label="BIO"
          value={profile.bio}
          placeholder="Qué cubres, qué escena, qué firma."
          onChange={(v) => update('bio', v)}
        />

        <FieldArea
          label="FIRMA"
          value={profile.signature}
          placeholder="Pie editorial usado al final de los textos largos."
          onChange={(v) => update('signature', v)}
          rows={2}
        />

        <p className="font-mono text-[10px] leading-relaxed text-muted">
          [PROTOTIPO] El perfil se guarda en sessionStorage. Cuando lleguemos a
          Supabase esto se sincroniza al usuario real.
        </p>
      </div>
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
  // Strings get the truncate treatment so long emails / dates clip cleanly.
  // ReactNode values (e.g. the ROL chip stack) wrap as flex children — let
  // them lay out without the truncate hack.
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

// Small bordered chip — same idiom as [[CommentList]]'s AuthorBadges and
// [[PostHeader]]'s primary chip. Used here for the role/rank + flag stack
// in the ROL row.
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
  onChange,
}: {
  label: string
  value: string
  placeholder?: string
  onChange: (v: string) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] tracking-widest text-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-border bg-base px-2 py-1.5 font-mono text-[11px] text-primary placeholder:text-muted/60 focus:border-sys-orange focus:outline-none"
      />
    </label>
  )
}

function FieldArea({
  label,
  value,
  placeholder,
  onChange,
  rows = 4,
}: {
  label: string
  value: string
  placeholder?: string
  onChange: (v: string) => void
  rows?: number
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] tracking-widest text-muted">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-none border border-border bg-base px-2 py-1.5 font-mono text-[11px] leading-relaxed text-primary placeholder:text-muted/60 focus:border-sys-orange focus:outline-none"
      />
    </label>
  )
}
