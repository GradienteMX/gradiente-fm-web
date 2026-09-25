// Shared plumbing for app/api/stickers/* — server-only.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { StickerError } from './store'

/** The signed-in member's id, from the request's auth cookie. */
export async function signedInUserId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function jsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const b = await request.json()
    return b && typeof b === 'object' ? (b as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export function stickerErrorResponse(e: unknown) {
  if (e instanceof StickerError) return NextResponse.json({ error: e.message }, { status: e.status })
  console.error('[stickers]', e)
  return NextResponse.json({ error: 'Algo falló al guardar el calco. Inténtalo de nuevo.' }, { status: 500 })
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** A client-minted copy uid, if it's a well-formed UUID (else the database mints one). */
export const clientUid = (v: unknown): string | undefined => (typeof v === 'string' && UUID.test(v) ? v.toLowerCase() : undefined)

export const unauthorized = () => NextResponse.json({ error: 'Necesitas una identidad.' }, { status: 401 })
export const badRequest = (msg = 'Petición inválida.') => NextResponse.json({ error: msg }, { status: 400 })
