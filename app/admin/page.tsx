import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminInviteCodes } from '@/components/admin/AdminInviteCodes'
import { AdminUsersEditor } from '@/components/admin/AdminUsersEditor'
import { AdminPartnersComposer } from '@/components/admin/AdminPartnersComposer'
import { AdminTabNav, type AdminTab } from '@/components/admin/AdminTabNav'
import type { Database } from '@/lib/supabase/database.types'

export const metadata: Metadata = { title: 'Admin · Gradiente FM' }
export const dynamic = 'force-dynamic'

type InviteCodeRow = Database['public']['Tables']['invite_codes']['Row']
type UserRow = Database['public']['Tables']['users']['Row']

// Shape passed to the partner dropdown — keeps the prop surface narrow so
// we don't ship the whole partner ContentItem (with marketplace listings,
// images, etc.) into the client bundle.
export interface PartnerOption {
  id: string
  title: string
  partner_kind: string | null
}

// /admin — admin-only insider surface. Tabbed layout (invitaciones /
// usuarios) so each section gets full attention without scroll fatigue.
// Future tabs: review queue (Scraper Pipeline Phase 3), partner-marketplace
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
      : searchParams.tab === 'partners'
      ? 'partners'
      : 'invites'

  // Partners are needed by BOTH tabs (invite-code partner dropdown +
  // user editor partner dropdown), so always fetch them. Cheap query —
  // partner count stays tiny (<20 even at scale).
  const { data: partners } = await supabase
    .from('items')
    .select('id, title, partner_kind')
    .eq('type', 'partner')
    .order('title', { ascending: true })

  // Tab-specific prefetches — only pull what the active tab actually
  // renders. Keeps page weight bounded as more tabs land.
  let codes: InviteCodeRow[] = []
  let elevatedUsers: UserRow[] = []
  let totalUsers = 0
  let roleCounts: Partial<Record<string, number>> = {}
  let modCount = 0

  if (tab === 'invites') {
    const { data } = await supabase
      .from('invite_codes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    codes = (data as InviteCodeRow[] | null) ?? []
  } else if (tab === 'partners') {
    // Partners tab fetches the existing-partners list from `partners`
    // (already prefetched above for the dropdowns) — no extra query.
  } else {
    // Pre-fetch ELEVATED users only (anyone with non-default perms). At
    // scale this set stays small (~50 even at 10k users) — admins audit
    // staff most often. Plain users come in via /api/admin/users/search.
    const { data } = await supabase
      .from('users')
      .select('*')
      .or('role.neq.user,is_mod.eq.true,is_og.eq.true,partner_id.not.is.null')
      .order('username', { ascending: true })
    elevatedUsers = (data as UserRow[] | null) ?? []

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
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
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
          partners={(partners as PartnerOption[] | null) ?? []}
        />
      )}
      {tab === 'users' && (
        <AdminUsersEditor
          elevatedUsers={elevatedUsers}
          partners={(partners as PartnerOption[] | null) ?? []}
          selfId={user.id}
          totalUsers={totalUsers}
          roleCounts={roleCounts}
          modCount={modCount}
        />
      )}
      {tab === 'partners' && (
        <AdminPartnersComposer
          existing={(partners as PartnerOption[] | null) ?? []}
        />
      )}
    </div>
  )
}
