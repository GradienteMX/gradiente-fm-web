import { NextResponse, type NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { placeCopy } from '@/lib/stickers/store'
import { STICKERS_TAG } from '@/lib/data/stickers'
import { badRequest, jsonBody, signedInUserId, stickerErrorResponse, unauthorized } from '@/lib/stickers/http'

// POST /api/stickers/apply  { uid, face, x, y, rot, scale }
//
// Presses one of your copies onto your credencial's case. Permanent: after
// this the only way off is scraping (POST /api/stickers/scrape). Position is
// clamped to the case's reach and stacked above everything already there.
export async function POST(request: NextRequest) {
  const userId = await signedInUserId()
  if (!userId) return unauthorized()
  const b = await jsonBody(request)
  if (!b || typeof b.uid !== 'string') return badRequest()
  try {
    const placement = await placeCopy(createAdminClient(), userId, b.uid, {
      face: b.face as 'frente' | 'dorso',
      x: Number(b.x),
      y: Number(b.y),
      rot: Number(b.rot),
      scale: Number(b.scale),
    })
    revalidateTag(STICKERS_TAG, { expire: 0 })
    return NextResponse.json({ placement })
  } catch (e) {
    return stickerErrorResponse(e)
  }
}
