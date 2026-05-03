import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

// /api/admin/partners
// POST → create a new partner (items row with type='partner').
// Admin only — RLS gates via items_staff_write but we additionally require
// 'admin' role here so insiders/guides/curators can't create partners.
//
// Partners are organizational/business entities (labels, venues, promoters,
// sponsors). Mistyped data is harder to clean up than a regular content item,
// so the create path is more guarded.
//
// id format: `pa-{slug}-{rand}` keeps it human-readable + globally unique
// without requiring uuid lookups in admin tooling.

type PartnerKind = Database['public']['Enums']['partner_kind']

const VALID_KINDS: readonly PartnerKind[] = [
  'promo',
  'label',
  'promoter',
  'venue',
  'sponsored',
]

interface CreateBody {
  title: string
  slug: string
  partner_kind: PartnerKind
  partner_url?: string
  image_url: string
  vibe_min: number
  vibe_max: number
  marketplace_enabled?: boolean
  marketplace_description?: string
  marketplace_location?: string
  marketplace_currency?: string
}

export async function POST(request: NextRequest) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: Partial<CreateBody>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Validation — required fields + bounds.
  const title = body.title?.trim()
  const slug = body.slug?.trim()
  const partnerKind = body.partner_kind
  const imageUrl = body.image_url?.trim()
  const vibeMin = body.vibe_min
  const vibeMax = body.vibe_max

  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })
  if (!slug || !/^[a-z0-9-]{2,80}$/.test(slug)) {
    return NextResponse.json({ error: 'slug invalid (a-z0-9- only, 2-80 chars)' }, { status: 400 })
  }
  if (!partnerKind || !VALID_KINDS.includes(partnerKind)) {
    return NextResponse.json({ error: `partner_kind invalid (${VALID_KINDS.join('|')})` }, { status: 400 })
  }
  if (!imageUrl) return NextResponse.json({ error: 'image_url required' }, { status: 400 })
  const vibeValid = (v: unknown): v is number =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 10
  if (!vibeValid(vibeMin) || !vibeValid(vibeMax)) {
    return NextResponse.json({ error: 'vibe_min and vibe_max must be 0-10' }, { status: 400 })
  }
  if (vibeMin > vibeMax) {
    return NextResponse.json({ error: 'vibe_min must be <= vibe_max' }, { status: 400 })
  }

  const id = `pa-${slug}-${Math.random().toString(36).slice(2, 6)}`
  const marketplaceEnabled = !!body.marketplace_enabled

  const { data, error } = await supabase
    .from('items')
    .insert({
      id,
      slug,
      type: 'partner',
      title,
      vibe_min: Math.round(vibeMin),
      vibe_max: Math.round(vibeMax),
      genres: [],
      tags: [],
      image_url: imageUrl,
      published_at: new Date().toISOString(),
      partner_kind: partnerKind,
      partner_url: body.partner_url?.trim() || null,
      partner_last_updated: new Date().toISOString(),
      marketplace_enabled: marketplaceEnabled,
      marketplace_description: marketplaceEnabled
        ? body.marketplace_description?.trim() || null
        : null,
      marketplace_location: marketplaceEnabled
        ? body.marketplace_location?.trim() || null
        : null,
      marketplace_currency: marketplaceEnabled
        ? body.marketplace_currency?.trim() || null
        : null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'A partner with that slug already exists' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ partner: data })
}
