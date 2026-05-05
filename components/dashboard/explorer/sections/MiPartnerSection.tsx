'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  Image as ImageIcon,
  Lock,
  MapPin,
  Package,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  ShoppingBag,
  Star,
  Trash2,
  Truck,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react'
import type {
  ContentItem,
  MarketplaceListing,
  MarketplaceListingCategory,
  MarketplaceListingCondition,
  MarketplaceListingStatus,
  MarketplaceShippingMode,
  User,
} from '@/lib/types'
import { SUBCATEGORIES_BY_CATEGORY } from '@/lib/types'
import { useAuth } from '@/components/auth/useAuth'
import { compressAndUploadImage } from '@/lib/imageUpload'
// Listings composer is rendered in read-only mode (canManage=false) — see
// ListingsReadOnlyBanner for the deferral rationale. The sessionStorage
// helpers below are imported only because the existing composer/preview
// code still references them in unreachable code paths; once listings
// persistence ships, this import goes away.
import {
  addMarketplaceListing,
  newListingId,
  removeMarketplaceListing,
  updateMarketplaceListing,
} from '@/lib/partnerOverrides'
import { MarketplaceListingCard } from '@/components/marketplace/MarketplaceListingCard'

// ── MiPartnerSection ───────────────────────────────────────────────────────
//
// Partner-team-only dashboard surface. The dashboard page only mounts this
// when `currentUser.partnerId` is set; the ExplorerSidebar only shows the
// row in the same case. Two tabs:
//
//   EQUIPO       — list of current team members; partner-admin (or site
//                  admin) can add/kick members and promote/demote the
//                  partner-admin flag.
//   MARKETPLACE  — edit the partner's marketplace card (description /
//                  location / currency / image / partner_url) + view of
//                  the per-listing CRUD (writes deferred to a future
//                  slice — see banner inside the listings table).
//
// All edits go through real DB endpoints:
//   - GET/PATCH /api/partners/[id]            — partner profile
//   - GET/POST/PATCH/DELETE /api/partners/[id]/team — team membership
//
// Both are gated server-side: profile edits require canManagePartner
// (any team member); team mutations require canManagePartnerTeam
// (partner-admin or site admin). The UI hides write affordances when
// the gate would deny anyway.

type Tab = 'equipo' | 'marketplace'

// Shape returned by GET /api/partners/[id] mapped to camelCase (matches
// the ContentItem field names downstream so the listings composer + card
// preview don't need to change). Mirrors the columns in the items table
// minus the fields a partner team can't see (curation internals).
interface PartnerData {
  id: string
  slug: string
  title: string
  partnerKind: string | null
  partnerUrl: string | null
  imageUrl: string
  vibeMin: number
  vibeMax: number
  marketplaceEnabled: boolean
  marketplaceDescription: string | null
  marketplaceLocation: string | null
  marketplaceCurrency: string | null
  marketplaceListings: MarketplaceListing[]
}

interface TeamMember {
  id: string
  username: string
  displayName: string
  role: string
  isMod: boolean
  isOg: boolean
  partnerAdmin: boolean
  joinedAt: string
}

// Snake_case → camelCase mappers for the API responses. Keeping the
// downstream component tree on camelCase avoids touching the listings
// composer and the inline ContentItem assumptions deeper in the file.
function mapPartnerRow(row: Record<string, unknown>): PartnerData {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    partnerKind: (row.partner_kind as string | null) ?? null,
    partnerUrl: (row.partner_url as string | null) ?? null,
    imageUrl: String(row.image_url ?? ''),
    vibeMin: Number(row.vibe_min ?? 0),
    vibeMax: Number(row.vibe_max ?? 0),
    marketplaceEnabled: !!row.marketplace_enabled,
    marketplaceDescription: (row.marketplace_description as string | null) ?? null,
    marketplaceLocation: (row.marketplace_location as string | null) ?? null,
    marketplaceCurrency: (row.marketplace_currency as string | null) ?? null,
    marketplaceListings: (row.marketplace_listings as MarketplaceListing[] | null) ?? [],
  }
}

function mapTeamMember(row: Record<string, unknown>): TeamMember {
  return {
    id: String(row.id),
    username: String(row.username),
    displayName: String(row.display_name ?? row.username),
    role: String(row.role ?? 'user'),
    isMod: !!row.is_mod,
    isOg: !!row.is_og,
    partnerAdmin: !!row.partner_admin,
    joinedAt: String(row.joined_at ?? ''),
  }
}

export function MiPartnerSection() {
  const { currentUser } = useAuth()
  const partnerId = currentUser?.partnerId
  const [tab, setTab] = useState<Tab>('marketplace')
  const [partner, setPartner] = useState<PartnerData | null>(null)
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!partnerId) return
    setError(null)
    const [pRes, tRes] = await Promise.all([
      fetch(`/api/partners/${encodeURIComponent(partnerId)}`),
      fetch(`/api/partners/${encodeURIComponent(partnerId)}/team`),
    ])
    if (pRes.ok) {
      const pJson = await pRes.json()
      setPartner(mapPartnerRow(pJson.partner))
    } else {
      const body = await pRes.json().catch(() => ({ error: 'PARTNER_FETCH_FAILED' }))
      setError(body.error?.toString().toUpperCase() ?? 'PARTNER_FETCH_FAILED')
    }
    if (tRes.ok) {
      const tJson = await tRes.json()
      setTeam(((tJson.team as Record<string, unknown>[]) ?? []).map(mapTeamMember))
    }
    setLoading(false)
  }, [partnerId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  // Defensive — the route guard + sidebar gating should keep this branch
  // unreachable, but keep the empty state in case the user clears their
  // own partnerId mid-session.
  if (!currentUser || !partnerId) {
    return (
      <div className="flex flex-col items-start gap-2 border border-dashed border-border bg-elevated/30 px-4 py-8 font-mono text-[11px] text-muted">
        <span className="tracking-widest" style={{ color: '#3a3a3a' }}>
          //SIN·PARTNER
        </span>
        <p>No perteneces a ningún partner. Pide a un admin que te asigne.</p>
      </div>
    )
  }

  if (loading || !partner) {
    return (
      <div className="flex items-center gap-2 border border-dashed border-border bg-elevated/30 px-4 py-8 font-mono text-[11px] text-muted">
        <span className="tracking-widest">//CARGANDO·PARTNER…</span>
        {error && <span className="text-sys-red">{error}</span>}
      </div>
    )
  }

  // Permission helpers — site admin always allowed; team-member checks
  // mirror lib/permissions canManagePartner / canManagePartnerTeam but
  // run against the locally-fetched partner / currentUser shape.
  const canManageProfile =
    currentUser.role === 'admin' || currentUser.partnerId === partner.id
  const canManageTeam =
    currentUser.role === 'admin' ||
    (currentUser.partnerId === partner.id && currentUser.partnerAdmin === true)

  return (
    <div className="flex flex-col gap-4">
      <Header partner={partner} />

      <TabSwitcher tab={tab} onChange={setTab} />

      {tab === 'equipo' ? (
        <EquipoTab
          partner={partner}
          team={team}
          currentUserId={currentUser.id}
          canManageTeam={canManageTeam}
          onRefetch={refetch}
        />
      ) : (
        <MarketplaceTab
          partner={partner}
          canManage={canManageProfile}
          currentUserId={currentUser.id}
          onRefetch={refetch}
          onPartnerPatched={(p) => setPartner(p)}
        />
      )}
    </div>
  )
}

// ── Header ─────────────────────────────────────────────────────────────────

function Header({ partner }: { partner: PartnerData }) {
  return (
    <header className="flex items-start justify-between gap-3 border border-border bg-elevated/30 p-3">
      <div className="flex items-center gap-3">
        <Briefcase size={16} strokeWidth={1.5} className="text-sys-orange" />
        <div className="flex flex-col">
          <span className="font-syne text-base font-bold text-primary">
            {partner.title}
          </span>
          <span className="font-mono text-[10px] tracking-widest text-muted">
            /{partner.slug}
            {partner.partnerKind ? ` · ${partner.partnerKind.toUpperCase()}` : ''}
          </span>
        </div>
      </div>
      <span
        className="shrink-0 border px-1.5 py-px font-mono text-[9px] tracking-widest"
        style={{
          borderColor: partner.marketplaceEnabled ? '#4ADE80' : '#3a3a3a',
          color: partner.marketplaceEnabled ? '#4ADE80' : '#9CA3AF',
        }}
      >
        {partner.marketplaceEnabled ? 'MARKETPLACE ON' : 'MARKETPLACE OFF'}
      </span>
    </header>
  )
}

// ── Tab switcher ───────────────────────────────────────────────────────────

function TabSwitcher({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex gap-1.5 border-b border-border">
      <TabButton
        active={tab === 'marketplace'}
        onClick={() => onChange('marketplace')}
        icon={<ShoppingBag size={12} strokeWidth={1.5} />}
        label="MARKETPLACE"
      />
      <TabButton
        active={tab === 'equipo'}
        onClick={() => onChange('equipo')}
        icon={<UserPlus size={12} strokeWidth={1.5} />}
        label="EQUIPO"
      />
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 border-b-2 px-3 py-2 font-mono text-[10px] tracking-widest transition-colors"
      style={{
        borderBottomColor: active ? '#F97316' : 'transparent',
        color: active ? '#F97316' : '#9CA3AF',
        marginBottom: -1,
      }}
    >
      {icon}
      {label}
    </button>
  )
}

// ── EQUIPO tab ─────────────────────────────────────────────────────────────

function EquipoTab({
  partner,
  team,
  currentUserId,
  canManageTeam,
  onRefetch,
}: {
  partner: PartnerData
  team: TeamMember[]
  currentUserId: string
  canManageTeam: boolean
  onRefetch: () => Promise<void>
}) {
  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2">
        <header className="flex items-center justify-between font-mono text-[10px] tracking-widest text-muted">
          <span>//EQUIPO · ACTIVO</span>
          <span className="tabular-nums">{team.length} MIEMBROS</span>
        </header>

        <ul className="flex flex-col border border-border bg-elevated/30">
          {team.length === 0 ? (
            <li className="px-3 py-6 text-center font-mono text-[11px] text-muted">
              El equipo está vacío.
            </li>
          ) : (
            team.map((u) => (
              <TeamMemberRow
                key={u.id}
                partnerId={partner.id}
                user={u}
                isSelf={u.id === currentUserId}
                canManage={canManageTeam}
                onChanged={onRefetch}
              />
            ))
          )}
        </ul>
      </section>

      {canManageTeam && (
        <AddMemberPicker partnerId={partner.id} onChanged={onRefetch} />
      )}

      {!canManageTeam && (
        <p
          className="border border-dashed px-3 py-2 font-mono text-[10px] leading-relaxed"
          style={{ borderColor: '#3a3a3a', color: '#9CA3AF' }}
        >
          //SOLO·LECTURA — solo el partner-admin del equipo o un admin del
          sitio puede agregar o quitar miembros. Avisa al partner-admin si
          necesitas cambios.
        </p>
      )}
    </div>
  )
}

function TeamMemberRow({
  partnerId,
  user,
  isSelf,
  canManage,
  onChanged,
}: {
  partnerId: string
  user: TeamMember
  isSelf: boolean
  canManage: boolean
  onChanged: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)

  const onTogglePartnerAdmin = async () => {
    setBusy(true)
    try {
      await fetch(`/api/partners/${encodeURIComponent(partnerId)}/team`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          partner_admin: !user.partnerAdmin,
        }),
      })
      await onChanged()
    } finally {
      setBusy(false)
    }
  }

  const onKick = async () => {
    setBusy(true)
    try {
      await fetch(`/api/partners/${encodeURIComponent(partnerId)}/team`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      })
      await onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex items-center gap-2 border-b border-border/50 px-3 py-2 font-mono text-[11px]">
      <span className="truncate text-primary">@{user.username}</span>
      {isSelf && (
        <span
          className="border px-1.5 py-px text-[9px] tracking-widest"
          style={{
            borderColor: '#F97316',
            color: '#F97316',
            backgroundColor: 'rgba(249,115,22,0.08)',
          }}
        >
          TÚ
        </span>
      )}
      {user.partnerAdmin && (
        <span
          className="flex items-center gap-1 border px-1.5 py-px text-[9px] tracking-widest"
          style={{ borderColor: '#FBBF24', color: '#FBBF24' }}
          title="Partner admin"
        >
          <ShieldCheck size={9} strokeWidth={1.5} />
          ADMIN
        </span>
      )}
      <span className="ml-auto flex shrink-0 items-center gap-1.5">
        {canManage && (
          <>
            <button
              type="button"
              onClick={onTogglePartnerAdmin}
              disabled={busy}
              className="border border-border px-1.5 py-px font-mono text-[9px] tracking-widest text-muted transition-colors hover:border-sys-orange hover:text-sys-orange disabled:opacity-40"
              title={user.partnerAdmin ? 'Quitar partner-admin' : 'Hacer partner-admin'}
            >
              {user.partnerAdmin ? '↓ ADMIN' : '↑ ADMIN'}
            </button>
            <button
              type="button"
              onClick={onKick}
              disabled={busy}
              aria-label={`Quitar a @${user.username}`}
              className="flex items-center gap-1 border px-1.5 py-px font-mono text-[9px] tracking-widest transition-colors hover:bg-white/[0.02] disabled:opacity-40"
              style={{ borderColor: '#E63329', color: '#E63329' }}
              title="Quitar del equipo"
            >
              <UserMinus size={9} strokeWidth={1.5} />
              KICK
            </button>
          </>
        )}
      </span>
    </li>
  )
}

interface SearchedUser {
  id: string
  username: string
  display_name: string
}

function AddMemberPicker({
  partnerId,
  onChanged,
}: {
  partnerId: string
  onChanged: () => Promise<void>
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchedUser[]>([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)

  // Debounced search against the existing /api/admin/users/search
  // endpoint. That route is admin-only — partner-admins (non-admin role)
  // can't reach it. For partner-admin add-member flows we rely on the
  // user already knowing the username (they ask the new member what theirs
  // is). At MVP scale this is fine; if user lookup needs to work for
  // non-admin partner-admins we'd add a narrower search endpoint later.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/users/search?q=${encodeURIComponent(q)}`,
        )
        if (res.ok) {
          const json = await res.json()
          setResults((json.users as SearchedUser[]) ?? [])
        } else {
          setResults([])
        }
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  const onAdd = async (id: string) => {
    setAdding(id)
    try {
      await fetch(`/api/partners/${encodeURIComponent(partnerId)}/team`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user_id: id }),
      })
      setQuery('')
      setResults([])
      await onChanged()
    } finally {
      setAdding(null)
    }
  }

  return (
    <section className="flex flex-col gap-2 border border-dashed border-border bg-elevated/20 p-3">
      <header className="flex items-center justify-between font-mono text-[10px] tracking-widest text-muted">
        <span>//AGREGAR · MIEMBRO</span>
        {searching && <span className="text-sys-green">// BUSCANDO…</span>}
      </header>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar @username o nombre… (mín. 2 caracteres)"
        className="w-full border border-border bg-base px-2 py-1.5 font-mono text-[11px] text-primary placeholder:text-muted focus:border-sys-orange focus:outline-none"
      />
      {query.trim().length >= 2 && results.length === 0 && !searching && (
        <p className="font-mono text-[10px] text-muted">
          Ningún usuario coincide con &quot;{query}&quot;.
        </p>
      )}
      {results.length > 0 && (
        <ul className="flex flex-col border border-border bg-base">
          {results.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => onAdd(u.id)}
                disabled={adding === u.id}
                className="flex w-full items-center gap-2 border-b border-border/40 px-2 py-1.5 text-left font-mono text-[11px] text-secondary transition-colors hover:bg-white/[0.02] hover:text-primary disabled:opacity-40"
              >
                <Plus size={11} strokeWidth={1.5} className="text-sys-orange" />
                <span className="truncate">@{u.username}</span>
                <span className="ml-auto truncate text-[9px] tracking-widest text-muted">
                  {u.display_name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ── MARKETPLACE tab ────────────────────────────────────────────────────────

function MarketplaceTab({
  partner,
  canManage,
  currentUserId,
  onRefetch,
  onPartnerPatched,
}: {
  partner: PartnerData
  canManage: boolean
  currentUserId: string
  onRefetch: () => Promise<void>
  onPartnerPatched: (next: PartnerData) => void
}) {
  const listings = partner.marketplaceListings

  return (
    <div className="flex flex-col gap-4">
      {!partner.marketplaceEnabled && (
        <p
          className="border border-dashed px-3 py-2 font-mono text-[10px] leading-relaxed"
          style={{ borderColor: '#3a3a3a', color: '#9CA3AF' }}
        >
          //MARKETPLACE·INACTIVO — el card no aparece en{' '}
          <span className="text-secondary">/marketplace</span> hasta que el
          marketplace esté habilitado. Podés activarlo abajo si tenés permisos
          o pedirle a un admin del sitio que lo haga.
        </p>
      )}

      <ProfileEditor
        partner={partner}
        canManage={canManage}
        currentUserId={currentUserId}
        onSaved={(next) => {
          onPartnerPatched(next)
          void onRefetch()
        }}
      />

      <ListingsReadOnlyBanner />

      <ListingsManager
        partner={partner as unknown as ContentItem}
        canManage={false}
        listings={listings}
      />
    </div>
  )
}

// ── ListingsReadOnlyBanner ─────────────────────────────────────────────────
//
// Listings persistence isn't wired yet — the composer below is rendered
// in read-only mode (canManage=false) so writes don't silently land in
// sessionStorage and disappear on refresh. Wiring listings to a real
// table (or the items.marketplace_listings jsonb with proper ownership
// gating) is its own slice — see Next Session.md.

function ListingsReadOnlyBanner() {
  return (
    <p
      className="flex items-start gap-2 border border-dashed px-3 py-2 font-mono text-[10px] leading-relaxed"
      style={{ borderColor: '#FBBF24', color: '#FBBF24', backgroundColor: 'rgba(251,191,36,0.06)' }}
    >
      <Lock size={12} strokeWidth={1.5} className="mt-0.5 shrink-0" />
      <span>
        //LISTADOS·SOLO·LECTURA — la edición persistente de listados aún no
        está habilitada. Los listados visibles vienen del backend; el composer
        de abajo está bloqueado mientras se diseña el flujo definitivo. Mientras
        tanto, pedile a un admin del sitio que ajuste tus listados desde Studio
        si lo necesitás.
      </span>
    </p>
  )
}

// ── ProfileEditor — partner card identity + marketplace meta ──────────────
//
// Edits flow through a single PATCH /api/partners/[id] when the admin
// clicks GUARDAR. Whitelist mirrors the API: image_url, partner_url,
// marketplace_enabled / description / location / currency. Profile-level
// fields (title, partner_kind, slug) stay admin-only and are surfaced
// read-only here so partner team members understand what's locked.

function ProfileEditor({
  partner,
  canManage,
  currentUserId,
  onSaved,
}: {
  partner: PartnerData
  canManage: boolean
  currentUserId: string
  onSaved: (next: PartnerData) => void
}) {
  const [imageUrl, setImageUrl] = useState(partner.imageUrl)
  const [partnerUrl, setPartnerUrl] = useState(partner.partnerUrl ?? '')
  const [description, setDescription] = useState(partner.marketplaceDescription ?? '')
  const [location, setLocation] = useState(partner.marketplaceLocation ?? '')
  const [currency, setCurrency] = useState(partner.marketplaceCurrency ?? 'MXN')
  const [marketplaceEnabled, setMarketplaceEnabled] = useState(partner.marketplaceEnabled)

  const [saving, setSaving] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset local state when the partner prop changes (e.g. after refetch).
  useEffect(() => {
    setImageUrl(partner.imageUrl)
    setPartnerUrl(partner.partnerUrl ?? '')
    setDescription(partner.marketplaceDescription ?? '')
    setLocation(partner.marketplaceLocation ?? '')
    setCurrency(partner.marketplaceCurrency ?? 'MXN')
    setMarketplaceEnabled(partner.marketplaceEnabled)
  }, [partner])

  const dirty =
    imageUrl !== partner.imageUrl ||
    partnerUrl !== (partner.partnerUrl ?? '') ||
    description !== (partner.marketplaceDescription ?? '') ||
    location !== (partner.marketplaceLocation ?? '') ||
    currency !== (partner.marketplaceCurrency ?? 'MXN') ||
    marketplaceEnabled !== partner.marketplaceEnabled

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageError(null)
    setImageUploading(true)
    try {
      const res = await compressAndUploadImage(file, currentUserId, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1600,
      })
      if (res.ok) setImageUrl(res.url)
      else setImageError(res.error)
    } finally {
      setImageUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const onSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/partners/${encodeURIComponent(partner.id)}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            image_url: imageUrl,
            partner_url: partnerUrl,
            marketplace_enabled: marketplaceEnabled,
            marketplace_description: description,
            marketplace_location: location,
            marketplace_currency: currency,
          }),
        },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'FAILED' }))
        setError((body.error ?? 'FAILED').toString().toUpperCase())
        return
      }
      const json = await res.json()
      onSaved(mapPartnerRow(json.partner))
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 1500)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="flex flex-col gap-3 border border-border bg-elevated/30 p-3">
      <header className="flex items-center justify-between font-mono text-[10px] tracking-widest text-muted">
        <span>//PERFIL · MARKETPLACE</span>
        {!canManage && (
          <span className="text-muted/60">// solo lectura</span>
        )}
      </header>

      {/* Read-only identity row — title + slug + partner_kind + admin-locked */}
      <div className="flex items-center gap-2 border border-border/40 bg-black/20 p-2 font-mono text-[10px] text-muted">
        <Lock size={10} strokeWidth={1.5} className="shrink-0" />
        <span className="truncate text-secondary">{partner.title}</span>
        <span className="text-muted/60">/{partner.slug}</span>
        {partner.partnerKind && (
          <span className="text-muted/60">· {partner.partnerKind.toUpperCase()}</span>
        )}
        <span className="ml-auto text-muted/60">
          // título / slug / kind: admin del sitio
        </span>
      </div>

      {/* Image */}
      <label className="flex flex-col gap-1">
        <span className="font-mono text-[9px] tracking-widest text-muted">
          IMAGEN · LOGO / PORTADA
        </span>
        <div className="flex items-center gap-2">
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              className="h-12 w-12 shrink-0 border border-border bg-elevated object-cover"
            />
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onPickFile}
            disabled={!canManage || imageUploading || saving}
            className="font-mono text-[10px] text-secondary"
          />
          {imageUploading && (
            <span className="font-mono text-[9px] tracking-widest text-sys-green">
              SUBIENDO…
            </span>
          )}
        </div>
        {imageError && (
          <p className="mt-1 font-mono text-[9px] text-sys-red">// {imageError.toUpperCase()}</p>
        )}
      </label>

      {/* External URL */}
      <label className="flex flex-col gap-1">
        <span className="font-mono text-[9px] tracking-widest text-muted">
          PARTNER URL · sitio externo
        </span>
        <input
          type="url"
          disabled={!canManage}
          value={partnerUrl}
          onChange={(e) => setPartnerUrl(e.target.value)}
          placeholder="https://naafi.bandcamp.com"
          className="w-full border border-border bg-base px-2 py-1.5 font-mono text-[11px] text-primary placeholder:text-muted/60 focus:border-sys-orange focus:outline-none disabled:cursor-default disabled:opacity-60"
        />
      </label>

      {/* Marketplace enabled toggle */}
      <label className="flex items-center gap-2 font-mono text-[11px] text-secondary">
        <input
          type="checkbox"
          disabled={!canManage}
          checked={marketplaceEnabled}
          onChange={(e) => setMarketplaceEnabled(e.target.checked)}
          className="accent-cyan-400"
        />
        Habilitar MARKETPLACE para este partner
      </label>

      {/* Description */}
      <label className="flex flex-col gap-1">
        <span className="font-mono text-[9px] tracking-widest text-muted">
          DESCRIPCIÓN
        </span>
        <textarea
          rows={3}
          disabled={!canManage}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Qué venden, qué política tienen, dónde se entrega…"
          className="w-full resize-none border border-border bg-base px-2 py-1.5 font-mono text-[11px] leading-relaxed text-primary placeholder:text-muted/60 focus:border-sys-orange focus:outline-none disabled:cursor-default disabled:opacity-60"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] tracking-widest text-muted">
            UBICACIÓN
          </span>
          <input
            type="text"
            disabled={!canManage}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="CDMX, MX"
            className="w-full border border-border bg-base px-2 py-1.5 font-mono text-[11px] text-primary placeholder:text-muted/60 focus:border-sys-orange focus:outline-none disabled:cursor-default disabled:opacity-60"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] tracking-widest text-muted">
            MONEDA
          </span>
          <input
            type="text"
            disabled={!canManage}
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            placeholder="MXN"
            maxLength={4}
            className="w-full border border-border bg-base px-2 py-1.5 font-mono text-[11px] text-primary placeholder:text-muted/60 focus:border-sys-orange focus:outline-none disabled:cursor-default disabled:opacity-60"
          />
        </label>
      </div>

      {error && (
        <p className="font-mono text-[10px] text-sys-red">// {error}</p>
      )}

      {canManage && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={!dirty || saving || imageUploading}
            className="flex items-center gap-1.5 border border-sys-green px-3 py-1.5 font-mono text-[10px] tracking-widest text-sys-green transition-colors hover:bg-sys-green/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save size={10} strokeWidth={1.5} />
            {saving ? 'GUARDANDO…' : 'GUARDAR PERFIL'}
          </button>
          {savedFlash && (
            <span className="font-mono text-[10px] tracking-widest text-sys-green">
              ◉ GUARDADO
            </span>
          )}
        </div>
      )}
    </section>
  )
}

// CardMetaEditor (v1, sessionStorage-backed) was replaced by ProfileEditor
// above — same fields plus image + URL, all routed through the real DB
// PATCH /api/partners/[id]. The legacy component lived here from the
// pre-Supabase visual MVP era; removed in commit 9.

// ── Listings management (composer + preview + table) ──────────────────────
//
// 3-zone layout matching the Marketplace v2 mockup:
//   • LEFT  — ListingComposer: full editor (title + category pair + condition
//             + price + status radio + multi-image gallery + description +
//             tags chip input + shipping radio + action row with char counters)
//   • RIGHT — ListingPreviewPane: live 3-mode preview (DESTACADA / GRID / LISTA)
//             that re-resolves from `partner.marketplaceListings` each render
//   • BOTTOM — ListingsTable: sortable / paginated (5/page) with edit /
//              duplicate / delete-red actions
//
// All edits flow through partnerOverrides inline writes — there's no draft
// flag yet, so GUARDAR BORRADOR / PUBLICAR ITEM both close the composer with
// a flash. A real draft pipeline lives in the v3 follow-up if/when partners
// need it.

const TITLE_MAX = 80
const DESC_MAX = 1000
const TABLE_PAGE_SIZE = 5

const CATEGORY_OPTIONS: MarketplaceListingCategory[] = [
  'vinyl',
  'cassette',
  'cd',
  'synth',
  'drum-machine',
  'turntable',
  'mixer',
  'outboard',
  'merch',
  'other',
]

const CATEGORY_LABEL: Record<MarketplaceListingCategory, string> = {
  vinyl: 'VINYL',
  cassette: 'CASSETTE',
  cd: 'CD',
  synth: 'SYNTH',
  'drum-machine': 'DRUM MACHINE',
  turntable: 'TURNTABLE',
  mixer: 'MIXER',
  outboard: 'OUTBOARD',
  merch: 'MERCH',
  other: 'OTRO',
}

const CONDITION_OPTIONS: MarketplaceListingCondition[] = [
  'NEW',
  'NM',
  'VG+',
  'VG',
  'G+',
  'G',
  'F',
]

const STATUS_LABEL: Record<MarketplaceListingStatus, string> = {
  available: 'DISPONIBLE',
  reserved: 'RESERVADO',
  sold: 'VENDIDO',
}

const STATUS_COLOR: Record<MarketplaceListingStatus, string> = {
  available: '#4ADE80',
  reserved: '#FBBF24',
  sold: '#E63329',
}

const SHIPPING_LABEL: Record<MarketplaceShippingMode, string> = {
  shipping: 'ENVÍO',
  local: 'RECOGIDA',
  both: 'AMBOS',
}

const SHIPPING_BLURB: Record<MarketplaceShippingMode, string> = {
  shipping: 'Envío directo',
  local: 'Recoger en sitio',
  both: 'Envío o recoger',
}

type PreviewMode = 'destacada' | 'grid' | 'lista'
type SortCol = 'title' | 'category' | 'condition' | 'price' | 'status' | 'updated'
type SortDir = 'asc' | 'desc'
type ComposerFlash = 'draft' | 'published' | null

function ListingsManager({
  partner,
  canManage,
  listings,
}: {
  partner: ContentItem
  canManage: boolean
  listings: MarketplaceListing[]
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState<PreviewMode>('destacada')
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState<{ col: SortCol; dir: SortDir }>({
    col: 'updated',
    dir: 'desc',
  })
  const [flash, setFlash] = useState<ComposerFlash>(null)

  // Hot-resolve the editing target each render so the preview pane and
  // composer reflect partnerOverrides writes in real time.
  const editing = editingId
    ? listings.find((l) => l.id === editingId) ?? null
    : null

  // Drop the selection if the listing was deleted (e.g. via the table action).
  useEffect(() => {
    if (editingId && !editing) setEditingId(null)
  }, [editingId, editing])

  const onAdd = () => {
    if (!canManage) return
    const draft: MarketplaceListing = {
      id: newListingId(partner.id),
      title: '',
      category: 'vinyl',
      price: 0,
      condition: 'VG+',
      images: [],
      status: 'available',
      publishedAt: new Date().toISOString(),
    }
    addMarketplaceListing(partner.id, draft)
    setEditingId(draft.id)
  }

  const onPatch = (patch: Partial<MarketplaceListing>) => {
    if (!editingId) return
    updateMarketplaceListing(partner.id, editingId, patch)
  }

  const onDuplicate = (id: string) => {
    if (!canManage) return
    const source = listings.find((l) => l.id === id)
    if (!source) return
    const dup: MarketplaceListing = {
      ...source,
      id: newListingId(partner.id),
      title: source.title ? `${source.title} (copia)` : '(copia)',
      status: 'available',
      publishedAt: new Date().toISOString(),
    }
    addMarketplaceListing(partner.id, dup)
    setEditingId(dup.id)
  }

  const onDelete = (id: string) => {
    if (!canManage) return
    removeMarketplaceListing(partner.id, id)
    if (editingId === id) setEditingId(null)
  }

  const fireFlash = (kind: ComposerFlash) => {
    if (kind === null) return
    setFlash(kind)
    setTimeout(() => setFlash(null), 2500)
    setEditingId(null)
  }

  const onPreview = () => {
    if (!editing) return
    if (typeof window !== 'undefined') {
      // window.open bypasses Next's router, so basePath must be applied
      // manually. NEXT_PUBLIC_BASE_PATH is set in next.config.mjs to
      // `/gradiente-fm-web` on GitHub Pages and `''` locally.
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
      const url = `${basePath}/marketplace/?partner=${partner.slug}&listing=${editing.id}`
      window.open(url, '_blank', 'noopener')
    }
  }

  // Sort + paginate the table.
  const sorted = useMemo(() => {
    const xs = [...listings]
    const dir = sort.dir === 'asc' ? 1 : -1
    xs.sort((a, b) => {
      switch (sort.col) {
        case 'title':
          return a.title.localeCompare(b.title) * dir
        case 'category':
          return a.category.localeCompare(b.category) * dir
        case 'condition':
          return a.condition.localeCompare(b.condition) * dir
        case 'price':
          return (a.price - b.price) * dir
        case 'status':
          return a.status.localeCompare(b.status) * dir
        case 'updated':
        default:
          return (a.publishedAt < b.publishedAt ? -1 : 1) * dir
      }
    })
    return xs
  }, [listings, sort])

  const pageCount = Math.max(1, Math.ceil(sorted.length / TABLE_PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageRows = sorted.slice(
    safePage * TABLE_PAGE_SIZE,
    (safePage + 1) * TABLE_PAGE_SIZE,
  )

  return (
    <div className="flex flex-col gap-3">
      {/* Top: composer + preview side by side */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ListingComposer
          listing={editing}
          partner={partner}
          canManage={canManage}
          flash={flash}
          onPatch={onPatch}
          onPreview={onPreview}
          onSaveDraft={() => fireFlash('draft')}
          onPublish={() => fireFlash('published')}
        />
        <ListingPreviewPane
          listing={editing}
          partner={partner}
          mode={previewMode}
          onModeChange={setPreviewMode}
        />
      </div>

      {/* Bottom: paginated table */}
      <ListingsTable
        partner={partner}
        rows={pageRows}
        total={sorted.length}
        editingId={editingId}
        canManage={canManage}
        sort={sort}
        onSortChange={setSort}
        page={safePage}
        pageCount={pageCount}
        onPageChange={setPage}
        onSelect={setEditingId}
        onAdd={onAdd}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />
    </div>
  )
}

// ── ListingComposer — left pane ────────────────────────────────────────────

function ListingComposer({
  listing,
  partner,
  canManage,
  flash,
  onPatch,
  onPreview,
  onSaveDraft,
  onPublish,
}: {
  listing: MarketplaceListing | null
  partner: ContentItem
  canManage: boolean
  flash: ComposerFlash
  onPatch: (patch: Partial<MarketplaceListing>) => void
  onPreview: () => void
  onSaveDraft: () => void
  onPublish: () => void
}) {
  return (
    <section className="flex flex-col border border-border bg-elevated/30">
      <header className="flex items-center justify-between border-b border-border/60 px-3 py-2 font-mono text-[10px] tracking-widest">
        <span className="text-muted">//COMPOSER</span>
        <span className="text-secondary">
          {listing
            ? `EDITANDO · ${listing.id.slice(-8).toUpperCase()}`
            : 'SIN·SELECCIÓN'}
        </span>
      </header>

      {!listing ? (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center font-mono text-[11px] text-muted">
          <Package size={32} strokeWidth={1.25} className="text-muted/40" />
          <span>Selecciona un listado en la tabla, o crea uno nuevo.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-3 p-3">
          <FormField label="TÍTULO" required>
            <CharCountedInput
              value={listing.title}
              onChange={(v) => onPatch({ title: v })}
              max={TITLE_MAX}
              disabled={!canManage}
              placeholder="Siete Catorce — Volcán"
            />
          </FormField>

          <CategorySubcategoryPair
            category={listing.category}
            subcategory={listing.subcategory}
            disabled={!canManage}
            onChange={(category, subcategory) =>
              onPatch({ category, subcategory })
            }
          />

          <div className="grid grid-cols-2 gap-3">
            <FormField label="CONDICIÓN">
              <select
                value={listing.condition}
                disabled={!canManage}
                onChange={(e) =>
                  onPatch({
                    condition: e.target.value as MarketplaceListingCondition,
                  })
                }
                className="w-full border bg-base px-2 py-1.5 font-mono text-[11px] text-primary focus:border-sys-orange focus:outline-none disabled:cursor-default disabled:opacity-60"
                style={{ borderColor: '#242424' }}
              >
                {CONDITION_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              label={`PRECIO${
                partner.marketplaceCurrency ? ` (${partner.marketplaceCurrency})` : ''
              }`}
            >
              <input
                type="number"
                min={0}
                value={listing.price}
                disabled={!canManage}
                onChange={(e) => onPatch({ price: Number(e.target.value) })}
                className="w-full border bg-base px-2 py-1.5 font-mono text-[11px] text-primary focus:border-sys-orange focus:outline-none disabled:cursor-default disabled:opacity-60"
                style={{ borderColor: '#242424' }}
              />
            </FormField>
          </div>

          <FormField label="ESTADO">
            <StatusRadioRow
              value={listing.status}
              disabled={!canManage}
              onChange={(s) => onPatch({ status: s })}
            />
          </FormField>

          <FormField label={`IMÁGENES · ${listing.images.length}`}>
            <MultiImageGallery
              images={listing.images}
              disabled={!canManage}
              onChange={(images) => onPatch({ images })}
            />
          </FormField>

          <FormField label="DESCRIPCIÓN">
            <CharCountedTextarea
              value={listing.description ?? ''}
              onChange={(v) => onPatch({ description: v || undefined })}
              max={DESC_MAX}
              disabled={!canManage}
              rows={4}
              placeholder="Versión, prensaje, condición fina, garantía…"
            />
          </FormField>

          <FormField label="ETIQUETAS">
            <TagsChipInput
              tags={listing.tags ?? []}
              disabled={!canManage}
              onChange={(tags) =>
                onPatch({ tags: tags.length ? tags : undefined })
              }
            />
          </FormField>

          <FormField label="MODO · ENTREGA">
            <ShippingRadioCards
              value={listing.shippingMode}
              disabled={!canManage}
              onChange={(s) => onPatch({ shippingMode: s })}
            />
          </FormField>

          <ActionRow
            canManage={canManage}
            flash={flash}
            onPreview={onPreview}
            onSaveDraft={onSaveDraft}
            onPublish={onPublish}
          />
        </div>
      )}
    </section>
  )
}

// ── Composer sub-controls ──────────────────────────────────────────────────

function FormField({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[9px] tracking-widest text-muted">
        {label}
        {required && (
          <span className="ml-1" style={{ color: '#E63329' }} aria-hidden>
            *
          </span>
        )}
      </span>
      {children}
    </label>
  )
}

function CharCountedInput({
  value,
  onChange,
  max,
  disabled,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  max: number
  disabled?: boolean
  placeholder?: string
}) {
  const overflow = value.length > max
  return (
    <div className="flex flex-col gap-0.5">
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border bg-base px-2 py-1.5 font-mono text-[11px] text-primary placeholder:text-muted/60 focus:border-sys-orange focus:outline-none disabled:cursor-default disabled:opacity-60"
        style={{ borderColor: overflow ? '#E63329' : '#242424' }}
      />
      <span
        className="self-end font-mono text-[9px] tracking-widest tabular-nums"
        style={{ color: overflow ? '#E63329' : '#888' }}
      >
        {value.length} / {max}
      </span>
    </div>
  )
}

function CharCountedTextarea({
  value,
  onChange,
  max,
  disabled,
  rows,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  max: number
  disabled?: boolean
  rows?: number
  placeholder?: string
}) {
  const overflow = value.length > max
  return (
    <div className="flex flex-col gap-0.5">
      <textarea
        rows={rows ?? 3}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full resize-none border bg-base px-2 py-1.5 font-mono text-[11px] leading-relaxed text-primary placeholder:text-muted/60 focus:border-sys-orange focus:outline-none disabled:cursor-default disabled:opacity-60"
        style={{ borderColor: overflow ? '#E63329' : '#242424' }}
      />
      <span
        className="self-end font-mono text-[9px] tracking-widest tabular-nums"
        style={{ color: overflow ? '#E63329' : '#888' }}
      >
        {value.length} / {max}
      </span>
    </div>
  )
}

function CategorySubcategoryPair({
  category,
  subcategory,
  disabled,
  onChange,
}: {
  category: MarketplaceListingCategory
  subcategory: string | undefined
  disabled?: boolean
  onChange: (
    category: MarketplaceListingCategory,
    subcategory: string | undefined,
  ) => void
}) {
  const subOptions = SUBCATEGORIES_BY_CATEGORY[category]
  const showSub = subOptions.length > 0
  return (
    <div className="grid grid-cols-2 gap-3">
      <FormField label="CATEGORÍA">
        <select
          value={category}
          disabled={disabled}
          onChange={(e) => {
            const next = e.target.value as MarketplaceListingCategory
            const nextSubs = SUBCATEGORIES_BY_CATEGORY[next]
            const keepSub =
              subcategory && nextSubs.includes(subcategory)
                ? subcategory
                : undefined
            onChange(next, keepSub)
          }}
          className="w-full border bg-base px-2 py-1.5 font-mono text-[11px] text-primary focus:border-sys-orange focus:outline-none disabled:cursor-default disabled:opacity-60"
          style={{ borderColor: '#242424' }}
        >
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="SUBCATEGORÍA">
        {showSub ? (
          <select
            value={subcategory ?? ''}
            disabled={disabled}
            onChange={(e) =>
              onChange(category, e.target.value || undefined)
            }
            className="w-full border bg-base px-2 py-1.5 font-mono text-[11px] text-primary focus:border-sys-orange focus:outline-none disabled:cursor-default disabled:opacity-60"
            style={{ borderColor: '#242424' }}
          >
            <option value="">— sin subcategoría —</option>
            {subOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ) : (
          <span className="flex h-[30px] items-center border border-dashed border-border px-2 font-mono text-[10px] tracking-widest text-muted">
            // n/a
          </span>
        )}
      </FormField>
    </div>
  )
}

function StatusRadioRow({
  value,
  disabled,
  onChange,
}: {
  value: MarketplaceListingStatus
  disabled?: boolean
  onChange: (s: MarketplaceListingStatus) => void
}) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {(['available', 'reserved', 'sold'] as const).map((s) => {
        const active = value === s
        const color = STATUS_COLOR[s]
        return (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onChange(s)}
            aria-pressed={active}
            className="flex items-center justify-center gap-1.5 border px-2 py-1.5 font-mono text-[10px] tracking-widest transition-colors disabled:cursor-default disabled:opacity-50"
            style={{
              borderColor: active ? color : '#242424',
              color: active ? color : '#888',
              backgroundColor: active ? `${color}1A` : 'transparent',
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: color }}
              aria-hidden
            />
            {STATUS_LABEL[s]}
          </button>
        )
      })}
    </div>
  )
}

function ShippingRadioCards({
  value,
  disabled,
  onChange,
}: {
  value: MarketplaceShippingMode | undefined
  disabled?: boolean
  onChange: (s: MarketplaceShippingMode | undefined) => void
}) {
  // Lucide icons typed loosely — narrowing them here would force a
  // dependency on lucide's internal LucideIcon export.
  const ICON: Record<MarketplaceShippingMode, typeof Truck> = {
    shipping: Truck,
    local: MapPin,
    both: Package,
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      {(['shipping', 'local', 'both'] as const).map((m) => {
        const active = value === m
        const Icon = ICON[m]
        return (
          <button
            key={m}
            type="button"
            disabled={disabled}
            onClick={() => onChange(active ? undefined : m)}
            aria-pressed={active}
            className="flex flex-col items-center gap-1 border px-2 py-2 transition-colors disabled:cursor-default disabled:opacity-50"
            style={{
              borderColor: active ? '#F97316' : '#242424',
              color: active ? '#F97316' : '#9CA3AF',
              backgroundColor: active ? 'rgba(249,115,22,0.08)' : 'transparent',
            }}
          >
            <Icon size={14} strokeWidth={1.5} />
            <span className="font-mono text-[9px] font-bold tracking-widest">
              {SHIPPING_LABEL[m]}
            </span>
            <span className="font-mono text-[8px] text-muted">
              {SHIPPING_BLURB[m]}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function TagsChipInput({
  tags,
  disabled,
  onChange,
}: {
  tags: string[]
  disabled?: boolean
  onChange: (tags: string[]) => void
}) {
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const commit = () => {
    const v = draft.trim().toLowerCase()
    if (!v) {
      setDraft('')
      return
    }
    if (tags.includes(v)) {
      setDraft('')
      return
    }
    onChange([...tags, v])
    setDraft('')
  }

  const remove = (t: string) => onChange(tags.filter((x) => x !== t))

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 border bg-base px-2 py-1.5 transition-colors focus-within:border-sys-orange"
      style={{ borderColor: '#242424' }}
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 border border-border bg-elevated/50 px-1.5 py-px font-mono text-[10px] tracking-widest text-secondary"
        >
          #{t}
          {!disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                remove(t)
              }}
              aria-label={`Quitar ${t}`}
              className="text-muted transition-colors hover:text-sys-red"
            >
              <X size={10} strokeWidth={1.5} />
            </button>
          )}
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            commit()
          } else if (e.key === 'Backspace' && !draft && tags.length > 0) {
            remove(tags[tags.length - 1])
          }
        }}
        onBlur={commit}
        placeholder={tags.length === 0 ? 'añadir tag…' : ''}
        className="min-w-[80px] flex-1 bg-transparent font-mono text-[11px] text-primary placeholder:text-muted/60 focus:outline-none disabled:cursor-default"
      />
    </div>
  )
}

function MultiImageGallery({
  images,
  disabled,
  onChange,
}: {
  images: string[]
  disabled?: boolean
  onChange: (images: string[]) => void
}) {
  const [dragOver, setDragOver] = useState(false)
  const [urlOpen, setUrlOpen] = useState(false)
  const [urlDraft, setUrlDraft] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const readFile = (file: File) => {
    if (!file.type.startsWith('image/')) return
    const r = new FileReader()
    r.onload = () => {
      if (typeof r.result === 'string') {
        onChange([...images, r.result])
      }
    }
    r.readAsDataURL(file)
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    if (disabled) return
    const files = Array.from(e.dataTransfer.files ?? [])
    files.filter((f) => f.type.startsWith('image/')).forEach(readFile)
  }

  const onPicker = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    files.forEach(readFile)
    e.target.value = ''
  }

  const removeAt = (i: number) =>
    onChange(images.filter((_, idx) => idx !== i))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= images.length) return
    const next = [...images]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  const addUrl = () => {
    const u = urlDraft.trim()
    if (!u) return
    onChange([...images, u])
    setUrlDraft('')
    setUrlOpen(false)
  }

  return (
    <div
      className="flex flex-col gap-2"
      onDragOver={(e) => {
        e.preventDefault()
        if (!dragOver && !disabled) setDragOver(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false)
      }}
      onDrop={onDrop}
    >
      <div
        className="grid grid-cols-3 gap-2 border border-dashed p-2 transition-colors sm:grid-cols-4"
        style={{
          borderColor: dragOver ? '#F97316' : '#242424',
          backgroundColor: dragOver
            ? 'rgba(249,115,22,0.06)'
            : 'transparent',
        }}
      >
        {images.map((src, i) => (
          <ImageSlot
            key={`${i}-${src.slice(0, 24)}`}
            src={src}
            isPortada={i === 0}
            disabled={disabled}
            canMoveBack={i > 0}
            canMoveForward={i < images.length - 1}
            onRemove={() => removeAt(i)}
            onMoveBack={() => move(i, -1)}
            onMoveForward={() => move(i, 1)}
          />
        ))}
        {!disabled && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 border border-dashed text-muted transition-colors hover:border-sys-orange hover:text-sys-orange"
            style={{ borderColor: '#3a3a3a' }}
          >
            <Plus size={16} strokeWidth={1.5} />
            <span className="font-mono text-[9px] tracking-widest">
              AGREGAR
            </span>
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={onPicker}
          className="hidden"
        />
      </div>

      {!disabled && !urlOpen && (
        <button
          type="button"
          onClick={() => setUrlOpen(true)}
          className="self-start font-mono text-[10px] tracking-widest text-muted transition-colors hover:text-sys-orange"
        >
          + AÑADIR URL
        </button>
      )}
      {urlOpen && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={urlDraft}
            autoFocus
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addUrl()
              } else if (e.key === 'Escape') {
                setUrlDraft('')
                setUrlOpen(false)
              }
            }}
            placeholder="https://… o /flyers/foo.jpg"
            className="min-w-0 flex-1 border bg-base px-2 py-1 font-mono text-[11px] text-primary placeholder:text-muted/60 focus:border-sys-orange focus:outline-none"
            style={{ borderColor: '#242424' }}
          />
          <button
            type="button"
            onClick={addUrl}
            disabled={!urlDraft.trim()}
            className="border px-2 py-1 font-mono text-[10px] tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            style={{ borderColor: '#F97316', color: '#F97316' }}
          >
            ▶ AÑADIR
          </button>
          <button
            type="button"
            onClick={() => {
              setUrlDraft('')
              setUrlOpen(false)
            }}
            className="border border-border px-2 py-1 font-mono text-[10px] tracking-widest text-muted transition-colors hover:text-primary"
          >
            CANCELAR
          </button>
        </div>
      )}
      {images.length === 0 && !urlOpen && (
        <span className="font-mono text-[10px] text-muted">
          Arrastra imágenes aquí, click + AGREGAR, o pega una URL.
        </span>
      )}
    </div>
  )
}

function ImageSlot({
  src,
  isPortada,
  disabled,
  canMoveBack,
  canMoveForward,
  onRemove,
  onMoveBack,
  onMoveForward,
}: {
  src: string
  isPortada: boolean
  disabled?: boolean
  canMoveBack: boolean
  canMoveForward: boolean
  onRemove: () => void
  onMoveBack: () => void
  onMoveForward: () => void
}) {
  const isData = src.startsWith('data:')
  return (
    <div className="group relative aspect-square overflow-hidden border border-border bg-elevated">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="h-full w-full object-cover"
        onError={(e) => {
          ;(e.currentTarget as HTMLImageElement).style.opacity = '0.2'
        }}
      />
      {isPortada && (
        <span
          className="absolute left-1 top-1 inline-flex items-center gap-1 bg-black/75 px-1 py-0.5 font-mono text-[8px] tracking-widest backdrop-blur-sm"
          style={{ color: '#F97316' }}
        >
          <Star size={8} strokeWidth={1.5} fill="#F97316" />
          PORTADA
        </span>
      )}
      {!isPortada && isData && (
        <span
          className="absolute left-1 top-1 bg-black/75 px-1 py-0.5 font-mono text-[8px] tracking-widest text-muted backdrop-blur-sm"
          aria-hidden
        >
          ARCHIVO
        </span>
      )}
      {!disabled && (
        <div className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={onMoveBack}
              disabled={!canMoveBack}
              aria-label="Mover atrás"
              className="bg-black/75 p-0.5 text-secondary backdrop-blur-sm transition-colors hover:text-sys-orange disabled:opacity-30"
            >
              <ArrowUp size={10} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={onMoveForward}
              disabled={!canMoveForward}
              aria-label="Mover adelante"
              className="bg-black/75 p-0.5 text-secondary backdrop-blur-sm transition-colors hover:text-sys-orange disabled:opacity-30"
            >
              <ArrowDown size={10} strokeWidth={1.5} />
            </button>
          </div>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Quitar"
            className="bg-black/75 p-0.5 backdrop-blur-sm transition-colors hover:bg-sys-red/30"
            style={{ color: '#E63329' }}
          >
            <X size={10} strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  )
}

function ActionRow({
  canManage,
  flash,
  onPreview,
  onSaveDraft,
  onPublish,
}: {
  canManage: boolean
  flash: ComposerFlash
  onPreview: () => void
  onSaveDraft: () => void
  onPublish: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
      <div className="flex items-center">
        {flash === 'draft' && (
          <span className="font-mono text-[10px] tracking-widest text-sys-orange">
            ◉ GUARDADO
          </span>
        )}
        {flash === 'published' && (
          <span
            className="font-mono text-[10px] tracking-widest"
            style={{ color: '#4ADE80' }}
          >
            ▶ PUBLICADO
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPreview}
          className="flex items-center gap-1.5 border border-border px-2 py-1.5 font-mono text-[10px] tracking-widest text-muted transition-colors hover:border-sys-orange hover:text-sys-orange"
        >
          <Eye size={11} strokeWidth={1.5} />
          VISTA PREVIA
        </button>
        <button
          type="button"
          disabled={!canManage}
          onClick={onSaveDraft}
          className="border px-3 py-1.5 font-mono text-[10px] tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          style={{ borderColor: '#888', color: '#888' }}
        >
          ▣ GUARDAR BORRADOR
        </button>
        <button
          type="button"
          disabled={!canManage}
          onClick={onPublish}
          className="border px-3 py-1.5 font-mono text-[10px] tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            borderColor: '#4ADE80',
            color: '#4ADE80',
            backgroundColor: 'rgba(74,222,128,0.08)',
          }}
        >
          ▶ PUBLICAR ITEM
        </button>
      </div>
    </div>
  )
}

// ── ListingPreviewPane — right pane (3-mode toggle) ────────────────────────

function ListingPreviewPane({
  listing,
  partner,
  mode,
  onModeChange,
}: {
  listing: MarketplaceListing | null
  partner: ContentItem
  mode: PreviewMode
  onModeChange: (m: PreviewMode) => void
}) {
  return (
    <section className="flex flex-col border border-border bg-elevated/30">
      <header className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2 font-mono text-[10px] tracking-widest">
        <span className="text-muted">//VISTA · PREVIA</span>
        <div className="flex items-center gap-1">
          {(['destacada', 'grid', 'lista'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              className="border px-2 py-0.5 transition-colors"
              style={{
                borderColor: mode === m ? '#F97316' : '#242424',
                color: mode === m ? '#F97316' : '#888',
                backgroundColor:
                  mode === m ? 'rgba(249,115,22,0.08)' : 'transparent',
              }}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>
      </header>
      <div className="flex-1 p-3">
        {!listing ? (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 text-center font-mono text-[11px] text-muted">
            <Eye size={24} strokeWidth={1.25} className="text-muted/40" />
            <span>
              Sin selección — la vista previa se actualiza en tiempo real.
            </span>
          </div>
        ) : mode === 'destacada' ? (
          <DestacadaPreview listing={listing} partner={partner} />
        ) : mode === 'grid' ? (
          <div className="mx-auto max-w-[280px]">
            <MarketplaceListingCard
              listing={listing}
              partner={partner}
              index={1}
            />
          </div>
        ) : (
          <ListaPreview listing={listing} partner={partner} />
        )}
      </div>
    </section>
  )
}

function DestacadaPreview({
  listing,
  partner,
}: {
  listing: MarketplaceListing
  partner: ContentItem
}) {
  const status = listing.status
  const statusColor = STATUS_COLOR[status]
  const currency = partner.marketplaceCurrency ?? ''
  const hasImage = listing.images.length > 0
  return (
    <article className="flex flex-col gap-3">
      <div className="relative aspect-[4/3] w-full overflow-hidden border border-border bg-base">
        {hasImage ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={listing.images[0]}
            alt={listing.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-mono text-[11px] tracking-widest text-muted">
            //{CATEGORY_LABEL[listing.category]}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        <h3 className="font-syne text-lg font-bold leading-tight text-primary">
          {listing.title || '[sin título]'}
        </h3>
        <span
          className="font-mono text-[10px] tracking-widest"
          style={{ color: '#F97316' }}
        >
          {CATEGORY_LABEL[listing.category]}
          {listing.subcategory ? ` · ${listing.subcategory}` : ''}
        </span>
      </div>

      <span className="font-syne text-2xl font-bold text-primary">
        ${listing.price.toLocaleString('es-MX')} {currency}
      </span>

      <dl className="flex flex-col gap-0.5 border border-border/60 bg-base/40 px-3 py-2 font-mono text-[10px] leading-relaxed">
        <MetaRow label="CONDICIÓN" value={listing.condition} />
        <MetaRow label="VENDEDOR" value={partner.title} />
        {listing.shippingMode && (
          <MetaRow label="ENTREGA" value={SHIPPING_LABEL[listing.shippingMode]} />
        )}
      </dl>

      {listing.description && (
        <p className="font-mono text-[11px] leading-relaxed text-secondary line-clamp-4">
          {listing.description}
        </p>
      )}

      {listing.tags && listing.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {listing.tags.map((t) => (
            <span
              key={t}
              className="border border-border bg-elevated/50 px-1.5 py-px font-mono text-[9px] tracking-widest text-muted"
            >
              #{t}
            </span>
          ))}
        </div>
      )}

      <div
        className="flex items-center justify-between border-t border-border/60 pt-2 font-mono text-[10px] tracking-widest"
        style={{ color: statusColor }}
      >
        <span>{STATUS_LABEL[status]}</span>
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: statusColor }}
          aria-hidden
        />
      </div>
    </article>
  )
}

function ListaPreview({
  listing,
  partner,
}: {
  listing: MarketplaceListing
  partner: ContentItem
}) {
  const currency = partner.marketplaceCurrency ?? ''
  const hasImage = listing.images.length > 0
  return (
    <div className="flex items-center gap-3 border border-border bg-elevated/30 p-2">
      <div className="relative h-14 w-14 shrink-0 overflow-hidden border border-border/60 bg-base">
        {hasImage ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={listing.images[0]}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted/40">
            <ImageIcon size={16} strokeWidth={1.25} />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-syne text-sm font-bold text-primary">
          {listing.title || '[sin título]'}
        </span>
        <span
          className="truncate font-mono text-[9px] tracking-widest"
          style={{ color: '#F97316' }}
        >
          {CATEGORY_LABEL[listing.category]}
          {listing.subcategory ? ` · ${listing.subcategory}` : ''}
          {' · '}
          {listing.condition}
        </span>
      </div>
      <span className="shrink-0 font-syne text-sm font-bold text-primary">
        ${listing.price.toLocaleString('es-MX')} {currency}
      </span>
      <span
        className="shrink-0 border px-1.5 py-px font-mono text-[9px] tracking-widest"
        style={{
          borderColor: STATUS_COLOR[listing.status],
          color: STATUS_COLOR[listing.status],
        }}
      >
        {STATUS_LABEL[listing.status]}
      </span>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[80px_1fr] items-baseline gap-2">
      <dt className="tracking-widest text-muted">{label}</dt>
      <dd className="truncate text-secondary">{value}</dd>
    </div>
  )
}

// ── ListingsTable — bottom paginated table ─────────────────────────────────

function ListingsTable({
  partner,
  rows,
  total,
  editingId,
  canManage,
  sort,
  onSortChange,
  page,
  pageCount,
  onPageChange,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
}: {
  partner: ContentItem
  rows: MarketplaceListing[]
  total: number
  editingId: string | null
  canManage: boolean
  sort: { col: SortCol; dir: SortDir }
  onSortChange: (s: { col: SortCol; dir: SortDir }) => void
  page: number
  pageCount: number
  onPageChange: (p: number) => void
  onSelect: (id: string) => void
  onAdd: () => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}) {
  const currency = partner.marketplaceCurrency ?? ''
  return (
    <section className="flex flex-col border border-border bg-elevated/30">
      <header className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2 font-mono text-[10px] tracking-widest">
        <div className="flex items-center gap-2">
          <span className="text-muted">//LISTADOS</span>
          <span className="text-secondary tabular-nums">{total} ITEMS</span>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={onAdd}
            className="flex items-center gap-1.5 border px-2 py-1 transition-colors"
            style={{
              borderColor: '#F97316',
              color: '#F97316',
              backgroundColor: 'rgba(249,115,22,0.08)',
            }}
          >
            <Plus size={11} strokeWidth={1.5} />
            NUEVO LISTADO
          </button>
        )}
      </header>

      {total === 0 ? (
        <div className="px-3 py-6 text-center font-mono text-[11px] text-muted">
          Sin listados todavía. Pulsa{' '}
          <span style={{ color: '#F97316' }}>+ NUEVO LISTADO</span> para empezar.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[40px_minmax(0,1.4fr)_minmax(0,0.9fr)_60px_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.7fr)_auto] items-center gap-2 border-b border-border/40 px-3 py-1.5 font-mono text-[9px] tracking-widest text-muted">
            <span aria-hidden></span>
            <SortHeader
              col="title"
              label="TÍTULO"
              sort={sort}
              onSortChange={onSortChange}
            />
            <SortHeader
              col="category"
              label="CATEGORÍA"
              sort={sort}
              onSortChange={onSortChange}
            />
            <SortHeader
              col="condition"
              label="CONDIC."
              sort={sort}
              onSortChange={onSortChange}
            />
            <SortHeader
              col="price"
              label="PRECIO"
              sort={sort}
              onSortChange={onSortChange}
            />
            <SortHeader
              col="status"
              label="ESTADO"
              sort={sort}
              onSortChange={onSortChange}
            />
            <SortHeader
              col="updated"
              label="ACTUALIZADO"
              sort={sort}
              onSortChange={onSortChange}
            />
            <span aria-hidden></span>
          </div>

          <ul>
            {rows.map((l) => (
              <ListingTableRow
                key={l.id}
                listing={l}
                isEditing={editingId === l.id}
                canManage={canManage}
                currency={currency}
                onSelect={() => onSelect(l.id)}
                onDuplicate={() => onDuplicate(l.id)}
                onDelete={() => onDelete(l.id)}
              />
            ))}
          </ul>

          {pageCount > 1 && (
            <div className="flex items-center justify-between border-t border-border/40 px-3 py-1.5 font-mono text-[10px] tracking-widest text-muted">
              <span>
                PÁGINA {page + 1} / {pageCount}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onPageChange(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="border border-border px-1.5 py-0.5 transition-colors hover:border-sys-orange hover:text-sys-orange disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Página anterior"
                >
                  <ChevronLeft size={11} strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onPageChange(Math.min(pageCount - 1, page + 1))
                  }
                  disabled={page === pageCount - 1}
                  className="border border-border px-1.5 py-0.5 transition-colors hover:border-sys-orange hover:text-sys-orange disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Página siguiente"
                >
                  <ChevronRight size={11} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function SortHeader({
  col,
  label,
  sort,
  onSortChange,
}: {
  col: SortCol
  label: string
  sort: { col: SortCol; dir: SortDir }
  onSortChange: (s: { col: SortCol; dir: SortDir }) => void
}) {
  const active = sort.col === col
  return (
    <button
      type="button"
      onClick={() =>
        onSortChange({
          col,
          dir: active && sort.dir === 'asc' ? 'desc' : 'asc',
        })
      }
      className="flex items-center gap-1 truncate text-left transition-colors hover:text-primary"
      style={{ color: active ? '#F97316' : undefined }}
    >
      <span className="truncate">{label}</span>
      {active && <span aria-hidden>{sort.dir === 'asc' ? '↑' : '↓'}</span>}
    </button>
  )
}

function ListingTableRow({
  listing,
  isEditing,
  canManage,
  currency,
  onSelect,
  onDuplicate,
  onDelete,
}: {
  listing: MarketplaceListing
  isEditing: boolean
  canManage: boolean
  currency: string
  onSelect: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const hasImage = listing.images.length > 0
  return (
    <li
      className="grid grid-cols-[40px_minmax(0,1.4fr)_minmax(0,0.9fr)_60px_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.7fr)_auto] items-center gap-2 border-b border-border/40 px-3 py-1.5 font-mono text-[10px] transition-colors hover:bg-white/[0.02]"
      style={{
        backgroundColor: isEditing ? 'rgba(249,115,22,0.05)' : undefined,
      }}
    >
      <div className="relative h-8 w-8 overflow-hidden border border-border/60 bg-base">
        {hasImage ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={listing.images[0]}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted/40">
            <ImageIcon size={12} strokeWidth={1.25} />
          </div>
        )}
      </div>

      <span className="truncate text-primary">
        {listing.title || '[sin título]'}
      </span>
      <span className="truncate text-secondary">
        {CATEGORY_LABEL[listing.category]}
        {listing.subcategory ? ` · ${listing.subcategory}` : ''}
      </span>
      <span className="text-secondary">{listing.condition}</span>
      <span className="truncate text-secondary tabular-nums">
        ${listing.price.toLocaleString('es-MX')} {currency}
      </span>
      <span
        className="justify-self-start border px-1 py-px text-[9px] tracking-widest"
        style={{
          borderColor: STATUS_COLOR[listing.status],
          color: STATUS_COLOR[listing.status],
        }}
      >
        {STATUS_LABEL[listing.status]}
      </span>
      <span className="truncate text-muted">
        {relativeAgo(listing.publishedAt)}
      </span>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onSelect}
          aria-label="Editar"
          title={isEditing ? 'En el composer' : 'Editar'}
          className="border p-1 transition-colors hover:border-sys-orange hover:text-sys-orange"
          style={{
            borderColor: isEditing ? '#F97316' : '#242424',
            color: isEditing ? '#F97316' : '#888',
          }}
        >
          <Pencil size={11} strokeWidth={1.5} />
        </button>
        {canManage && (
          <>
            <button
              type="button"
              onClick={onDuplicate}
              aria-label="Duplicar"
              title="Duplicar"
              className="border border-border p-1 text-muted transition-colors hover:border-sys-orange hover:text-sys-orange"
            >
              <Copy size={11} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label="Borrar"
              title="Borrar"
              className="border p-1 transition-colors hover:bg-white/[0.02]"
              style={{ borderColor: '#E63329', color: '#E63329' }}
            >
              <Trash2 size={11} strokeWidth={1.5} />
            </button>
          </>
        )}
      </div>
    </li>
  )
}

function relativeAgo(iso: string): string {
  try {
    const ms = Date.now() - new Date(iso).getTime()
    if (ms < 0) return 'AHORA'
    const days = Math.floor(ms / 86_400_000)
    if (days < 1) {
      const hours = Math.floor(ms / 3_600_000)
      if (hours < 1) return 'HOY'
      return `${hours}H`
    }
    if (days < 7) return `${days}D`
    const weeks = Math.floor(days / 7)
    if (weeks < 5) return `${weeks}sem`
    const months = Math.floor(days / 30)
    return `${months}mes`
  } catch {
    return '—'
  }
}
