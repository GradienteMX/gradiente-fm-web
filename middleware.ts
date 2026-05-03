import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Runs on every request that matches `config.matcher` below. Refreshes
// the Supabase auth cookie so server components and route handlers see a
// valid session.
export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  // Skip static assets, image optimizer, and the favicon — they don't need
  // session state and adding the middleware noise just slows them down.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
