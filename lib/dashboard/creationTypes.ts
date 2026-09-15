import { canCreateContent } from '@/lib/permissions'
import type { ContentType, User } from '@/lib/types'

// The visible "Texto" choice uses an existing format the role may create.
// Franja teams retain their opinion workflow without gaining article grants.
export function dashboardTextType(user: User | null): Extract<ContentType, 'articulo' | 'editorial' | 'opinion'> | null {
  return (['articulo', 'editorial', 'opinion'] as const).find((type) => canCreateContent(user, type)) ?? null
}
