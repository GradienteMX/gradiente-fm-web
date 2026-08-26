import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminInviteCodes } from '@/components/admin/AdminInviteCodes'
import { AdminUsersEditor } from '@/components/admin/AdminUsersEditor'
import { AdminFranjasComposer } from '@/components/admin/AdminFranjasComposer'
import { AdminTabNav, type AdminTab } from '@/components/admin/AdminTabNav'
import { AdminEventsEditor } from '@/components/admin/AdminEventsEditor'
import { AdminWaitlist, type WaitlistAdminRow } from '@/components/admin/AdminWaitlist'
import { getAllEventsAdmin } from '@/lib/data/items'
import type { ContentItem } from '@/lib/types'
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

// /admin — admin-only insider surface. Tabbed layout (invitaciones /
// usuarios) so each section gets full attention without scroll fatigue.
// Future tabs: review queue (Scraper Pipeline Phase 3), franja-marketplace
// composer.
export default async function AdminPage({
  searchParams,
}: {
  searchParams: { tab?: string }
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

  const tab: AdminTab =
    searchParams.tab === 'users'
      ? 'users'
      : searchParams.tab === 'franjas'
      ? 'franjas'
      : searchParams.tab === 'events'
      ? 'events'
      : searchParams.tab === 'espera'
      ? 'espera'
      : 'invites'

  // Franjas are needed by BOTH tabs (invite-code franja dropdown +
  // user editor franja dropdown), so always fetch them. Cheap query —
  // franja count stays tiny (<20 even at scale).
  const { data: franjas } = await supabase
    .from('items')
    .select('id, title, franja_kind')
    .eq('type', 'franja')
    .order('title', { ascending: true })

  // Tab-specific prefetches — only pull what the active tab actually
  // renders. Keeps page weight bounded as more tabs land.
  let codes: InviteCodeRow[] = []
  let elevatedUsers: UserRow[] = []
  let recentUsers: UserRow[] = []
  let lectorUsers: UserRow[] = []
  let totalUsers = 0
  let roleCounts: Partial<Record<string, number>> = {}
  let modCount = 0
  let events: ContentItem[] = []
  let waitlistRows: WaitlistAdminRow[] = []

  if (tab === 'events') {
    events = await getAllEventsAdmin()
  } else if (tab === 'espera') {
    // Queue order (oldest first) — row index IS the queue position. The
    // invite embed rides the invite_code FK; used_at is what upgrades a row
    // to REGISTRADO in the UI. Errors (e.g. migration 0045 not applied yet)
    // degrade to an empty list rather than crashing the panel.
    const { data } = await supabase
      .from('waitlist_signups')
      .select('*, invite:invite_codes ( used_at )')
      .order('created_at', { ascending: true })
      .limit(1000)
    waitlistRows = (data as WaitlistAdminRow[] | null) ?? []
  } else if (tab === 'invites') {
    // Load the full code book (184 and growing slowly) so a specific person's
    // code is always present for the client-side filter. The old .limit(50)
    // ordered by created_at desc hid every code past the 50 newest — an older
    // redeemed code (e.g. folio 20 of 150) sat at rank ~126 and was invisible,
    // which read as "this user was never invited" even though they were. When
    // the code book outgrows a single page, swap this for a server-side search.
    const { data } = await supabase
      .from('invite_codes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000)
    codes = (data as InviteCodeRow[] | null) ?? []
  } else if (tab === 'franjas') {
    // Franjas tab fetches the existing-franjas list from `franjas`
    // (already prefetched above for the dropdowns) — no extra query.
  } else {
    // Three prefetches feed the users tab:
    //   - elevatedUsers — anyone with non-default perms (audit-staff
    //     workflow, stays bounded ~50 even at scale)
    //   - recentUsers — newest 25 by joined_at (so newly registered
    //     users appear immediately without needing to search)
    //   - lectorUsers — newest 50 with role='user' (surfaces vanilla
    //     readers as their own filterable bucket; the LECTOR stat chip
    //     switches the list to this set when active)
    // At scale this caps the prefetch surface at ~125 rows total. For
    // older lectors, the search bar hits /api/admin/users/search.
    const { data: elevated } = await supabase
      .from('users')
      .select('*')
      .or('role.neq.user,is_mod.eq.true,is_og.eq.true,franja_id.not.is.null')
      .order('username', { ascending: true })
    elevatedUsers = (elevated as UserRow[] | null) ?? []

    const { data: recent } = await supabase
      .from('users')
      .select('*')
      .order('joined_at', { ascending: false })
      .limit(25)
    recentUsers = (recent as UserRow[] | null) ?? []

    const { data: lectors } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'user')
      .order('joined_at', { ascending: false })
      .limit(50)
    lectorUsers = (lectors as UserRow[] | null) ?? []

    // Stats strip aggregates — three cheap queries.
    const totalRes = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
    totalUsers = totalRes.count ?? 0

    const { data: roleRows } = await supabase.from('users').select('role')
    for (const r of roleRows ?? []) {
      roleCounts[r.role] = (roleCounts[r.role] ?? 0) + 1
    }

    const modRes = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_mod', true)
    modCount = modRes.count ?? 0
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2 border-b border-border pb-4">
        <span
          className="inline-flex w-fit items-center gap-2 border px-2 py-0.5 font-mono text-[10px] tracking-widest"
          style={{ borderColor: '#F97316', color: '#F97316' }}
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sys-green" />
          ADMIN·SUBSISTEMA
        </span>
        <h1 className="font-syne text-3xl font-black leading-tight text-primary">
          PANEL DE ADMINISTRACIÓN
        </h1>
        <p className="font-mono text-[11px] leading-relaxed text-secondary">
          Sesión activa como{' '}
          <span className="text-primary">@{profile.username}</span> · rol{' '}
          <span className="text-primary uppercase">{profile.role}</span>
        </p>
      </header>

      <AdminTabNav />

      {tab === 'invites' && (
        <AdminInviteCodes
          initialCodes={codes}
          franjas={(franjas as FranjaOption[] | null) ?? []}
        />
      )}
      {tab === 'espera' && <AdminWaitlist initialRows={waitlistRows} />}
      {tab === 'users' && (
        <AdminUsersEditor
          elevatedUsers={elevatedUsers}
          recentUsers={recentUsers}
          lectorUsers={lectorUsers}
          franjas={(franjas as FranjaOption[] | null) ?? []}
          selfId={user.id}
          totalUsers={totalUsers}
          roleCounts={roleCounts}
          modCount={modCount}
        />
      )}
      {tab === 'franjas' && (
        <AdminFranjasComposer
          existing={(franjas as FranjaOption[] | null) ?? []}
        />
      )}
      {tab === 'events' && <AdminEventsEditor initialEvents={events} />}
    </div>
  )
}
