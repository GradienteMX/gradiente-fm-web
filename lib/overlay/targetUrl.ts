/** Keep the item and its addressed comment in one history update. */
export function overlayTargetUrl(href: string, slug: string | null, commentId?: string | null): string {
  const url = new URL(href)
  const previousSlug = url.searchParams.get('item')
  if (slug) {
    url.searchParams.set('item', slug)
    if (commentId) url.searchParams.set('comment', commentId)
    else if (commentId === null || previousSlug !== slug) url.searchParams.delete('comment')
  } else {
    url.searchParams.delete('item')
    url.searchParams.delete('comment')
  }
  return url.toString()
}
