import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminTabNav } from '@/components/admin/AdminTabNav'
import { AdminInviteCodes } from '@/components/admin/AdminInviteCodes'
import { AdminUsersEditor } from '@/components/admin/AdminUsersEditor'
import { AdminFranjasComposer } from '@/components/admin/AdminFranjasComposer'
import { AdminEventsEditor } from '@/components/admin/AdminEventsEditor'
import { AdminWaitlist, type WaitlistAdminRow } from '@/components/admin/AdminWaitlist'
import { AccesoTab } from '@/components/admin/AccesoTab'
import { ResumenTab } from '@/components/admin/ResumenTab'
import { ContenidoTab } from '@/components/admin/ContenidoTab'
import { ModeracionTab } from '@/components/admin/ModeracionTab'
import { getAllEventsAdmin } from '@/lib/data/items'
import { getAdminOverview } from '@/lib/data/adminStats'
import { listAdminItems } from '@/lib/data/adminItems'
import { clampAdminOffset } from '@/lib/admin/paging'
import { resolveAdminTab, legacySubTab } from '@/lib/admin/tabs'
import type { ContentItem, ContentType } from '@/lib/types'
import type { Database } from '@/lib/supabase/database.types'

export const metadata: Metadata = { title: 'Admin · Gradiente' }
export const dynamic = 'force-dynamic'

type InviteCodeRow = Database['public']['Tables']['invite_codes']['Row']
type UserRow = Database['public']['Tables']['users']['Row']

// Shape passed to the franja dropdown — keeps the prop surface narrow so
// we don't ship the whole franja ContentItem (with marketplace listings,
// images, etc.) into the client bundle.
export interface FranjaOption {
  id: string
  title: string
  franja_kind: string | null
}

// /admin — «CENTRAL DE ADMINISTRACIÓN».
//
// Seven spaces: RESUMEN · CONTENIDO · EVENTOS · FRANJAS · USUARIOS · ACCESO ·
// MODERACIÓN. Three of them are new (RESUMEN, CONTENIDO, MODERACIÓN), one is a
// merge (ACCESO absorbs the old INVITACIONES + ESPERA tabs), three carry over
// unchanged. Old ?tab= values are aliased in lib/admin/tabs.ts, never dropped.
//
// The instrument this page became. Before the redesign /admin could see one
// content type (eventos, 450 of 601 items) and had ZERO HP/HL surface — no
// tile, no column, no lever. It now reads the HL ledger that migration 0049
// created, which is the point: the team is calibrating a decay-based curation
// model at 61 users, and until now the only way to see what HL was doing was
// to look at the feed and guess.
//
// TWO LAWS THIS SURFACE DELIBERATELY BENDS, and why that is not a regression:
//
//   · «no visible engagement metrics» (CLAUDE.md) and «HL is words, never the
//     raw scalar» (lib/dashboard/hl.ts) are PUBLIC-surface laws. They exist so
//     readers are never ranked at and so creators are never handed a
//     view-count to chase. /admin is server-gated to role='admin', renders for
//     eight accounts, and is the one place the team must see the real numbers
//     to tune them. The laws stay intact everywhere they were written for.
//     See wiki/90-Decisions/Admin Instrument Exemption.md — written BEFORE
//     this surface, so a future reviewer finds the reasoning and not just the
//     violation.
//
//   · the acid ration (one fill-block per surface) is spent HERE on the
//     create rail at the foot of RESUMEN — four peer creative actions inside
//     ONE AcidBlock, not four acid buttons. The masthead's ADMIN stamp is
//     chrome identity rather than an action and does not draw from the ration.
//
// GROUND: '/admin' is listed in PAPER_ROUTES and <PaperGround/> is mounted
// once in app/layout.tsx, so this page must NOT wrap itself in a bg-paper
// container — that re-introduces the nine-mount trap fase F removed.
export default async function AdminPage({
  searchParams,
}: {
  searchParams: {
    tab?: string
    sub?: string
    dias?: string
    tipo?: string
    estado?: string
    q?: string
    orden?: string
    filtro?: string
    desde?: string
  }
}) {
  const supabase = createClient()

  // Gate the entire route on admin role. Anonymous → /, signed-in
  // non-admin → / (we don't want to leak the existence of /admin).
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('users')
    .select('role, username, display_name')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile || profile.role !== 'admin') redirect('/')

  const tab = resolveAdminTab(searchParams.tab)

  // Franjas are needed by the invite-code and user-editor dropdowns on two
  // different tabs, so they are always fetched. NOTE: production holds 78
  // franja rows — the pre-redesign comment here claimed "<20 even at scale"
  // and was simply wrong. Do not size a UI against that number.
  const { data: franjas } = await supabase
    .from('items')
    .select('id, title, franja_kind')
    .eq('type', 'franja')
    .order('title', { ascending: true })
  const franjaOptions = (franjas as FranjaOption[] | null) ?? []

  // The MODERACIÓN latch carries a real open-report count on every tab, so the
  // operator sees work arrive without having to visit the tab. Degrades to
  // undefined (no count, no dot) when migration 0049 has not been applied.
  const openReports = await supabase
    .from('reports' as never)
    .select('id', { count: 'exact', head: true })
    .eq('status', 'abierto')
  const moderacionCount = openReports.error ? undefined : openReports.count ?? 0

  // Tab-specific prefetches — only pull what the active tab renders, so page
  // weight stays bounded as tabs accumulate.
  let codes: InviteCodeRow[] = []
  let elevatedUsers: UserRow[] = []
  let recentUsers: UserRow[] = []
  let lectorUsers: UserRow[] = []
  let totalUsers = 0
  const roleCounts: Partial<Record<string, number>> = {}
  let modCount = 0
  let events: ContentItem[] = []
  let waitlistRows: WaitlistAdminRow[] = []

  if (tab === 'eventos') {
    events = await getAllEventsAdmin()
  } else if (tab === 'acceso') {
    const [codesRes, waitRes] = await Promise.all([
      // The full code book (217 and growing slowly) so a specific person's
      // code is always present for the client-side filter. An older redeemed
      // code used to sit past a .limit(50) and read as "never invited".
      supabase
        .from('invite_codes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000),
      // Queue order (oldest first) — row index IS the queue position. Errors
      // (e.g. migration 0045 unapplied) degrade to an empty list.
      supabase
        .from('waitlist_signups')
        .select('*, invite:invite_codes ( used_at )')
        .order('created_at', { ascending: true })
        .limit(1000),
    ])
    codes = (codesRes.data as InviteCodeRow[] | null) ?? []
    waitlistRows = (waitRes.data as WaitlistAdminRow[] | null) ?? []
  } else if (tab === 'usuarios') {
    const [elevated, recent, lectors, totalRes, roleRows, modRes] = await Promise.all([
      // Anyone with non-default perms — the audit-staff workflow. Bounded
      // (~50) even at scale.
      supabase
        .from('users')
        .select('*')
        .or('role.neq.user,is_mod.eq.true,is_og.eq.true,franja_id.not.is.null')
        .order('username', { ascending: true }),
      supabase.from('users').select('*').order('joined_at', { ascending: false }).limit(25),
      supabase
        .from('users')
        .select('*')
        .eq('role', 'user')
        .order('joined_at', { ascending: false })
        .limit(50),
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('role'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_mod', true),
    ])
    elevatedUsers = (elevated.data as UserRow[] | null) ?? []
    recentUsers = (recent.data as UserRow[] | null) ?? []
    lectorUsers = (lectors.data as UserRow[] | null) ?? []
    totalUsers = totalRes.count ?? 0
    for (const r of roleRows.data ?? []) roleCounts[r.role] = (roleCounts[r.role] ?? 0) + 1
    modCount = modRes.count ?? 0
  }

  const dias = clampDays(searchParams.dias)

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 text-ink">
      <header className="flex flex-col gap-2 border-b border-ink pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-syne text-d18 font-extrabold tracking-tight text-ink">
            GRADIENTE
          </span>
          {/* Chrome identity, not an action — it does not spend the acid
              ration the create rail claims. */}
          <span className="bg-acid px-1.5 py-0.5 font-mono text-d11 font-bold tracking-widest text-ink">
            ADMIN
          </span>
        </div>
        <h1 className="font-syne text-d28 font-extrabold uppercase text-ink">
          Central de administración
        </h1>
        <p className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
          SESIÓN ACTIVA COMO <span className="text-ink">@{profile.username}</span> · ROL{' '}
          <span className="text-ink">{profile.role}</span>
        </p>
      </header>

      <AdminTabNav counts={{ moderacion: moderacionCount }} />

      {tab === 'resumen' && <ResumenTab overview={await getAdminOverview(dias)} dias={dias} />}

      {tab === 'contenido' && (
        <ContenidoTab
          initial={await listAdminItems({
            days: dias,
            type: (searchParams.tipo as ContentType | 'all') ?? 'all',
            estado: (searchParams.estado as 'all' | 'publicado' | 'borrador') ?? 'all',
            q: searchParams.q ?? '',
            orden: (searchParams.orden as 'hp' | 'reciente' | 'delta' | 'caida') ?? 'hp',
            offset: clampAdminOffset(searchParams.desde),
          })}
          dias={dias}
          desde={clampAdminOffset(searchParams.desde)}
          filters={{
            tipo: searchParams.tipo ?? 'all',
            estado: searchParams.estado ?? 'all',
            q: searchParams.q ?? '',
            orden: searchParams.orden ?? 'hp',
          }}
        />
      )}

      {tab === 'acceso' && (
        <AccesoTab
          initialSub={legacySubTab(searchParams.tab) ?? searchParams.sub ?? 'invitaciones'}
          invitaciones={<AdminInviteCodes initialCodes={codes} franjas={franjaOptions} />}
          espera={<AdminWaitlist initialRows={waitlistRows} />}
          counts={{ invitaciones: codes.length, espera: waitlistRows.length }}
        />
      )}

      {tab === 'usuarios' && (
        <AdminUsersEditor
          elevatedUsers={elevatedUsers}
          recentUsers={recentUsers}
          lectorUsers={lectorUsers}
          franjas={franjaOptions}
          selfId={user.id}
          totalUsers={totalUsers}
          roleCounts={roleCounts}
          modCount={modCount}
        />
      )}

      {tab === 'franjas' && <AdminFranjasComposer existing={franjaOptions} />}
      {tab === 'eventos' && (
        <AdminEventsEditor initialEvents={events} initialFilter={searchParams.filtro} />
      )}
      {tab === 'moderacion' && <ModeracionTab />}
    </div>
  )
}

/**
 * Window selector. Clamped to the ledger's own retention ceiling: 180 days is
 * what sweep_old_hp_events() keeps, so a longer window can only add empty
 * space and imply data was lost rather than never kept.
 */
function clampDays(raw: string | undefined): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return 30
  return Math.min(180, Math.max(7, Math.round(n)))
}

