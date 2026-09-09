import type { ActivityRow } from '@/lib/dashboard/activity'

export type SeenActivity = Readonly<Record<string, string>>

// Legacy mark-all timestamps and individually exposed rows share one rule.
// A later update to an aggregated activity row becomes unread again.
export function isActivityUnread(row: Pick<ActivityRow, 'key' | 'createdAt'>, watermark: string | null, seen: SeenActivity): boolean {
  return (!watermark || row.createdAt > watermark) && (!seen[row.key] || row.createdAt > seen[row.key])
}
