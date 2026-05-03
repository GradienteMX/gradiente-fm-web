import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Per-request session refresh. Reads the Supabase auth cookie from the
// incoming request, refreshes if expired, and writes any updated cookies
// back onto the response so the next request stays authenticated.
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
  await supabase.auth.getUser()

  return supabaseResponse
}
