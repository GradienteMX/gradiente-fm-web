import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

// Service-role client. Bypasses RLS entirely — use ONLY in server code that
// genuinely needs admin powers (signup endpoint, scheduled jobs, the seed
// script). Never import into a client component.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
