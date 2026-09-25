import { redirect } from 'next/navigation'
import { legacySub, resolveTab } from '@/components/central/tabs'

/**
 * `/admin` was production's route. It lives on as a redirect so four months
 * of bookmarks land in Central — with their tab (legacy names included),
 * their window and their filters intact.
 */
export default async function AdminRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const out = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) {
    const val = Array.isArray(v) ? v[0] : v
    if (typeof val === 'string' && val !== '') out.set(k, val)
  }
  const raw = out.get('tab')
  if (raw !== null) {
    const tab = resolveTab(raw)
    const sub = legacySub(raw)
    if (tab === 'resumen') out.delete('tab')
    else out.set('tab', tab)
    if (sub && !out.has('sub')) out.set('sub', sub)
  }
  const q = out.toString()
  redirect(q ? `/central?${q}` : '/central')
}
