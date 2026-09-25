import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { claimStub } from '@/lib/stickers/store'
import { getStickerCatalog } from '@/lib/data/stickers'
import { badRequest, clientUid, jsonBody, signedInUserId, stickerErrorResponse, unauthorized } from '@/lib/stickers/http'

// POST /api/stickers/stub  { eventId, uid? }
//
// «Estuve ahí»: a night's stub, self-reported while ticketing doesn't exist.
// One per person per night — even after it's scraped off — until a week
// after the night ends. Goes to the binder (nothing public changes).
export async function POST(request: NextRequest) {
  const userId = await signedInUserId()
  if (!userId) return unauthorized()
  const b = await jsonBody(request)
  if (!b || typeof b.eventId !== 'string') return badRequest()
  try {
    const copy = await claimStub(createAdminClient(), userId, b.eventId, await getStickerCatalog(), Date.now(), clientUid(b.uid))
    return NextResponse.json({ copy })
  } catch (e) {
    return stickerErrorResponse(e)
  }
}
