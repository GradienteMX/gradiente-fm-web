/**
 * Reports and their queue.
 *
 *   report          POST /api/reports { target_type, target_id, reason, note }   → { id }
 *   report-resolve  PATCH /api/admin/reports/[id] { status, resolution }         moderators and admins
 *
 * Ids: reports.id is a bigserial — the one row V2 can't name itself. The
 * report keeps its client id (`rp-…`) until the route answers with the
 * server's; the effect hands that name back (ids.ts), a resolution filed in
 * the meantime waits for it (`serverId`), and the world calls the report by
 * its number from then on. A second report of the same thing by the same
 * person is not an error: the route answers with the first one's id.
 */

import { registerEffect } from '../effects'
import { serverId, trackId } from '../ids'
import { requestRefresh } from '../refresh'
import { send } from './http'
import { reportBody } from './mapping'

registerEffect('report', async (a, { before }) => {
  // One report per person per thing: the reducer keeps the first, and so does the table.
  if (before.reports.some((r) => r.reporterId === a.report.reporterId && r.targetType === a.report.targetType && r.targetId === a.report.targetId)) return
  const clientId = a.report.id
  const id = await trackId(
    clientId,
    send<{ id?: unknown }>('POST', '/api/reports', reportBody(a.report), {
      fallback: 'No se pudo enviar el reporte. Intenta de nuevo.',
    }).then((r) => (r.id === undefined || r.id === null ? clientId : String(r.id))),
  )
  requestRefresh()
  return id !== clientId ? { ids: { [clientId]: id } } : undefined
})

registerEffect('report-resolve', async (a) => {
  const id = await serverId(a.id)
  await send('PATCH', `/api/admin/reports/${encodeURIComponent(id)}`, { status: a.status, resolution: a.resolution }, {
    fallback: 'No se pudo cerrar el reporte. El cambio se deshizo.',
    messages: { 403: 'Solo moderación cierra reportes.', 404: 'Ese reporte ya no está.' },
  })
})
