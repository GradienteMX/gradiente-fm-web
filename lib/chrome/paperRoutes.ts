// «EL PLIEGO» ground map — which routes render on the paper ground.
//
// Fase B flipped the feed system (home + agenda + the six category pages),
// fase C the overlays, fase E the expediente, and fase F the secondary
// surfaces: foro, public marketplace, the franja dossier, scene entities,
// admin, the waitlist and the identity pages.
//
// STILL DARK ON PURPOSE: `/mapa` (the honeycomb terrain is a dark instrument,
// not un-converted chrome — only its chrome speaks pliego) and `/dashboard`,
// which runs its own `html.dash-route` ground.
//
// ONE consumer contract, simplified in fase F:
//   - Navigation/AuthBadge/AhoraChip/ContentGrid/MobileNotice read
//     isPaperRoute() to pick their stamping.
//   - <PaperGround /> is mounted ONCE in app/layout.tsx and drives itself off
//     this list, toggling the html.paper-route class that globals.css scopes
//     the ground styles to.
// This list is therefore the single source of truth. It used to need to be
// kept in agreement with nine per-page <PaperGround/> mounts — that trap is
// gone; adding a route here is now the whole change.
export const PAPER_ROUTES = [
  '/',
  '/agenda',
  '/editorial',
  '/mixes',
  '/noticias',
  '/reviews',
  '/opinion',
  '/articulos',
  // fase E — the expediente
  '/u',
  // fase F — the secondary surfaces
  '/foro',
  '/marketplace',
  '/f', // the franja dossier, /f/[slug]
  '/e', // scene entities, /e/[slug]
  '/about',
  '/manifesto',
  '/equipo',
  '/admin',
  '/espera',
] as const

// Segment-boundary match, NOT a bare prefix.
//
// A plain `startsWith` is a live trap here: '/foro'.startsWith('/f') is true,
// so listing the franja dossier as '/f' would silently drag /foro along with
// it — and the same collision waits for any future one-letter route. Matching
// on a full path segment ('/f' or '/f/…', never '/foro') removes the whole
// class of bug rather than working around this instance of it.
export function isPaperRoute(pathname: string): boolean {
  if (pathname === '/') return true
  return PAPER_ROUTES.some(
    (r) => r !== '/' && (pathname === r || pathname.startsWith(`${r}/`)),
  )
}
