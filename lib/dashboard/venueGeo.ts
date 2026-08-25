// ── venueGeo — curated CDMX venue → schematic coordinates (FINAL_SPEC §3.7) ─
//
// Honest v1 geodata: a hand-curated table, no geocoding deps, no map tiles.
// Coordinates live in the MAPA widget's schematic space:
//
//   x: 0 (poniente) → 100 (oriente)
//   y: 0 (norte)    → 100 (sur)
//
// Anchors for orientation: Centro ≈ (62, 38) · Juárez ≈ (50, 44) ·
// Roma Norte ≈ (47, 54) · Condesa ≈ (41, 56) · Coyoacán ≈ (53, 87).
// The CdmxSchematic SVG (WP8) draws in this same space.
//
// LAW (§3.7): dots ONLY for venues that resolve here. Unresolved events list
// under `// SIN UBICACIÓN` — never fake dots, never centroid plots. The TBA
// family («TBA», «TBA - …», «Secret Location», empty venue) is unresolvable
// BY RULE, not by omission. Venues whose real location is unverified stay
// out of the table on purpose; extending it is a one-line edit per venue.
// Prod venue census as of 2026-08-21 lives in the WP0-C validation evidence.
//
// Placement precision is neighborhood-level — exactly what a schematic city
// map communicates. `El Bajo Mundo` (GDL) and other non-CDMX venues are
// deliberately absent: this is the CDMX pliego.

export interface VenueGeoPoint {
  x: number
  y: number
  label: string // canonical display name (Spanish-scene spelling)
}

interface VenueGeoEntry extends VenueGeoPoint {
  // Normalized alias keys (see normalizeVenueName) — covers prod spelling
  // drift: «Club Japan» / «Japan Monterrey», «YuYu Cine Club» / «Yu Yu»,
  // «Foro Normandie» / «Foro EX Normandie», accent-less «Salon Los Angeles»…
  names: string[]
}

// Diacritic-free, lowercase, punctuation collapsed to single spaces.
// «Fünk» → «funk» · «M.N.Roy» → «m n roy» · «Salón Los Ángeles» →
// «salon los angeles» — the exact-match key space for the table below.
export function normalizeVenueName(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// The TBA family never resolves — a dot for «TBA - secret location» would be
// a fabricated position (§3.7 map-honesty law).
export function isUnresolvableVenueName(raw: string | null | undefined): boolean {
  if (!raw) return true
  const n = normalizeVenueName(raw)
  return n === '' || n === 'tba' || n.startsWith('tba ') || n.includes('secret location')
}

export const VENUE_GEO_TABLE: readonly VenueGeoEntry[] = [
  // ── The known seed set (FINAL_SPEC §3.7) ──────────────────────────────
  {
    names: ['club japan', 'japan monterrey', 'club japan monterrey 56', 'monterrey 56'],
    x: 47.5,
    y: 53,
    label: 'Club Japan',
  },
  { names: ['salon los angeles'], x: 57, y: 26, label: 'Salón Los Ángeles' },
  { names: ['foro normandie', 'foro ex normandie'], x: 50, y: 43, label: 'Foro Normandie' },
  {
    names: ['yu yu', 'yuyu', 'yuyu cine club', 'yu yu cine club'],
    x: 48.5,
    y: 46,
    label: 'Yu Yu',
  },
  // ── Recurring prod venues (census count ≥ 4, fixed locatable rooms) ────
  { names: ['funk'], x: 51.5, y: 44.5, label: 'Fünk' },
  { names: ['loo loo', 'looloo'], x: 52, y: 33, label: 'Loo Loo' },
  { names: ['bar oriente'], x: 62, y: 45, label: 'Bar Oriente' },
  { names: ['fronton bucareli'], x: 54.5, y: 41, label: 'Frontón Bucareli' },
  { names: ['terraza dos equis'], x: 63.6, y: 37.6, label: 'Terraza Dos Equis' },
  { names: ['terraza catedral'], x: 63, y: 38, label: 'Terraza Catedral' },
  { names: ['versalles 64'], x: 51, y: 43.5, label: 'Versalles 64' },
  // ── One-offs with known or address-named locations ─────────────────────
  { names: ['multiforo alicia'], x: 50, y: 58, label: 'Multiforo Alicia' },
  { names: ['foro indie rocks'], x: 48, y: 56.5, label: 'Foro Indie Rocks' },
  { names: ['foro tonala'], x: 49, y: 62, label: 'Foro Tonalá' },
  { names: ['cafe de nadie'], x: 45.5, y: 52.5, label: 'Café de Nadie' },
  { names: ['departamento'], x: 47, y: 54.5, label: 'Departamento' },
  { names: ['m n roy', 'mn roy'], x: 48.2, y: 55.2, label: 'M.N.Roy' },
  { names: ['parque espana'], x: 43, y: 53.5, label: 'Parque España' },
  { names: ['parque bicentenario'], x: 30, y: 14, label: 'Parque Bicentenario' },
  { names: ['cenart'], x: 60, y: 80, label: 'CENART' },
  { names: ['centro cultural espana'], x: 63.2, y: 37.4, label: 'Centro Cultural España' },
  { names: ['winona por siempre'], x: 52, y: 88, label: 'Winona Por Siempre' },
  { names: ['kurimanzutto'], x: 33, y: 53, label: 'Kurimanzutto' },
  { names: ['nuevo leon 89'], x: 41, y: 56, label: 'Nuevo León 89' },
  { names: ['campeche 367'], x: 42.5, y: 59.5, label: 'Campeche 367' },
  { names: ['mesones72', 'mesones 72'], x: 62.5, y: 41, label: 'Mesones72' },
  { names: ['niza 42', 'niza 42 cdmx'], x: 46, y: 45, label: 'Niza 42' },
  { names: ['garden zona rosa'], x: 45.3, y: 46.5, label: 'Garden Zona Rosa' },
  { names: ['av francisco i madero 6'], x: 61.5, y: 39, label: 'Madero 6 · Centro' },
  { names: ['claudio bernard 149'], x: 57, y: 49.5, label: 'Claudio Bernard 149' },
  { names: ['pasaje america'], x: 62.2, y: 38.3, label: 'Pasaje América' },
  { names: ['hookah lounge'], x: 40, y: 55, label: 'Hookah Lounge' },
  { names: ['bambu condesa'], x: 41.5, y: 57.2, label: 'Bambú Condesa' },
  { names: ['lienzo charro pedregal'], x: 44, y: 94, label: 'Lienzo Charro Pedregal' },
  {
    names: ['ex fabrica de harina anden tacuba', 'ex fabrica de harina'],
    x: 32,
    y: 20,
    label: 'Ex Fábrica de Harina · Tacuba',
  },
  { names: ['terraza allende'], x: 62, y: 36.8, label: 'Terraza Allende' },
  { names: ['foro bizarro'], x: 60.5, y: 48.5, label: 'Foro Bizarro' },
]

const geoByName: ReadonlyMap<string, VenueGeoPoint> = (() => {
  const map = new Map<string, VenueGeoPoint>()
  for (const entry of VENUE_GEO_TABLE) {
    const point: VenueGeoPoint = { x: entry.x, y: entry.y, label: entry.label }
    for (const name of entry.names) map.set(name, point)
  }
  return map
})()

// Exact-name match over the normalized key space. Null → the event renders
// in the `// SIN UBICACIÓN` list, never as a dot.
export function resolveVenueGeo(venue: string | null | undefined): VenueGeoPoint | null {
  if (!venue || isUnresolvableVenueName(venue)) return null
  return geoByName.get(normalizeVenueName(venue)) ?? null
}
