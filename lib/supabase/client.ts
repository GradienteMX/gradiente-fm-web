import { createBrowserClient } from '@supabase/ssr'

// Browser-side Supabase client for use in client components.
// Honors RLS via the `anon` key — never use the service-role key here.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
