import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/auth/logout — clears the Supabase session cookie.
export async function POST() {
  const supabase = createClient()
  await supabase.auth.signOut()
  return NextResponse.json({ ok: true })
}
