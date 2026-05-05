'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Database } from '@/lib/supabase/database.types'
import type { PartnerOption } from '@/app/admin/page'

type UserRow = Database['public']['Tables']['users']['Row']
type Role = Database['public']['Enums']['user_role']

const ROLE_LABEL: Record<Role, string> = {
  user: 'USER',
  curator: 'CURATOR',
  guide: 'GUIDE',
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

// AdminUsersEditor (v2) — admin-only role/flag editor designed to scale to
// thousands of users without paginating on first load.
//
// - Default list: pre-fetched ELEVATED users only (role != user OR is_mod
//   OR is_og OR has partner_id). At any scale this set stays small (~50
//   even at 10k accounts) — it's the audit-staff workflow.
// - Search bar: debounced API hit (/api/admin/users/search?q=) returns up
//   to 25 matches via ilike on username/display_name. Covers the
//   "find a specific user to promote/demote" workflow.
// - Stats strip: totals at-a-glance so admins don't need to count rows.
// - Editor: inline form per row. Self-demote shows a warning chip.
//
// PATCHes /api/admin/users/[id] which RLS-gates via users_admin_all.
// Username + display_name are intentionally read-only here (identity-stable
// + user-managed respectively).
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
  const [editingId, setEditingId] = useState<string | null>(null)
  // Stat-strip filter. `null` = no filter. Roles narrow by `role`; 'mod'
  // narrows by `is_mod = true` (mod is a flag, not a role). Filter only
  // applies to the elevated-users list — when searching, the search
  // query takes over.
  const [statFilter, setStatFilter] = useState<Role | 'mod' | null>(null)

  const partnerById = useMemo(
    () => new Map(partners.map((p) => [p.id, p])),
    [partners],
  )

  // Debounce search hits — fires 250ms after the last keystroke. Empty /
  // <2-char queries clear results so the elevated list takes over again.
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

  // Search results bypass the stat filter (the query is its own scope).
  // Elevated list narrows by the active stat filter when one is set.
  const filteredElevated = useMemo(() => {
    if (!statFilter) return elevatedUsers
    if (statFilter === 'mod') return elevatedUsers.filter((u) => u.is_mod)
    return elevatedUsers.filter((u) => u.role === statFilter)
  }, [elevatedUsers, statFilter])

  // Recent signups list — dedupe against the elevated set so a recently-
  // promoted admin doesn't render twice.
  const elevatedIds = useMemo(
    () => new Set(elevatedUsers.map((u) => u.id)),
    [elevatedUsers],
  )
  const recentOnlyUsers = useMemo(
    () => recentUsers.filter((u) => !elevatedIds.has(u.id)),
    [recentUsers, elevatedIds],
  )

  // When a search or stat filter is active, the recent section hides — the
  // active query takes over the visible surface to avoid mixed signals.
  const showRecentSection = !searchResults && !statFilter && recentOnlyUsers.length > 0

  const visibleUsers = searchResults ?? filteredElevated
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
          Por defecto se muestran usuarios con permisos elevados. Para
          encontrar a alguien específico (incluyendo lectores normales),
          buscá por @username o nombre.
        </p>
      </header>

      {/* Stats strip — orientation + filter chips. Click any chip to narrow
          the elevated list to that role/flag; click again or click TODOS to
          clear. TOTAL acts as the "clear filter" affordance. */}
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

      {showRecentSection && (
        <>
          <p className="-mb-2 font-mono text-[9px] tracking-widest text-muted">
            // recientes ({recentOnlyUsers.length}) — registros más nuevos que aún no tienen rol elevado
          </p>
          <ul className="flex flex-col divide-y divide-border/50 border border-border/50">
            {recentOnlyUsers.map((u) =>
              editingId === u.id ? (
                <UserRowEditing
                  key={u.id}
                  user={u}
                  partners={partners}
                  isSelf={u.id === selfId}
                  onCancel={() => setEditingId(null)}
                  onSaved={() => {
                    setEditingId(null)
                    router.refresh()
                  }}
                />
              ) : (
                <UserRowCollapsed
                  key={u.id}
                  user={u}
                  partnerTitle={u.partner_id ? partnerById.get(u.partner_id)?.title ?? null : null}
                  onEdit={() => setEditingId(u.id)}
                />
              ),
            )}
          </ul>
          <p className="-mb-2 mt-2 font-mono text-[9px] tracking-widest text-muted">
            // elevados ({elevatedUsers.length})
          </p>
        </>
      )}

      <ul className="flex flex-col divide-y divide-border/50 border border-border/50">
        {visibleUsers.length === 0 && (
          <li className="px-3 py-4 font-mono text-[11px] text-muted">
            // sin resultados
          </li>
        )}
        {visibleUsers.map((u) =>
          editingId === u.id ? (
            <UserRowEditing
              key={u.id}
              user={u}
              partners={partners}
              isSelf={u.id === selfId}
              onCancel={() => setEditingId(null)}
              onSaved={() => {
                setEditingId(null)
                router.refresh()
              }}
            />
          ) : (
            <UserRowCollapsed
              key={u.id}
              user={u}
              partnerTitle={u.partner_id ? partnerById.get(u.partner_id)?.title ?? null : null}
              onEdit={() => setEditingId(u.id)}
            />
          ),
        )}
      </ul>
    </section>
  )
}

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

function UserRowCollapsed({
  user,
  partnerTitle,
  onEdit,
}: {
  user: UserRow
  partnerTitle: string | null
  onEdit: () => void
}) {
  const role = user.role as Role
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2.5">
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
          <span className="border border-sys-red px-1.5 py-0.5 font-mono text-[9px] tracking-widest text-sys-red">
            MOD
          </span>
        )}
        {user.is_og && (
          <span className="border border-yellow-400 px-1.5 py-0.5 font-mono text-[9px] tracking-widest text-yellow-400">
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
        <button
          type="button"
          onClick={onEdit}
          className="border border-border px-2 py-0.5 font-mono text-[9px] tracking-widest text-muted transition-colors hover:border-white/40 hover:text-primary"
        >
          EDITAR
        </button>
      </div>
    </li>
  )
}

function UserRowEditing({
  user,
  partners,
  isSelf,
  onCancel,
  onSaved,
}: {
  user: UserRow
  partners: PartnerOption[]
  isSelf: boolean
  onCancel: () => void
  onSaved: () => void
}) {
  const [role, setRole] = useState<Role>(user.role as Role)
  const [isMod, setIsMod] = useState(!!user.is_mod)
  const [isOg, setIsOg] = useState(!!user.is_og)
  const [partnerId, setPartnerId] = useState(user.partner_id ?? '')
  const [partnerAdmin, setPartnerAdmin] = useState(!!user.partner_admin)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Self-demotion guard: warn (don't block) if the admin is editing their
  // own row and dropping out of admin role. Locking yourself out of /admin
  // is recoverable via Studio but annoying.
  const selfDemoteWarning =
    isSelf && user.role === 'admin' && role !== 'admin'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
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
      onSaved()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <li className="flex flex-col gap-3 bg-elevated/40 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[12px] text-primary">
          @{user.username} <span className="text-muted">· {user.display_name}</span>
        </span>
        {isSelf && (
          <span
            className="border px-1.5 py-0.5 font-mono text-[9px] tracking-widest"
            style={{ borderColor: '#F97316', color: '#F97316' }}
          >
            // ESTÁS EDITANDO TU PROPIO USUARIO
          </span>
        )}
      </div>
      <form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
        <label className="flex flex-col gap-1 font-mono text-[10px] tracking-widest text-muted">
          ROL
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="border border-border bg-base px-2 py-1.5 font-mono text-[11px] text-primary focus:border-white/40 focus:outline-none"
          >
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 font-mono text-[10px] tracking-widest text-muted">
          PARTNER
          <select
            value={partnerId}
            onChange={(e) => setPartnerId(e.target.value)}
            className="border border-border bg-base px-2 py-1.5 font-mono text-[11px] text-primary focus:border-white/40 focus:outline-none"
          >
            <option value="">— ninguno —</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 font-mono text-[11px] text-secondary">
            <input
              type="checkbox"
              checked={isMod}
              onChange={(e) => setIsMod(e.target.checked)}
              className="accent-sys-red"
            />
            MOD (puede borrar comentarios / threads)
          </label>
          <label className="flex items-center gap-2 font-mono text-[11px] text-secondary">
            <input
              type="checkbox"
              checked={isOg}
              onChange={(e) => setIsOg(e.target.checked)}
              className="accent-yellow-400"
            />
            OG (insignia honoraria)
          </label>
        </div>

        <label className="flex items-center gap-2 font-mono text-[11px] text-secondary">
          <input
            type="checkbox"
            checked={partnerAdmin}
            onChange={(e) => setPartnerAdmin(e.target.checked)}
            disabled={!partnerId}
            className="accent-cyan-400 disabled:opacity-40"
          />
          PARTNER ADMIN (gestiona el equipo del partner)
        </label>

        {selfDemoteWarning && (
          <p className="md:col-span-2 border border-sys-red bg-sys-red/10 px-3 py-2 font-mono text-[10px] leading-relaxed text-sys-red">
            ⚠ TE ESTÁS QUITANDO EL ROL ADMIN. Perderás acceso a /admin tras
            guardar. Solo otro admin (o un cambio en Studio) puede revertirlo.
          </p>
        )}

        {error && (
          <p className="md:col-span-2 font-mono text-[10px] text-sys-red">
            // {error}
          </p>
        )}

        <div className="flex items-center gap-2 md:col-span-2">
          <button
            type="submit"
            disabled={submitting}
            className="border border-sys-green px-3 py-1.5 font-mono text-[10px] tracking-widest text-sys-green transition-colors hover:bg-sys-green/10 disabled:opacity-40"
          >
            {submitting ? 'GUARDANDO...' : 'GUARDAR'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="border border-border px-3 py-1.5 font-mono text-[10px] tracking-widest text-muted transition-colors hover:border-white/40 hover:text-primary disabled:opacity-40"
          >
            CANCELAR
          </button>
        </div>
      </form>
    </li>
  )
}
