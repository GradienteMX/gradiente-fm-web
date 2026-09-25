import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redeemVoucher } from '@/lib/stickers/store'
import { getStickerCatalog } from '@/lib/data/stickers'
import { badRequest, clientUid, jsonBody, signedInUserId, stickerErrorResponse, unauthorized } from '@/lib/stickers/http'

// POST /api/stickers/redeem  { stickerId, uid? }
//
// The closed beta's store picks: spend one voucher on any sticker from a
// franja's shelf (payments don't exist yet). Numbered runs issue a real
// serial; everything carries the beta batch and is wiped at release.
export async function POST(request: NextRequest) {
  const userId = await signedInUserId()
  if (!userId) return unauthorized()
  const b = await jsonBody(request)
  if (!b || typeof b.stickerId !== 'string') return badRequest()
  try {
    const result = await redeemVoucher(createAdminClient(), userId, b.stickerId, await getStickerCatalog(), clientUid(b.uid))
    return NextResponse.json(result)
  } catch (e) {
    return stickerErrorResponse(e)
  }
}
