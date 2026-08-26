import type { FranjaKind } from './types'

// Per-kind prefix for the //PRESENTA · X attribution chip + overlay byline.
// See wiki/90-Decisions/Franja Authoring.md for the vocabulary.
//
//   venue     → PRESENTA   (Club Japan presents this event)
//   label     → SELLO      (N.A.A.F.I. releases this mix)
//   promoter  → PROMOTORA  (FASCiNOMA puts on this party)
//   dealer    → DEALER     (Fhauna stocks this listing)
//   colectivo → COLECTIVO  (a crew puts on this event)
//   festival/club/medios/mix-series/plataforma → PRESENTA (venue-style verb)
//
// The verb describes the KIND, never the commercial relationship — a
// `sponsored` franja still gets the verb its kind earns.
export function franjaAttributionPrefix(kind: FranjaKind): string {
  switch (kind) {
    case 'venue':
      return 'PRESENTA'
    case 'label':
      return 'SELLO'
    case 'promoter':
      return 'PROMOTORA'
    case 'dealer':
      return 'DEALER'
    case 'colectivo':
      return 'COLECTIVO'
    case 'festival':
    case 'club':
    case 'medios':
    case 'mix-series':
    case 'plataforma':
      return 'PRESENTA'
  }
}
