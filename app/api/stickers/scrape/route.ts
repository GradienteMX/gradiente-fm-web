import { NextResponse, type NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { scrapeCopy } from '@/lib/stickers/store'
import { STICKERS_TAG } from '@/lib/data/stickers'
import { badRequest, jsonBody, signedInUserId, stickerErrorResponse, unauthorized } from '@/lib/stickers/http'

// POST /api/stickers/scrape  { uid }
//
// One pass of the scraper over a sticker on your case (a quarter of it). At
// full wear the sticker and its copy are gone for good → { gone: true }.
export async function POST(request: NextRequest) {
  const userId = await signedInUserId()
  if (!userId) return unauthorized()
  const b = await jsonBody(request)
  if (!b || typeof b.uid !== 'string') return badRequest()
  try {
    const result = await scrapeCopy(createAdminClient(), userId, b.uid)
    revalidateTag(STICKERS_TAG, { expire: 0 })
    return NextResponse.json(result)
  } catch (e) {
    return stickerErrorResponse(e)
  }
}
