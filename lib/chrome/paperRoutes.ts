// «EL PLIEGO» ground map — which routes have flipped to the paper ground.
//
// Fase B flips the feed system: home + the pages that are pure compositions
// of it (agenda + the six category pages). Overlays stay dark until fase C;
// foro/marketplace/franja/mapa/admin until fase F; /u/[username] until fase E.
//
// Two consumers:
//   - Navigation reads isPaperRoute() to pick its stamping (paper masthead
//     with the red active underline vs the ink masthead with acid).
//   - Each paper page mounts <PaperGround /> itself, which toggles the
//     html.paper-route class that globals.css scopes the ground styles to
//     (mirror of the dashboard's dash-route mechanism).
// Keep the two in agreement: a route listed here must mount PaperGround.
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
] as const

export function isPaperRoute(pathname: string): boolean {
  if (pathname === '/') return true
  return PAPER_ROUTES.some((r) => r !== '/' && pathname.startsWith(r))
}
