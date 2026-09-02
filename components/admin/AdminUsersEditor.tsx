'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Briefcase, Search, Shield, ShieldCheck, Star, RotateCcw } from 'lucide-react'
import type { Database } from '@/lib/supabase/database.types'
import type { FranjaOption } from '@/app/admin/page'

type UserRow = Database['public']['Tables']['users']['Row']
type Role = Database['public']['Enums']['user_role']

const ROLE_LABEL: Record<Role, string> = {
  user: 'LECTOR',
  curator: 'CURADOR',
  guide: 'GUÍA',
  insider: 'INSIDER',
  admin: 'ADMIN',
}

const ROLE_OPTIONS: Role[] = ['user', 'curator', 'guide', 'insider', 'admin']

const FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

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
//   - List pane shows two sections when no search/filter: RECIENTES
//     (last 25 by joined_at, deduped against elevated) and ELEVADOS
//     (anyone with a non-default role/flag)
//   - Editor panel: IdentityBlock + RoleEditor (button row) + MOD/OG
//     full toggles + FranjaEditor + Save/Reset/Cancel
//
// Save button submits all changes in one PATCH, then router.refresh()
// so the list reflects the change.
//
// «EL PLIEGO» chrome (fase F): the per-role hue map is gone — on paper a
// permission tier is carried by chip WEIGHT (hairline vs ink fill), never by
// colour, so the pane stays readable and the ink discipline holds. The only
// coloured register left is sys-red-paper, and it means exactly one thing:
// consequence (the MOD tombstone power, the self-demotion warning).
export function AdminUsersEditor({
  elevatedUsers,
  recentUsers,
  lectorUsers,
  franjas,
  selfId,
  totalUsers,
  roleCounts,
  modCount,
}: {
  elevatedUsers: UserRow[]
  recentUsers: UserRow[]
  lectorUsers: UserRow[]
  franjas: FranjaOption[]
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

  const franjaById = useMemo(
    () => new Map(franjas.map((p) => [p.id, p])),
    [franjas],
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

  // LECTOR (role='user') has its own prefetched bucket because vanilla
  // readers aren't in elevatedUsers by definition; all other role chips
  // narrow within the elevated set.
  const filteredElevated = useMemo(() => {
    if (!statFilter) return elevatedUsers
    if (statFilter === 'mod') return elevatedUsers.filter((u) => u.is_mod)
    if (statFilter === 'user') return lectorUsers
    return elevatedUsers.filter((u) => u.role === statFilter)
  }, [elevatedUsers, lectorUsers, statFilter])

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
      lectorUsers.find((u) => u.id === selectedId) ??
      null
    )
  }, [selectedId, searchResults, elevatedUsers, recentUsers, lectorUsers])

  const filterLabel =
    statFilter === 'mod' ? 'MOD' : statFilter ? ROLE_LABEL[statFilter] : null
  // LECTOR list shows the prefetched 50; older lectors come in via search.
  const lectorTotal = roleCounts.user ?? 0
  const lectorOverflow = statFilter === 'user' && lectorTotal > lectorUsers.length
  const listLabel = searchResults
    ? `${searchResults.length} resultado${searchResults.length === 1 ? '' : 's'}`
    : statFilter === 'user'
    ? `${lectorUsers.length} de ${lectorTotal} lectores (más recientes primero)`
    : filterLabel
    ? `${filteredElevated.length} con rol/flag ${filterLabel}`
    : `${elevatedUsers.length} con permisos elevados`

  return (
    <section className="flex flex-col gap-4 border border-ink bg-paper-raised p-5">
      <header className="flex flex-col gap-1">
        <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
          ROLES + BANDERAS
        </span>
        <h2 className="font-syne text-d28 font-extrabold uppercase text-ink">
          Usuarios
        </h2>
        <p className="font-grotesk text-d13 leading-snug text-ink-soft">
          Por defecto se muestran usuarios con permisos elevados + los registros
          más nuevos. Para encontrar a alguien específico, buscá por @username
          o nombre.
        </p>
      </header>

      {/* Stats strip — orientation + filter chips. Ordered by tier
          (LECTOR → CURATOR → GUIDE / INSIDER → ADMIN), then MOD flag.
          LECTOR has its own prefetched bucket of the 50 most recent
          role='user' rows; chip count is the global lector total from
          roleCounts. An active chip is an ink fill — the same latch mark
          the tab strip uses. */}
      <div className="flex flex-wrap items-center gap-1.5 border-y border-ink py-2">
        <StatChip label="TODOS" value={totalUsers} active={statFilter === null} onClick={() => setStatFilter(null)} />
        <StatChip label="LECTOR" value={lectorTotal} active={statFilter === 'user'} onClick={() => setStatFilter((s) => (s === 'user' ? null : 'user'))} />
        <StatChip label="CURATOR" value={roleCounts.curator ?? 0} active={statFilter === 'curator'} onClick={() => setStatFilter((s) => (s === 'curator' ? null : 'curator'))} />
        <StatChip label="GUIDE" value={roleCounts.guide ?? 0} active={statFilter === 'guide'} onClick={() => setStatFilter((s) => (s === 'guide' ? null : 'guide'))} />
        <StatChip label="INSIDER" value={roleCounts.insider ?? 0} active={statFilter === 'insider'} onClick={() => setStatFilter((s) => (s === 'insider' ? null : 'insider'))} />
        <StatChip label="ADMIN" value={roleCounts.admin ?? 0} active={statFilter === 'admin'} onClick={() => setStatFilter((s) => (s === 'admin' ? null : 'admin'))} />
        <StatChip label="MOD" value={modCount} active={statFilter === 'mod'} onClick={() => setStatFilter((s) => (s === 'mod' ? null : 'mod'))} />
      </div>

      {lectorOverflow && (
        <p className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
          MOSTRANDO LOS {lectorUsers.length} MÁS RECIENTES DE {lectorTotal} — BUSCÁ POR @USERNAME PARA ENCONTRAR A ALGUIEN ANTERIOR
        </p>
      )}

      {searchResults && statFilter && (
        <p className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
          BÚSQUEDA ACTIVA — EL FILTRO DE CHIP ESTÁ EN PAUSA
        </p>
      )}

      <div className="flex min-h-11 items-center gap-2 border border-ink bg-paper px-3">
        <Search size={13} strokeWidth={1.5} className="shrink-0 text-ink-faint" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="buscar @username o nombre (mín. 2 caracteres)…"
          aria-label="Buscar usuarios"
          className={`min-h-11 flex-1 bg-transparent font-mono text-d13 text-ink placeholder:text-ink-faint ${FOCUS_RING}`}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Limpiar búsqueda"
            className={`shrink-0 border border-ink px-2 py-0.5 font-mono text-d13 text-ink hover:bg-ink hover:text-paper ${FOCUS_RING}`}
          >
            ×
          </button>
        )}
      </div>

      <div className="flex items-center justify-between font-mono text-d11 uppercase tracking-widest text-ink-faint">
        <span>{listLabel}</span>
        {searching && <span className="text-ink">BUSCANDO…</span>}
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
              <p className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
                RECIENTES ({recentOnlyUsers.length}) — REGISTROS MÁS NUEVOS SIN ROL ELEVADO
              </p>
              <ul className="flex flex-col border border-ink bg-paper">
                {recentOnlyUsers.map((u) => (
                  <UserListRow
                    key={u.id}
                    user={u}
                    selected={selectedId === u.id}
                    franjaTitle={u.franja_id ? franjaById.get(u.franja_id)?.title ?? null : null}
                    onSelect={() => setSelectedId(u.id)}
                  />
                ))}
              </ul>
              <p className="-mb-1 font-mono text-d11 uppercase tracking-widest text-ink-faint">
                ELEVADOS ({elevatedUsers.length})
              </p>
            </>
          )}

          <ul className="flex flex-col border border-ink bg-paper">
            {(searchResults ?? filteredElevated).length === 0 && (
              <li className="px-3 py-4 font-mono text-d13 uppercase tracking-widest text-ink-faint">
                SIN RESULTADOS
              </li>
            )}
            {(searchResults ?? filteredElevated).map((u) => (
              <UserListRow
                key={u.id}
                user={u}
                selected={selectedId === u.id}
                franjaTitle={u.franja_id ? franjaById.get(u.franja_id)?.title ?? null : null}
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
              franjas={franjas}
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
  active,
  onClick,
}: {
  label: string
  value: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-cue="latch"
      className={`inline-flex min-h-11 items-center gap-2 border border-ink px-3 font-mono text-d11 font-bold uppercase tracking-widest transition-colors ${FOCUS_RING} ${
        active ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-ink hover:text-paper'
      }`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </button>
  )
}

// ── User list row (selection-only, no inline edit) ────────────────────────

function UserListRow({
  user,
  selected,
  franjaTitle,
  onSelect,
}: {
  user: UserRow
  selected: boolean
  franjaTitle: string | null
  onSelect: () => void
}) {
  const role = user.role as Role
  return (
    <li className="border-b border-ink/15 last:border-b-0">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors ${FOCUS_RING} ${
          selected ? 'bg-ink text-paper' : 'text-ink hover:bg-paper-raised'
        }`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-mono text-d13">@{user.username}</span>
          <span className="hidden truncate font-mono text-d11 opacity-70 sm:inline">
            · {user.display_name}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {/* Tier by weight: ADMIN is the only fill, so it reads first in a
              long list without borrowing a hue. Inside a selected (ink) row
              the chips invert with the row. */}
          <RowChip inverted={selected} filled={role === 'admin'}>
            {ROLE_LABEL[role]}
          </RowChip>
          {/* MOD is the tombstone power — the one consequence register. */}
          {user.is_mod && (
            <RowChip inverted={selected} tone="red">
              MOD
            </RowChip>
          )}
          {user.is_og && <RowChip inverted={selected}>OG</RowChip>}
          {franjaTitle && (
            <span
              className={`hidden max-w-[140px] truncate border px-1.5 py-0.5 font-mono text-d11 uppercase tracking-widest md:inline ${
                selected ? 'border-paper/50 text-paper' : 'border-ink/25 text-ink-faint'
              }`}
              title={franjaTitle}
            >
              {user.franja_admin ? '★ ' : ''}{franjaTitle}
            </span>
          )}
          <span aria-hidden className="font-mono text-d11 opacity-60">›</span>
        </div>
      </button>
    </li>
  )
}

function RowChip({
  children,
  filled,
  tone = 'ink',
  inverted,
}: {
  children: React.ReactNode
  filled?: boolean
  tone?: 'ink' | 'red'
  inverted?: boolean
}) {
  const cls = inverted
    ? 'border-paper text-paper'
    : tone === 'red'
    ? 'border-sys-red-paper text-sys-red-paper'
    : filled
    ? 'border-ink bg-ink text-paper'
    : 'border-ink text-ink'
  return (
    <span
      className={`whitespace-nowrap border px-1.5 py-0.5 font-mono text-d11 font-bold uppercase tracking-widest ${cls}`}
    >
      {children}
    </span>
  )
}

// ── Empty editor state ────────────────────────────────────────────────────

function EmptyEditor({ count }: { count: number }) {
  return (
    <div className="flex flex-col items-start gap-2 border border-dashed border-ink/45 bg-paper px-4 py-8">
      <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
        SIN SELECCIÓN
      </span>
      <p className="font-grotesk text-d13 leading-snug text-ink-soft">
        Elegí un usuario de la lista para editar su rol y banderas. Hay {count}{' '}
        usuarios registrados.
      </p>
    </div>
  )
}

// ── Editor panel (the right pane) ─────────────────────────────────────────

function UserEditorPanel({
  user,
  franjas,
  isSelf,
  onSaved,
  onClose,
}: {
  user: UserRow
  franjas: FranjaOption[]
  isSelf: boolean
  onSaved: () => void
  onClose: () => void
}) {
  const initialRole = user.role as Role
  const [role, setRole] = useState<Role>(initialRole)
  const [isMod, setIsMod] = useState(!!user.is_mod)
  const [isOg, setIsOg] = useState(!!user.is_og)
  const [franjaId, setFranjaId] = useState<string>(user.franja_id ?? '')
  const [franjaAdmin, setFranjaAdmin] = useState(!!user.franja_admin)
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
    (franjaId || null) !== (user.franja_id ?? null) ||
    franjaAdmin !== !!user.franja_admin

  const reset = () => {
    setRole(initialRole)
    setIsMod(!!user.is_mod)
    setIsOg(!!user.is_og)
    setFranjaId(user.franja_id ?? '')
    setFranjaAdmin(!!user.franja_admin)
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
          franja_id: franjaId.trim() || null,
          franja_admin: franjaAdmin,
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
    <div className="flex flex-col border border-ink bg-paper">
      {/* Head — Syne title + chips (the DashPopup anatomy). */}
      <header className="flex flex-wrap items-center gap-2 border-b border-ink px-3 py-2">
        <h3 className="min-w-0 flex-1 truncate font-syne text-d18 font-extrabold uppercase text-ink">
          @{user.username}
        </h3>
        {dirty && !submitting && (
          <button
            type="button"
            onClick={reset}
            title="Descartar cambios"
            className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 border border-ink px-2 font-mono text-d11 font-bold uppercase tracking-widest text-ink hover:bg-ink hover:text-paper ${FOCUS_RING}`}
          >
            <RotateCcw size={11} strokeWidth={1.5} /> RESETEAR
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar editor"
          className={`inline-flex min-h-11 shrink-0 items-center border border-ink px-3 font-mono text-d13 uppercase tracking-widest text-ink hover:bg-ink hover:text-paper ${FOCUS_RING}`}
        >
          CERRAR
        </button>
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
          icon={<Shield size={12} strokeWidth={1.5} />}
          checked={isMod}
          onChange={setIsMod}
        />

        <FlagToggle
          label="OG"
          description="Insignia cosmética para registros de la primera oleada. Sin capacidad asociada."
          icon={<Star size={12} strokeWidth={1.5} />}
          checked={isOg}
          onChange={setIsOg}
        />

        <FranjaEditor
          franjas={franjas}
          franjaId={franjaId}
          onFranjaChange={(next) => {
            setFranjaId(next)
            // Clear franja-admin when franja is cleared.
            if (!next) setFranjaAdmin(false)
          }}
          franjaAdmin={franjaAdmin}
          onFranjaAdminChange={setFranjaAdmin}
        />

        {wouldDemoteSelf && (
          <p className="border border-sys-red-paper px-3 py-2 font-grotesk text-d13 leading-relaxed text-ink">
            <span className="font-mono font-bold uppercase tracking-widest text-sys-red-paper">
              AUTOEDICIÓN ·{' '}
            </span>
            te estás quitando el rol admin. Perderás acceso a /admin tras
            guardar. Solo otro admin (o un cambio en Studio) puede revertirlo.
          </p>
        )}

        {error && (
          <p className="border border-sys-red-paper px-3 py-2 font-mono text-d13 font-bold uppercase tracking-widest text-sys-red-paper">
            ⚠ {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* Primary own-action — the one acid fill-block of the pane. */}
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !dirty}
            className={`inline-flex min-h-11 items-center gap-2 border border-ink bg-acid px-4 font-mono text-d13 font-bold uppercase tracking-widest text-ink transition-colors enabled:hover:bg-ink enabled:hover:text-paper disabled:cursor-not-allowed disabled:opacity-45 ${FOCUS_RING}`}
          >
            {submitting ? 'GUARDANDO…' : 'GUARDAR'}
          </button>
          {savedFlash && (
            <span className="font-mono text-d13 font-bold uppercase tracking-widest text-ink">
              ✓ GUARDADO
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
    <div className="flex flex-col border border-ink bg-paper-raised px-3 py-2">
      <Row label="DISPLAY" value={user.display_name} />
      <Row label="USERNAME" value={`@${user.username}`} />
      <Row label="ID" value={user.id} mono />
      <Row label="JOINED" value={user.joined_at.slice(0, 10)} />
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex min-w-0 items-baseline gap-2 border-b border-ink/15 py-1 last:border-b-0">
      <span className="w-20 shrink-0 font-mono text-d11 uppercase tracking-widest text-ink-faint">
        {label}
      </span>
      <span
        className={`min-w-0 flex-1 font-mono text-d13 text-ink ${mono ? 'truncate' : ''}`}
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
      <legend className="mb-1 font-mono text-d11 uppercase tracking-widest text-ink-soft">
        ROL · CREATION TIER
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {ROLE_OPTIONS.map((role) => {
          const active = value === role
          return (
            <button
              key={role}
              type="button"
              onClick={() => onChange(role)}
              aria-pressed={active}
              data-cue="latch"
              title={ROLE_LABEL[role]}
              className={`inline-flex min-h-11 items-center border border-ink px-3 font-mono text-d11 font-bold uppercase tracking-widest transition-colors ${FOCUS_RING} ${
                active ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-ink hover:text-paper'
              }`}
            >
              {ROLE_LABEL[role]}
            </button>
          )
        })}
      </div>
      <p className="font-grotesk text-d13 leading-snug text-ink-soft">
        Capacidad de creación. <span className="text-ink">guide</span> e{' '}
        <span className="text-ink">insider</span> son hermanos (mismo poder,
        distinto framing editorial).
      </p>
      {isSelf && initialRole === 'admin' && value === 'admin' && (
        <p className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
          EDITANDO TU PROPIO ROL — PUEDES AUTO-DEGRADARTE PERO TE AVISAREMOS ANTES DE GUARDAR
        </p>
      )}
    </fieldset>
  )
}

// ── Flag toggle ───────────────────────────────────────────────────────────

function FlagToggle({
  label,
  description,
  icon,
  checked,
  onChange,
}: {
  label: string
  description: string
  icon: React.ReactNode
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 flex items-center gap-1.5 font-mono text-d11 uppercase tracking-widest text-ink-soft">
        <span aria-hidden>{icon}</span>
        BANDERA · {label}
      </legend>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`Activar bandera ${label}`}
        onClick={() => onChange(!checked)}
        data-cue="latch"
        className={`flex min-h-11 items-center gap-2 border border-ink px-3 font-mono text-d13 font-bold uppercase tracking-widest transition-colors ${FOCUS_RING} ${
          checked ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-paper-raised hover:text-ink'
        }`}
      >
        <span
          aria-hidden
          className={`grid h-4 w-4 place-items-center border ${
            checked ? 'border-paper bg-paper text-ink' : 'border-ink'
          }`}
        >
          {checked ? '✓' : ''}
        </span>
        <span>{checked ? 'ACTIVADA' : 'DESACTIVADA'}</span>
      </button>
      <p className="font-grotesk text-d13 leading-snug text-ink-soft">{description}</p>
    </fieldset>
  )
}

// ── Franja team editor ───────────────────────────────────────────────────

function FranjaEditor({
  franjas,
  franjaId,
  onFranjaChange,
  franjaAdmin,
  onFranjaAdminChange,
}: {
  franjas: FranjaOption[]
  franjaId: string
  onFranjaChange: (next: string) => void
  franjaAdmin: boolean
  onFranjaAdminChange: (next: boolean) => void
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 flex items-center gap-1.5 font-mono text-d11 uppercase tracking-widest text-ink-soft">
        <Briefcase size={12} strokeWidth={1.5} aria-hidden />
        FRANJA · TEAM
      </legend>
      <label className="flex flex-col gap-1">
        <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
          PERTENECE A
        </span>
        <select
          value={franjaId}
          onChange={(e) => onFranjaChange(e.target.value)}
          className={`min-h-11 border border-ink bg-paper-raised px-3 py-2 font-mono text-d13 text-ink transition-colors focus:bg-white ${FOCUS_RING}`}
        >
          <option value="">— ninguno —</option>
          {franjas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-h-11 cursor-pointer items-center gap-2 font-mono text-d13 uppercase tracking-widest">
        <input
          type="checkbox"
          disabled={!franjaId}
          checked={franjaAdmin}
          onChange={(e) => onFranjaAdminChange(e.target.checked)}
          className={`h-4 w-4 accent-ink disabled:opacity-30 ${FOCUS_RING}`}
        />
        <ShieldCheck
          size={13}
          strokeWidth={1.5}
          aria-hidden
          className={franjaAdmin ? 'text-ink' : 'text-ink-faint'}
        />
        <span className={franjaId ? 'text-ink' : 'text-ink-faint'}>FRANJA · ADMIN</span>
      </label>
      <p className="font-grotesk text-d13 leading-snug text-ink-soft">
        El franja-admin puede agregar y quitar miembros de su propio equipo
        desde la sección del franja. No afecta otros franjas.
      </p>
    </fieldset>
  )
}
