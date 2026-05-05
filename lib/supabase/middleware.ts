import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Per-request session refresh + auth-gating for the whole site.
//
// The site behaves as invite-only — anonymous visitors are redirected to
// /welcome (NGE-themed terminal landing) and can't reach any other page or
// page-level RSC fetch. The defense-in-depth lives in 0014_auth_gated_reads
// at the RLS layer; this middleware is what shapes the user-facing flow.
//
// Allowlist for anonymous traffic:
//   - /welcome itself (the only page they're meant to see)
//   - /api/auth/*  (login + signup endpoints)
//   - static assets / _next chunks (already excluded by middleware.ts matcher)
//
// API routes other than /api/auth/* fall through. They each enforce their
// own auth in their handlers (return 401), which is the right shape for
// JSON consumers — middleware-redirecting them to HTML would corrupt the
// response.
//
// Wired in via `middleware.ts` at the project root.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: don't put any logic between the client creation and getUser().
  // getUser() validates the session and refreshes the cookie if needed; any
  // user-state-dependent work belongs after this call.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isApi = path.startsWith('/api/')
  const isWelcome = path === '/welcome'

  // Anonymous: redirect every page request to /welcome (API routes pass
  // through and self-401 in their handlers).
  if (!user && !isApi && !isWelcome) {
    const url = request.nextUrl.clone()
    url.pathname = '/welcome'
    url.search = ''
    return NextResponse.redirect(url)
  }

  // Authenticated: bounce off /welcome — once you're logged in there's no
  // reason to be on the landing.
  if (user && isWelcome) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
