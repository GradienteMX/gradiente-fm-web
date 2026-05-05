'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Briefcase, Lock, Search, Shield, ShieldCheck, Star, RotateCcw, Save } from 'lucide-react'
import type { Database } from '@/lib/supabase/database.types'
import type { PartnerOption } from '@/app/admin/page'

type UserRow = Database['public']['Tables']['users']['Row']
type Role = Database['public']['Enums']['user_role']

const ROLE_LABEL: Record<Role, string> = {
  user: 'LECTOR',
  curator: 'CURADOR',
  guide: 'GUÍA',
  insider: 'INSIDER',
  admin: 'ADMIN',
}

const ROLE_COLOR: Record<Role, string> = {
  user: '#888888',
  curator: '#22D3EE',  // cyan — list/poll authoring
  guide: '#A78BFA',    // violet — staff editorial
  insider: '#FB923C',  // orange — scene-side
  admin: '#F97316',    // sys-orange — full perms
}

const ROLE_OPTIONS: Role[] = ['user', 'curator', 'guide', 'insider', 'admin']

const FLAG_COLOR = {
  mod: '#EF4444',
  og: '#FACC15',
} as const

// AdminUsersEditor (v3) — two-pane panel editor backed by the real DB.
//
// Replaced the v2 inline-edit flow + the dashboard's PermisosSection
// (which simulated edits in sessionStorage over MOCK_USERS, so it never
// reflected the live DB). Same UX shape as the old PermisosSection,
// real writes via PATCH /api/admin/users/[id].
//
// Layout:
//   - Top: stats strip + search + filter chips
//   - Grid (md+): list pane left, editor panel right (360px)
//   - List pane shows two sections when no search/filter: //RECIENTES
//     (last 25 by joined_at, deduped against elevated) and //ELEVADOS
//     (anyone with a non-default role/flag)
//   - Editor panel: IdentityBlock + RoleEditor (button row) + MOD/OG
//     full toggles + PartnerEditor + Save/Reset/Cancel
//
// Save button submits all changes in one PATCH, then router.refresh()
// so the list reflects the change.
export function AdminUsersEditor({
  elevatedUsers,
  recentUsers,
  partners,
  selfId,
  totalUsers,
  roleCounts,
  modCount,
}: {
  elevatedUsers: UserRow[]
  recentUsers: UserRow[]
  partners: PartnerOption[]
  selfId: string
  totalUsers: number
  roleCounts: Partial<Record<string, number>>
  modCount: number
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UserRow[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Stat-strip filter. `null` = no filter. Roles narrow by `role`; 'mod'
  // narrows by `is_mod = true` (mod is a flag, not a role).
  const [statFilter, setStatFilter] = useState<Role | 'mod' | null>(null)

  const partnerById = useMemo(
    () => new Map(partners.map((p) => [p.id, p])),
    [partners],
  )

  // Debounce search hits — fires 250ms after the last keystroke. Empty /
  // <2-char queries clear results so the list pane goes back to the
  // recent + elevated sections.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setSearchResults(null)
      return
    }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/users/search?q=${encodeURIComponent(q)}`,
        )
        if (!res.ok) {
          setSearchResults([])
          return
        }
        const json = await res.json()
        setSearchResults((json.users as UserRow[] | undefined) ?? [])
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  const filteredElevated = useMemo(() => {
    if (!statFilter) return elevatedUsers
    if (statFilter === 'mod') return elevatedUsers.filter((u) => u.is_mod)
    return elevatedUsers.filter((u) => u.role === statFilter)
  }, [elevatedUsers, statFilter])

  const elevatedIds = useMemo(
    () => new Set(elevatedUsers.map((u) => u.id)),
    [elevatedUsers],
  )
  const recentOnlyUsers = useMemo(
    () => recentUsers.filter((u) => !elevatedIds.has(u.id)),
    [recentUsers, elevatedIds],
  )

  const showRecentSection =
    !searchResults && !statFilter && recentOnlyUsers.length > 0

  // Selection lookup — search across all the buckets the user could be in.
  const selectedUser = useMemo(() => {
    if (!selectedId) return null
    return (
      searchResults?.find((u) => u.id === selectedId) ??
      elevatedUsers.find((u) => u.id === selectedId) ??
      recentUsers.find((u) => u.id === selectedId) ??
      null
    )
  }, [selectedId, searchResults, elevatedUsers, recentUsers])

  const filterLabel =
    statFilter === 'mod' ? 'MOD' : statFilter ? ROLE_LABEL[statFilter] : null
  const listLabel = searchResults
    ? `${searchResults.length} resultado${searchResults.length === 1 ? '' : 's'}`
    : filterLabel
    ? `${filteredElevated.length} con rol/flag ${filterLabel}`
    : `${elevatedUsers.length} con permisos elevados`

  return (
    <section className="flex flex-col gap-4 border border-border p-4">
      <header className="flex flex-col gap-1">
        <span
          className="font-mono text-[10px] tracking-widest"
          style={{ color: '#A78BFA' }}
        >
          //ROLES + FLAGS
        </span>
        <h2 className="font-syne text-xl font-bold leading-tight text-primary">
          Usuarios
        </h2>
        <p className="font-mono text-[10px] leading-relaxed text-muted">
          Por defecto se muestran usuarios con permisos elevados + los registros
          más nuevos. Para encontrar a alguien específico, buscá por @username
          o nombre.
        </p>
      </header>

      {/* Stats strip — orientation + filter chips. */}
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 border-y border-border/50 px-1 py-2 font-mono text-[10px] tracking-widest">
        <StatChip label="TODOS" value={totalUsers} color="#888888" active={statFilter === null} onClick={() => setStatFilter(null)} />
        <StatChip label="ADMIN" value={roleCounts.admin ?? 0} color={ROLE_COLOR.admin} active={statFilter === 'admin'} onClick={() => setStatFilter((s) => (s === 'admin' ? null : 'admin'))} />
        <StatChip label="GUIDE" value={roleCounts.guide ?? 0} color={ROLE_COLOR.guide} active={statFilter === 'guide'} onClick={() => setStatFilter((s) => (s === 'guide' ? null : 'guide'))} />
        <StatChip label="CURATOR" value={roleCounts.curator ?? 0} color={ROLE_COLOR.curator} active={statFilter === 'curator'} onClick={() => setStatFilter((s) => (s === 'curator' ? null : 'curator'))} />
        <StatChip label="INSIDER" value={roleCounts.insider ?? 0} color={ROLE_COLOR.insider} active={statFilter === 'insider'} onClick={() => setStatFilter((s) => (s === 'insider' ? null : 'insider'))} />
        <StatChip label="MOD" value={modCount} color="#EF4444" active={statFilter === 'mod'} onClick={() => setStatFilter((s) => (s === 'mod' ? null : 'mod'))} />
      </div>

      {searchResults && statFilter && (
        <p className="font-mono text-[9px] tracking-widest text-muted">
          // búsqueda activa — el filtro de chip está en pausa
        </p>
      )}

      <div className="flex items-center gap-2 border border-border bg-elevated/30 px-2 py-1.5">
        <Search size={12} strokeWidth={1.5} className="text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="buscar @username o nombre (mín. 2 caracteres)..."
          className="flex-1 bg-transparent font-mono text-[11px] text-primary placeholder:text-muted focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Limpiar búsqueda"
            className="font-mono text-[10px] tracking-widest text-muted hover:text-primary"
          >
            ×
          </button>
        )}
      </div>

      <div className="flex items-center justify-between font-mono text-[9px] tracking-widest text-muted">
        <span>// {listLabel}</span>
        {searching && <span className="text-sys-green">// BUSCANDO...</span>}
      </div>

      {/* Two-pane layout — list left, editor right. Side-by-side at lg+;
          stacks below to keep the list rows from getting squeezed. min-w-0
          on each column lets long IDs/usernames truncate inside the panes
          instead of pushing the grid wider than its container. */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_360px]">
        {/* LEFT — searchable user list */}
        <div className="flex min-w-0 flex-col gap-3">
          {showRecentSection && (
            <>
              <p className="font-mono text-[9px] tracking-widest text-muted">
                // recientes ({recentOnlyUsers.length}) — registros más nuevos sin rol elevado
              </p>
              <ul className="flex flex-col divide-y divide-border/50 border border-border/50">
                {recentOnlyUsers.map((u) => (
                  <UserListRow
                    key={u.id}
                    user={u}
                    selected={selectedId === u.id}
                    partnerTitle={u.partner_id ? partnerById.get(u.partner_id)?.title ?? null : null}
                    onSelect={() => setSelectedId(u.id)}
                  />
                ))}
              </ul>
              <p className="-mb-1 font-mono text-[9px] tracking-widest text-muted">
                // elevados ({elevatedUsers.length})
              </p>
            </>
          )}

          <ul className="flex flex-col divide-y divide-border/50 border border-border/50">
            {(searchResults ?? filteredElevated).length === 0 && (
              <li className="px-3 py-4 font-mono text-[11px] text-muted">
                // sin resultados
              </li>
            )}
            {(searchResults ?? filteredElevated).map((u) => (
              <UserListRow
                key={u.id}
                user={u}
                selected={selectedId === u.id}
                partnerTitle={u.partner_id ? partnerById.get(u.partner_id)?.title ?? null : null}
                onSelect={() => setSelectedId(u.id)}
              />
            ))}
          </ul>
        </div>

        {/* RIGHT — editor for the selected user */}
        <div className="flex min-w-0 flex-col gap-3">
          {selectedUser ? (
            <UserEditorPanel
              key={selectedUser.id}
              user={selectedUser}
              partners={partners}
              isSelf={selectedUser.id === selfId}
              onSaved={() => router.refresh()}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <EmptyEditor count={totalUsers} />
          )}
        </div>
      </div>
    </section>
  )
}

// ── Stat chip ──────────────────────────────────────────────────────────────

function StatChip({
  label,
  value,
  color,
  active,
  onClick,
}: {
  label: string
  value: number
  color: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex items-center gap-1 border px-2 py-0.5 transition-colors"
      style={{
        borderColor: active ? color : 'transparent',
        backgroundColor: active ? `${color}14` : 'transparent',
      }}
    >
      <span style={{ color: active ? color : '#888888' }}>{label}</span>
      <span style={{ color }} className="tabular-nums">{value}</span>
    </button>
  )
}

// ── User list row (selection-only, no inline edit) ────────────────────────

function UserListRow({
  user,
  selected,
  partnerTitle,
  onSelect,
}: {
  user: UserRow
  selected: boolean
  partnerTitle: string | null
  onSelect: () => void
}) {
  const role = user.role as Role
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={[
          'flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors',
          selected ? 'bg-sys-orange/10' : 'hover:bg-white/[0.02]',
        ].join(' ')}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-mono text-[12px] text-primary">
            @{user.username}
          </span>
          <span className="hidden truncate font-mono text-[10px] text-muted sm:inline">
            · {user.display_name}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className="border px-1.5 py-0.5 font-mono text-[9px] tracking-widest"
            style={{ borderColor: ROLE_COLOR[role], color: ROLE_COLOR[role] }}
          >
            {ROLE_LABEL[role]}
          </span>
          {user.is_mod && (
            <span className="border px-1.5 py-0.5 font-mono text-[9px] tracking-widest" style={{ borderColor: FLAG_COLOR.mod, color: FLAG_COLOR.mod }}>
              MOD
            </span>
          )}
          {user.is_og && (
            <span className="border px-1.5 py-0.5 font-mono text-[9px] tracking-widest" style={{ borderColor: FLAG_COLOR.og, color: FLAG_COLOR.og }}>
              OG
            </span>
          )}
          {partnerTitle && (
            <span
              className="hidden max-w-[140px] truncate border border-border px-1.5 py-0.5 font-mono text-[9px] tracking-widest text-muted md:inline"
              title={partnerTitle}
            >
              {user.partner_admin ? '★ ' : ''}{partnerTitle}
            </span>
          )}
          <span aria-hidden className="font-mono text-[10px] text-muted">›</span>
        </div>
      </button>
    </li>
  )
}

// ── Empty editor state ────────────────────────────────────────────────────

function EmptyEditor({ count }: { count: number }) {
  return (
    <div className="flex flex-col items-start gap-2 border border-dashed border-border bg-elevated/30 px-4 py-8 font-mono text-[11px] leading-relaxed text-muted">
      <span className="tracking-widest" style={{ color: '#3a3a3a' }}>
        //SIN·SELECCIÓN
      </span>
      <p>
        Elegí un usuario de la lista para editar su rol y banderas. Hay {count}{' '}
        usuarios registrados.
      </p>
    </div>
  )
}

// ── Editor panel (the right pane) ─────────────────────────────────────────

function UserEditorPanel({
  user,
  partners,
  isSelf,
  onSaved,
  onClose,
}: {
  user: UserRow
  partners: PartnerOption[]
  isSelf: boolean
  onSaved: () => void
  onClose: () => void
}) {
  const initialRole = user.role as Role
  const [role, setRole] = useState<Role>(initialRole)
  const [isMod, setIsMod] = useState(!!user.is_mod)
  const [isOg, setIsOg] = useState(!!user.is_og)
  const [partnerId, setPartnerId] = useState<string>(user.partner_id ?? '')
  const [partnerAdmin, setPartnerAdmin] = useState(!!user.partner_admin)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  // Self-demote guard: warn (don't block) if the admin is editing their
  // own row and dropping out of admin role.
  const wouldDemoteSelf = isSelf && initialRole === 'admin' && role !== 'admin'

  // Dirty-check — disables SAVE when there's nothing pending.
  const dirty =
    role !== initialRole ||
    isMod !== !!user.is_mod ||
    isOg !== !!user.is_og ||
    (partnerId || null) !== (user.partner_id ?? null) ||
    partnerAdmin !== !!user.partner_admin

  const reset = () => {
    setRole(initialRole)
    setIsMod(!!user.is_mod)
    setIsOg(!!user.is_og)
    setPartnerId(user.partner_id ?? '')
    setPartnerAdmin(!!user.partner_admin)
    setError(null)
  }

  const submit = async () => {
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          role,
          is_mod: isMod,
          is_og: isOg,
          partner_id: partnerId.trim() || null,
          partner_admin: partnerAdmin,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'FAILED' }))
        setError((body.error ?? 'FAILED').toString().toUpperCase())
        return
      }
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 1500)
      onSaved()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col border border-border bg-elevated/30">
      <header className="flex items-center justify-between border-b border-border bg-elevated/60 px-3 py-2 font-mono text-[10px] tracking-widest text-secondary">
        <span className="flex items-center gap-2">
          <Lock size={12} strokeWidth={1.5} className="text-sys-orange" />
          EDITOR · @{user.username}
        </span>
        <div className="flex items-center gap-2">
          {dirty && !submitting && (
            <button
              type="button"
              onClick={reset}
              className="flex items-center gap-1 border border-border px-2 py-0.5 text-[9px] text-muted transition-colors hover:border-sys-orange hover:text-sys-orange"
              title="Descartar cambios"
            >
              <RotateCcw size={10} strokeWidth={1.5} /> RESETEAR
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar editor"
            className="border border-border px-2 py-0.5 text-[10px] text-muted transition-colors hover:border-white/40 hover:text-primary"
          >
            ×
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-4 p-4">
        <IdentityBlock user={user} />

        <RoleEditor
          value={role}
          onChange={setRole}
          isSelf={isSelf}
          initialRole={initialRole}
        />

        <FlagToggle
          label="MOD"
          description="Capacidad de borrar comentarios y hilos del foro. Independiente del rol."
          color={FLAG_COLOR.mod}
          icon={<Shield size={12} strokeWidth={1.5} />}
          checked={isMod}
          onChange={setIsMod}
        />

        <FlagToggle
          label="OG"
          description="Insignia cosmética para registros de la primera oleada. Sin capacidad asociada."
          color={FLAG_COLOR.og}
          icon={<Star size={12} strokeWidth={1.5} />}
          checked={isOg}
          onChange={setIsOg}
        />

        <PartnerEditor
          partners={partners}
          partnerId={partnerId}
          onPartnerChange={(next) => {
            setPartnerId(next)
            // Clear partner-admin when partner is cleared.
            if (!next) setPartnerAdmin(false)
          }}
          partnerAdmin={partnerAdmin}
          onPartnerAdminChange={setPartnerAdmin}
        />

        {wouldDemoteSelf && (
          <p
            className="border border-dashed px-3 py-2 font-mono text-[10px] leading-relaxed"
            style={{ borderColor: '#E63329', color: '#9CA3AF' }}
          >
            //AUTOEDICIÓN — te estás quitando el rol{' '}
            <span style={{ color: '#F87171' }}>admin</span>. Perderás acceso a{' '}
            /admin tras guardar. Solo otro admin (o un cambio en Studio) puede
            revertirlo.
          </p>
        )}

        {error && (
          <p className="font-mono text-[10px] text-sys-red">// {error}</p>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !dirty}
            className="flex items-center gap-1.5 border border-sys-green px-3 py-1.5 font-mono text-[10px] tracking-widest text-sys-green transition-colors hover:bg-sys-green/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save size={10} strokeWidth={1.5} />
            {submitting ? 'GUARDANDO...' : 'GUARDAR'}
          </button>
          {savedFlash && (
            <span className="font-mono text-[10px] tracking-widest text-sys-green">
              ◉ GUARDADO
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Identity block ────────────────────────────────────────────────────────

function IdentityBlock({ user }: { user: UserRow }) {
  return (
    <div className="flex flex-col gap-1 border border-border/60 bg-black/30 p-3 font-mono text-[10px] leading-relaxed text-muted">
      <Row label="DISPLAY" value={user.display_name} />
      <Row label="USERNAME" value={`@${user.username}`} />
      <Row label="ID" value={user.id} mono />
      <Row label="JOINED" value={user.joined_at.slice(0, 10)} />
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <span className="w-20 shrink-0 tracking-widest text-secondary/60">{label}</span>
      <span
        className={`min-w-0 flex-1 text-secondary ${mono ? 'truncate' : ''}`}
        title={mono ? value : undefined}
      >
        {value}
      </span>
    </div>
  )
}

// ── Role editor ───────────────────────────────────────────────────────────

function RoleEditor({
  value,
  onChange,
  isSelf,
  initialRole,
}: {
  value: Role
  onChange: (next: Role) => void
  isSelf: boolean
  initialRole: Role
}) {
  // Self-demote allowed but warned in the parent — buttons stay enabled
  // here so the user can act on the warning. This matches PermisosSection's
  // intent: warn loudly, don't lock.
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 font-mono text-[10px] tracking-widest text-secondary">
        ROL · CREATION TIER
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {ROLE_OPTIONS.map((role) => {
          const active = value === role
          const color = ROLE_COLOR[role]
          return (
            <button
              key={role}
              type="button"
              onClick={() => onChange(role)}
              className="flex items-center gap-1.5 border px-2 py-1 font-mono text-[10px] tracking-widest transition-colors"
              style={{
                borderColor: active ? color : '#3a3a3a',
                color: active ? color : '#9CA3AF',
                backgroundColor: active ? `${color}1a` : 'transparent',
              }}
              title={ROLE_LABEL[role]}
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
      {isSelf && initialRole === 'admin' && value === 'admin' && (
        <p className="font-mono text-[10px] leading-relaxed text-muted">
          // editando tu propio rol — puedes auto-degradarte pero te avisaremos antes de guardar
        </p>
      )}
    </fieldset>
  )
}

// ── Flag toggle ───────────────────────────────────────────────────────────

function FlagToggle({
  label,
  description,
  color,
  icon,
  checked,
  onChange,
}: {
  label: string
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
      <p className="font-mono text-[10px] leading-relaxed text-muted">{description}</p>
    </fieldset>
  )
}

// ── Partner team editor ───────────────────────────────────────────────────

function PartnerEditor({
  partners,
  partnerId,
  onPartnerChange,
  partnerAdmin,
  onPartnerAdminChange,
}: {
  partners: PartnerOption[]
  partnerId: string
  onPartnerChange: (next: string) => void
  partnerAdmin: boolean
  onPartnerAdminChange: (next: boolean) => void
}) {
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
          value={partnerId}
          onChange={(e) => onPartnerChange(e.target.value)}
          className="border border-border bg-base px-2 py-1.5 font-mono text-[11px] text-primary focus:border-sys-orange focus:outline-none"
        >
          <option value="">— ninguno —</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 font-mono text-[10px] tracking-widest">
        <input
          type="checkbox"
          disabled={!partnerId}
          checked={partnerAdmin}
          onChange={(e) => onPartnerAdminChange(e.target.checked)}
          className="accent-sys-orange disabled:opacity-30"
        />
        <ShieldCheck
          size={12}
          strokeWidth={1.5}
          className={partnerAdmin ? 'text-sys-orange' : 'text-muted'}
        />
        <span className={partnerId ? 'text-secondary' : 'text-muted/50'}>
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
