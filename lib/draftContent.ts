import type { ContentItem } from '@/lib/types'

export function slugify(input: string): string {
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 80)
}

export function patchDraftContent(draft: ContentItem, patch: Partial<ContentItem>, manualSlug: boolean): ContentItem {
  const next = { ...draft, ...patch }
  // Only a title edit may change a generated link. Loading an existing piece
  // or undoing a change must never rewrite a custom publication URL.
  if (patch.title !== undefined && !manualSlug && (!draft.slug || draft.slug === slugify(draft.title))) next.slug = slugify(patch.title)
  return next
}

export function readingMinutes(draft: ContentItem): number | undefined {
  if (draft.readTime && draft.readTime > 0) return draft.readTime
  const body = draft.articleBody?.map((block) => 'text' in block ? block.text : block.kind === 'track' ? block.commentary ?? '' : block.kind === 'list' ? block.items.join(' ') : '').join(' ') || draft.bodyPreview || ''
  const words = body.trim().split(/\s+/).filter(Boolean).length
  return words ? Math.max(1, Math.ceil(words / 220)) : undefined
}
