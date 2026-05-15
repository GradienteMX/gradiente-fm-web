import type { PartnerKind } from './types'

// Per-kind prefix for the //PRESENTA · X attribution chip + overlay byline.
// See wiki/90-Decisions/Partner Authoring.md for the vocabulary.
//
//   venue     → PRESENTA   (Club Japan presents this event)
//   label     → SELLO      (N.A.A.F.I. releases this mix)
//   promoter  → PROMOTORA  (FASCiNOMA puts on this party)
//   promo     → PROMOTORA  (alias for promoter)
//   dealer    → DEALER     (Fhauna stocks this listing)
//   sponsored → PRESENTA   (neutral — paid placements use the venue-style verb)
export function partnerAttributionPrefix(kind: PartnerKind): string {
  switch (kind) {
    case 'venue':
      return 'PRESENTA'
    case 'label':
      return 'SELLO'
    case 'promoter':
    case 'promo':
      return 'PROMOTORA'
    case 'dealer':
      return 'DEALER'
    case 'sponsored':
      return 'PRESENTA'
  }
}
