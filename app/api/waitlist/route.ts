import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  WAITLIST_ALIAS_MAX,
  WAITLIST_CITIES,
  WAITLIST_EMAIL_RE,
  WAITLIST_SOURCES,
  type WaitlistJoinResponse,
  type WaitlistStats,
} from '@/lib/waitlist'

// /api/waitlist — the ONLY public write surface on the site besides signup.
//
// POST → join the waitlist (anonymous). Service-role write: anon has no RLS
//        path to the table at all, so every insert funnels through the
//        validation below. Idempotent on email — re-submitting returns the
//        existing queue position instead of an error.
// GET  → aggregate counts for the /espera stats panel. Numbers are real
//        (house rule: every readout true data) — no PII leaves this route,
//        only counts.
//
// Abuse posture (personal-beta scale, see feedback_captcha_over_rate_limits):
// honeypot field + allowlisted selects + unique email. No hard rate limits;
// if spam ever shows up, the next step is a captcha-after-N challenge, not
// 429s.

export const dynamic = 'force-dynamic'

interface JoinBody {
  alias?: string
  email?: string
  city?: string
  source?: string
  /** Honeypot. Real users never see this field; bots autofill it. */
  tel?: string
}

export async function POST(request: NextRequest) {
  let body: JoinBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Honeypot tripped → pretend everything worked. No insert, no signal back
  // to the bot that it was detected.
  if (body.tel && body.tel.trim() !== '') {
    return NextResponse.json<WaitlistJoinResponse>({
      ok: true,
      position: null,
      total: null,
      already: false,
    })
  }

  const alias = body.alias?.trim().slice(0, WAITLIST_ALIAS_MAX) ?? ''
  const email = body.email?.trim().toLowerCase() ?? ''
  // Selects are allowlisted server-side; anything else (tampered payloads)
  // degrades to null rather than polluting the segmentation columns.
  const city = WAITLIST_CITIES.includes(body.city as (typeof WAITLIST_CITIES)[number])
    ? (body.city as string)
    : null
  const source = WAITLIST_SOURCES.includes(body.source as (typeof WAITLIST_SOURCES)[number])
    ? (body.source as string)
    : null

  if (!alias) {
    return NextResponse.json(
      { ok: false, error: 'Falta tu alias. Elige un identificador.' },
      { status: 400 },
    )
  }
  if (!email || email.length > 254 || !WAITLIST_EMAIL_RE.test(email)) {
    return NextResponse.json(
      { ok: false, error: 'Ese correo no parece válido. Revísalo.' },
      { status: 400 },
    )
  }

  const admin = createAdminClient()

  // Insert; a duplicate email falls through to the existing row so the user
  // gets their real position back instead of "ya estabas registrado" dead-end.
  let already = false
  let row: { id: string; created_at: string } | null = null

  const { data: inserted, error: insErr } = await admin
    .from('waitlist_signups')
    .insert({ email, alias, city, source })
    .select('id, created_at')
    .single()

  if (insErr) {
    if (insErr.code === '23505') {
      already = true
      const { data: existing } = await admin
        .from('waitlist_signups')
        .select('id, created_at')
        .eq('email', email)
        .maybeSingle()
      row = existing ?? null
    } else if (insErr.code === '42P01' || insErr.code === 'PGRST205') {
      // Table not migrated yet — keep the campaign page alive with a clear
      // "come back later" instead of a raw 500.
      return NextResponse.json(
        { ok: false, error: 'La lista de espera no está disponible ahora. Intenta más tarde.' },
        { status: 503 },
      )
    } else {
      return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 })
    }
  } else {
    row = inserted
  }

  if (!row) {
    return NextResponse.json(
      { ok: false, error: 'No pudimos registrar tu señal. Intenta de nuevo.' },
      { status: 500 },
    )
  }

  // Queue position = how many signals arrived up to and including this one.
  // Stable over time except when earlier entries are deleted (position can
  // only improve).
  const [{ count: position }, { count: total }] = await Promise.all([
    admin
      .from('waitlist_signups')
      .select('*', { count: 'exact', head: true })
      .lte('created_at', row.created_at),
    admin.from('waitlist_signups').select('*', { count: 'exact', head: true }),
  ])

  return NextResponse.json<WaitlistJoinResponse>({
    ok: true,
    position: position ?? null,
    total: total ?? null,
    already,
  })
}

export async function GET() {
  const admin = createAdminClient()

  const [totalRes, pendingRes, invitedRes] = await Promise.all([
    admin.from('waitlist_signups').select('*', { count: 'exact', head: true }),
    admin
      .from('waitlist_signups')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    admin
      .from('waitlist_signups')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'invited'),
  ])

  // Missing table (migration pending) → zeros; the panel renders "—" states
  // rather than the page erroring.
  const stats: WaitlistStats = {
    senales: totalRes.count ?? 0,
    espera: pendingRes.count ?? 0,
    accesos: invitedRes.count ?? 0,
  }

  return NextResponse.json(stats, {
    headers: {
      // Vercel edge cache: stats can lag a minute; joins still feel live
      // because the POST response carries the fresh position.
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  })
}
