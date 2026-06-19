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
  // NOTE: the extension list must include 3D/font assets (glb/gltf/hdr/ktx2/
  // bin/ttf/woff*) — otherwise anon requests for e.g. /tarjeta/*.glb get caught
  // by the auth gate and redirected to /welcome (served as HTML), breaking the
  // GLTF/texture loaders for the invitación-3d card.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|glb|gltf|hdr|ktx2|bin|ttf|otf|woff|woff2)$).*)',
  ],

}
