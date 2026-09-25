import { NextResponse } from 'next/server'
import { loadMyStickers } from '@/lib/data/stickers'
import { signedInUserId, unauthorized } from '@/lib/stickers/http'

// GET /api/stickers/me → { copies, claims, vouchers }
//
// Your binder (every copy you hold, pressed or not), the nights whose stub
// you've claimed, and the beta vouchers you have left. Private.
export async function GET() {
  const userId = await signedInUserId()
  if (!userId) return unauthorized()
  return NextResponse.json(await loadMyStickers(userId))
}
