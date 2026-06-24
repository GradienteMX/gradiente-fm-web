import { NextResponse } from 'next/server'

// Unauthenticated liveness probe. Middleware lets /api/* fall through without
// the /welcome redirect (see lib/supabase/middleware.ts), and this handler
// never touches the auth-gated DB — so it answers for anon callers / uptime
// monitors. Intentionally trivial: presence + timestamp, no secrets and no
// per-request DB read (so it can't be turned into a load amplifier).
export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'gradiente',
    time: new Date().toISOString(),
  })
}
