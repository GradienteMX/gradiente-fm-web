'use client'

import { useMemo, useState } from 'react'
import { Briefcase, Lock, Search, Shield, ShieldCheck, Star, RotateCcw, Save } from 'lucide-react'
import type { Role, User } from '@/lib/types'
import {
  badgeFor,
  flagsFor,
  FLAG_COLOR,
  FLAG_LABEL,
  ROLE_COLOR,
  ROLE_LABEL,
} from '@/lib/mockUsers'
import { useUserRank } from '@/lib/hooks/useUserRank'
import {
  clearUserOverride,
  setUserOverride,
  useHasOverride,
  useResolvedUsers,
} from '@/lib/userOverrides'
import { useResolvedPartners } from '@/lib/partnerOverrides'
import { useAuth } from '@/components/auth/useAuth'

// ── PermisosSection ─────────────────────────────────────────────────────────
//
// Admin-only role/flag editor. Two-pane layout:
//   left  — searchable list of all users with their current effective badge
//   right — editor for the selected user (role dropdown, mod/og toggles)
//
// Self-demote guard: an admin cannot drop their own role below `admin`.
// Otherwise they'd lock themselves out of this surface immediately.
//
// Storage lives in [lib/userOverrides.ts](../../../lib/userOverrides.ts) —
// session-scoped patches over MOCK_USERS. Consumers (CommentList, PostHeader,
// SavedCommentsSection) read via useResolvedUser, so badge edits propagate
// across the app without a reload.

const ROLE_OPTIONS: Role[] = ['user', 'curator', 'guide', 'insider', 'admin']

export function PermisosSection() {
  const users = useResolvedUsers()
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q),
    )
  }, [users, query])

  const selected = users.find((u) => u.id === selectedId) ?? null

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_360px]">
      {/* LEFT — searchable user list */}
      <div className="flex flex-col gap-3">
        <SearchBar value={query} onChange={setQuery} />
        <ul className="flex flex-col border border-border bg-elevated/30">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center font-mono text-[11px] text-muted">
              ningún usuario coincide con &quot;{query}&quot;
            </li>
          ) : (
            filtered.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                selected={selectedId === u.id}
                onSelect={() => setSelectedId(u.id)}
              />
            ))
          )}
        </ul>
        <p className="font-mono text-[10px] leading-relaxed text-muted">
          //CAMBIOS·EN·SESIÓN — los overrides viven en sessionStorage del navegador
          y se pierden al cerrar la pestaña. El backend real persistirá vía
          Supabase (ver Roadmap).
        </p>
      </div>

      {/* RIGHT — editor for the selected user */}
      <div className="flex flex-col gap-3">
        {selected ? (
          <UserEditor user={selected} />
        ) : (
          <EmptyEditor count={users.length} />
        )}
      </div>
    </div>
  )
}

// ── Search bar ─────────────────────────────────────────────────────────────

function SearchBar({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-2 border border-border bg-elevated/30 px-2 py-1.5">
      <Search size={12} strokeWidth={1.5} className="text-muted" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar @username o nombre…"
        className="flex-1 bg-transparent font-mono text-[11px] text-primary placeholder:text-muted focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="font-mono text-[10px] tracking-widest text-muted hover:text-primary"
          aria-label="Limpiar búsqueda"
        >
          ×
        </button>
      )}
    </div>
  )
}

// ── User list row ──────────────────────────────────────────────────────────

function UserRow({
  user,
  selected,
  onSelect,
}: {
  user: User
  selected: boolean
  onSelect: () => void
}) {
  const rank = useUserRank(user.id)
  const overridden = useHasOverride(user.id)
  const primary = badgeFor(user, rank)
  const flags = flagsFor(user)
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={[
          'flex w-full items-center gap-2 border-b border-border/50 px-3 py-2 text-left font-mono text-[11px] transition-colors',
          selected
            ? 'bg-sys-orange/10 text-primary'
            : 'text-secondary hover:bg-white/[0.02]',
        ].join(' ')}
      >
        <span
          className="shrink-0 border px-1.5 py-px text-[9px] tracking-widest"
          style={{ borderColor: primary.color, color: primary.color }}
        >
          {primary.label}
        </span>
        {flags.map((f) => (
          <span
            key={f}
            className="shrink-0 border px-1.5 py-px text-[9px] tracking-widest"
            style={{ borderColor: FLAG_COLOR[f], color: FLAG_COLOR[f] }}
          >
            {FLAG_LABEL[f]}
          </span>
        ))}
        <span className="ml-1 truncate text-primary">@{user.username}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1.5 text-muted">
          {overridden && (
            <span
              className="border px-1.5 py-px text-[9px] tracking-widest"
              style={{ borderColor: '#F97316', color: '#F97316' }}
              title="Este usuario tiene un override de sesión"
            >
              EDITADO
            </span>
          )}
          <span aria-hidden>›</span>
        </span>
      </button>
    </li>
  )
}

// ── Editor pane ────────────────────────────────────────────────────────────

function UserEditor({ user }: { user: User }) {
  const { currentUser } = useAuth()
  const overridden = useHasOverride(user.id)
  const isSelf = currentUser?.id === user.id
  const wouldDemoteSelf = (next: Role) => isSelf && next !== 'admin'

  return (
    <div className="flex flex-col border border-border bg-elevated/30">
      <header className="flex items-center justify-between border-b border-border bg-elevated/60 px-3 py-2 font-mono text-[10px] tracking-widest text-secondary">
        <span className="flex items-center gap-2">
          <Lock size={12} strokeWidth={1.5} className="text-sys-orange" />
          EDITOR · @{user.username}
        </span>
        {overridden && (
          <button
            type="button"
            onClick={() => clearUserOverride(user.id)}
            className="flex items-center gap-1 border border-border px-2 py-0.5 text-[9px] text-muted transition-colors hover:border-sys-orange hover:text-sys-orange"
            title="Restaurar valores del seed"
          >
            <RotateCcw size={10} strokeWidth={1.5} /> RESTAURAR
          </button>
        )}
      </header>

      <div className="flex flex-col gap-4 p-4">
        <IdentityBlock user={user} />

        <RoleEditor
          user={user}
          disabled={false}
          warnSelfDemote={wouldDemoteSelf}
        />

        <FlagToggle
          label="MOD"
          flag="mod"
          description="Capacidad de borrar comentarios y hilos del foro. Independiente del rol."
          color={FLAG_COLOR.mod}
          icon={<Shield size={12} strokeWidth={1.5} />}
          checked={!!user.isMod}
          onChange={(v) => setUserOverride(user.id, { isMod: v })}
        />

        <FlagToggle
          label="OG"
          flag="og"
          description="Insignia cosmética para registros de la primera oleada. Sin capacidad asociada."
          color={FLAG_COLOR.og}
          icon={<Star size={12} strokeWidth={1.5} />}
          checked={!!user.isOG}
          onChange={(v) => setUserOverride(user.id, { isOG: v })}
        />

        <PartnerEditor user={user} />

        {isSelf && (
          <p
            className="border border-dashed px-3 py-2 font-mono text-[10px] leading-relaxed"
            style={{ borderColor: '#E63329', color: '#9CA3AF' }}
          >
            //AUTOEDICIÓN — eres el usuario seleccionado. La opción de bajarte
            de <span style={{ color: '#F87171' }}>admin</span> está bloqueada
            para evitar perder acceso a esta pantalla. Pide a otro admin que
            te degrade si necesitas hacerlo.
          </p>
        )}
      </div>
    </div>
  )
}

function EmptyEditor({ count }: { count: number }) {
  return (
    <div
      className="flex flex-col items-start gap-2 border border-dashed border-border bg-elevated/30 px-4 py-8 font-mono text-[11px] leading-relaxed text-muted"
    >
      <span className="tracking-widest" style={{ color: '#3a3a3a' }}>
        //SIN·SELECCIÓN
      </span>
      <p>
        Elige un usuario de la lista para editar su rol y banderas. Hay {count}{' '}
        usuarios en el roster.
      </p>
    </div>
  )
}

// ── Partner team membership editor ─────────────────────────────────────────
//
// Two controls:
//   - Partnership dropdown — set/clear which partner the user belongs to.
//     Drives `partnerId`. "Ninguno" sends `null` to explicitly clear.
//   - Partner-admin toggle — only meaningful when partnerId is set; grants
//     in-team admin powers (kick/add team members of own partner).
//
// Site admins (currentUser.role === 'admin') see this editor against any
// user. The site admin's actions here propagate live via [[userOverrides]].

function PartnerEditor({ user }: { user: User }) {
  const partners = useResolvedPartners()
  const onPartnerChange = (next: string) => {
    if (next === '') {
      // explicit clear — null sentinel in the override layer
      setUserOverride(user.id, { partnerId: null, partnerAdmin: undefined })
    } else {
      setUserOverride(user.id, { partnerId: next })
    }
  }
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-secondary">
        <Briefcase size={12} strokeWidth={1.5} className="text-sys-orange" />
        PARTNER · TEAM
      </legend>
      <label className="flex flex-col gap-1">
        <span className="font-mono text-[9px] tracking-widest text-muted">
          PERTENECE A
        </span>
        <select
          value={user.partnerId ?? ''}
          onChange={(e) => onPartnerChange(e.target.value)}
          className="border border-border bg-base px-2 py-1.5 font-mono text-[11px] text-primary focus:border-sys-orange focus:outline-none"
        >
          <option value="">— ninguno —</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
              {p.marketplaceEnabled ? ' · MKT' : ''}
            </option>
          ))}
        </select>
      </label>

      {/* Partner-admin toggle — only meaningful when partnerId is set. */}
      <label className="flex items-center gap-2 font-mono text-[10px] tracking-widest">
        <input
          type="checkbox"
          disabled={!user.partnerId}
          checked={!!user.partnerAdmin}
          onChange={(e) =>
            setUserOverride(user.id, { partnerAdmin: e.target.checked || undefined })
          }
          className="accent-sys-orange disabled:opacity-30"
        />
        <ShieldCheck
          size={12}
          strokeWidth={1.5}
          className={user.partnerAdmin ? 'text-sys-orange' : 'text-muted'}
        />
        <span className={user.partnerId ? 'text-secondary' : 'text-muted/50'}>
          PARTNER · ADMIN
        </span>
      </label>
      <p className="font-mono text-[10px] leading-relaxed text-muted">
        El partner-admin puede agregar y quitar miembros de su propio equipo
        desde la sección del partner. No afecta otros partners.
      </p>
    </fieldset>
  )
}

// ── Identity block ─────────────────────────────────────────────────────────

function IdentityBlock({ user }: { user: User }) {
  return (
    <div className="flex flex-col gap-1 border border-border/60 bg-black/30 p-3 font-mono text-[10px] leading-relaxed text-muted">
      <Row label="DISPLAY" value={user.displayName} />
      <Row label="USERNAME" value={`@${user.username}`} />
      <Row label="ID" value={user.id} />
      <Row label="JOINED" value={user.joinedAt.slice(0, 10)} />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-20 shrink-0 tracking-widest text-secondary/60">
        {label}
      </span>
      <span className="text-secondary">{value}</span>
    </div>
  )
}

// ── Role editor ────────────────────────────────────────────────────────────

function RoleEditor({
  user,
  disabled,
  warnSelfDemote,
}: {
  user: User
  disabled: boolean
  warnSelfDemote: (next: Role) => boolean
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 font-mono text-[10px] tracking-widest text-secondary">
        ROL · CREATION TIER
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {ROLE_OPTIONS.map((role) => {
          const active = user.role === role
          const blocked = warnSelfDemote(role)
          const color = ROLE_COLOR[role]
          return (
            <button
              key={role}
              type="button"
              disabled={disabled || blocked}
              onClick={() => setUserOverride(user.id, { role })}
              className="flex items-center gap-1.5 border px-2 py-1 font-mono text-[10px] tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-30"
              style={{
                borderColor: active ? color : '#3a3a3a',
                color: active ? color : '#9CA3AF',
                backgroundColor: active ? `${color}1a` : 'transparent',
              }}
              title={blocked ? 'No puedes degradarte a ti mismo' : ROLE_LABEL[role]}
            >
              <Save size={10} strokeWidth={1.5} className={active ? '' : 'opacity-0'} />
              {ROLE_LABEL[role]}
            </button>
          )
        })}
      </div>
      <p className="font-mono text-[10px] leading-relaxed text-muted">
        Capacidad de creación. <span style={{ color: ROLE_COLOR.guide }}>guide</span> y{' '}
        <span style={{ color: ROLE_COLOR.insider }}>insider</span> son hermanos
        (mismo poder, distinto framing editorial).
      </p>
    </fieldset>
  )
}

// ── Flag toggle ────────────────────────────────────────────────────────────

function FlagToggle({
  label,
  flag,
  description,
  color,
  icon,
  checked,
  onChange,
}: {
  label: string
  flag: 'mod' | 'og'
  description: string
  color: string
  icon: React.ReactNode
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-secondary">
        <span style={{ color }}>{icon}</span>
        BANDERA · {label}
      </legend>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`Activar bandera ${label}`}
        data-flag={flag}
        onClick={() => onChange(!checked)}
        className="flex items-center gap-2 border px-3 py-2 font-mono text-[11px] transition-colors"
        style={{
          borderColor: checked ? color : '#3a3a3a',
          color: checked ? color : '#9CA3AF',
          backgroundColor: checked ? `${color}14` : 'transparent',
        }}
      >
        <span
          aria-hidden
          className="grid h-4 w-4 place-items-center border"
          style={{
            borderColor: checked ? color : '#3a3a3a',
            backgroundColor: checked ? color : 'transparent',
            color: '#0a0a0a',
          }}
        >
          {checked ? '✓' : ''}
        </span>
        <span className="tracking-widest">
          {checked ? 'ACTIVADA' : 'DESACTIVADA'}
        </span>
      </button>
      <p className="font-mono text-[10px] leading-relaxed text-muted">
        {description}
      </p>
    </fieldset>
  )
}
