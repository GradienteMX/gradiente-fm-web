import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminInviteCodes } from '@/components/admin/AdminInviteCodes'
import type { Database } from '@/lib/supabase/database.types'

export const metadata: Metadata = { title: 'Admin · Gradiente FM' }
export const dynamic = 'force-dynamic'

type InviteCodeRow = Database['public']['Tables']['invite_codes']['Row']

// Shape passed to the partner dropdown — keeps the prop surface narrow so
// we don't ship the whole partner ContentItem (with marketplace listings,
// images, etc.) into the client bundle.
export interface PartnerOption {
  id: string
  title: string
  partner_kind: string | null
}

// /admin — admin-only insider surface. For chunk 2 ships only the
// invite-code generator. Future arrivals: review queue (Scraper Pipeline
// Phase 3), role/flag editor for existing users, partner-marketplace
// approvals (currently in Dashboard's PermisosSection prototype).
export default async function AdminPage() {
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

  // Pre-fetch the existing codes server-side so the first paint is populated.
  // Subsequent generates trigger router.refresh() to keep the list in sync.
  const { data: codes } = await supabase
    .from('invite_codes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  // Partners drive the partner-team dropdown in the invite-code form. Title
  // sort so the dropdown reads alphabetically.
  const { data: partners } = await supabase
    .from('items')
    .select('id, title, partner_kind')
    .eq('type', 'partner')
    .order('title', { ascending: true })

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10">
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

      <AdminInviteCodes
        initialCodes={(codes as InviteCodeRow[] | null) ?? []}
        partners={(partners as PartnerOption[] | null) ?? []}
      />
    </div>
  )
}
