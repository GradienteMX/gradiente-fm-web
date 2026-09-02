import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/requireAdmin'
import { getAdminItemDetail } from '@/lib/data/adminItems'

// GET /api/admin/items/[id]/stats?dias=30
//
// The expanded item dossier: live decayed HL, the per-interaction-kind
// breakdown, exact save/comment/vibe-check counts, every admin adjustment the
// piece has received, and the daily net series.
//
// Fetched on expand rather than shipped with the list. A CONTENIDO page holds
// 50 rows; hydrating every dossier up front would mean 50 ledger scans and 200
// count queries for the one row the operator actually opens.

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const raw = Number(request.nextUrl.searchParams.get('dias'))
  // Clamp rather than reject: a hand-edited URL should degrade to a sane
  // window, not a 400. 180 is the ledger's own retention ceiling
  // (sweep_old_hp_events), so asking for more can only return sparser data.
  const days = Number.isFinite(raw) ? Math.min(180, Math.max(1, Math.round(raw))) : 30

  const detail = await getAdminItemDetail(params.id, days)
  if (!detail) return NextResponse.json({ error: 'Item no encontrado' }, { status: 404 })

  return NextResponse.json(detail)
}
