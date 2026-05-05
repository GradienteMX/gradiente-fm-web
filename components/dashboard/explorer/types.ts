// Explorer-shell internal types. Kept minimal and local — these don't leak
// outside components/dashboard/explorer.

export type ExplorerSection =
  | 'home'
  | 'nuevo'
  | 'drafts'
  | 'publicados'
  | 'profile'
  // Guardados folder — saved-content views (one per type filter, and a
  // top-level "feed" view that's the union of everything saved).
  | 'guardados-feed'
  | 'guardados-agenda'
  | 'guardados-noticias'
  | 'guardados-reviews'
  | 'guardados-mixes'
  | 'guardados-editoriales'
  | 'guardados-articulos'
  // Saved comments live in the same folder but are a sibling rather than a
  // content-type filter — comments aren't ContentItems.
  | 'guardados-comentarios'
  // Admin-only marketplace approvals — toggle marketplaceEnabled on
  // partners. See [[Marketplace]].
  | 'aprobaciones-mkt'
  // Partner-team-only — visible when currentUser.partnerId is set. Two
  // tabs: equipo + marketplace.
  | 'mi-partner'

export interface SelectionMeta {
  id: string
  label: string
  kind: string
  color: string
  size?: string
  description?: string
  extra?: { key: string; value: string; valueColor?: string }[]
}
