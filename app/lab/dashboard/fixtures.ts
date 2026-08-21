// ── /lab/dashboard fixtures — provider-boundary scenarios (BUILD_PLAN WP2) ──
//
// Fixture data flows into the dashboard through EXACTLY one door: the
// `initialSlices` prop of DashboardDataProvider. Nothing under
// components/dashboard/** may import this file (grep gate — lab isolation).
//
// Ids/slugs are all `lab-fx-` prefixed so a fixture can never shadow a real
// row if it leaks into the session's itemsCache while browsing the lab.
// Dates are relative to load time so urgency states render honestly.

import type {
  DashboardInitialSlices,
  EngagementSlice,
  PartnerSlice,
  VibeSelfCheck,
} from '@/components/dashboard/DashboardDataProvider'
import type { ActivityRow } from '@/lib/dashboard/activity'
import type { PartnerOption } from '@/lib/dashboard/novedades'
import type { DraftItem } from '@/lib/drafts'
import type { ContentItem, MarketplaceListing, User } from '@/lib/types'

// ── Time helpers ────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000

function daysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString()
}

function daysAhead(days: number): string {
  return new Date(Date.now() + days * DAY_MS).toISOString()
}

// ── Item factory ────────────────────────────────────────────────────────────

type ItemSeed = Partial<ContentItem> &
  Pick<ContentItem, 'type' | 'title'> & { n: number }

function makeItem({ n, ...seed }: ItemSeed): ContentItem {
  const slug = `lab-fx-${seed.type}-${String(n).padStart(2, '0')}`
  return {
    id: slug,
    slug,
    vibeMin: 3,
    vibeMax: 6,
    genres: [],
    tags: [],
    publishedAt: daysAgo(n),
    embeds: [],
    tracklist: [],
    editorial: false,
    pinned: false,
    elevated: false,
    ...seed,
  }
}

function makeDraft(item: ContentItem, updatedDaysAgo: number): DraftItem {
  return {
    ...item,
    _draftState: 'draft',
    _createdAt: daysAgo(updatedDaysAgo + 2),
    _updatedAt: daysAgo(updatedDaysAgo),
  }
}

// Actor ids flow into uuid-typed USER lookups (user_rank_signals via
// useUserRank, public.users via the activity resolver). A non-uuid id there
// makes the whole batched `in (…)` select fail (22P02) and retry forever —
// the [userRanksCache] console spam. So actors get uuid-SHAPED fakes (v4
// layout, matching LAB_USER_BASE's 00000000-…-4000-8000-… family; a1/a2/a3
// are taken by the lab users). Queries for them succeed and return zero rows
// → rank 'normie', anonymous actor — honest lab states, silent console.
// ITEM/partner ids KEEP the `lab-fx-` prefix: items.id is TEXT, and the
// prefix is the shadowing guard described above.
const ACTOR_A = '00000000-0000-4000-8000-0000000000b1'
const ACTOR_B = '00000000-0000-4000-8000-0000000000b2'
const PARTNER_JAPAN = 'lab-fx-partner-japan'
const PARTNER_FASCINOMA = 'lab-fx-partner-fascinoma'
const PARTNER_YUYU = 'lab-fx-partner-yuyu'

// ── Shared building blocks ──────────────────────────────────────────────────

const PARTNER_OPTIONS: PartnerOption[] = [
  { id: PARTNER_JAPAN, slug: 'lab-fx-club-japan', title: 'Club Japan' },
  { id: PARTNER_FASCINOMA, slug: 'lab-fx-fascinoma', title: 'FASCINOMA' },
  { id: PARTNER_YUYU, slug: 'lab-fx-yuyu', title: 'YuYu Cine Club' },
]

// 5 upcoming events: 4 resolve through venueGeo (auto-expand eligible) + one
// TBA that must land under // SIN UBICACIÓN — never a fake dot.
const EVENTS_RICH: ContentItem[] = [
  makeItem({
    n: 1,
    type: 'evento',
    title: 'Ritmo Fantasma',
    imageUrl: '/flyers/techno-rave.jpg',
    venue: 'Club Japan',
    venueCity: 'CDMX',
    date: daysAhead(1),
    artists: ['DJ Bruma', 'Selva'],
    vibeMin: 6,
    vibeMax: 9,
    genres: ['techno'],
  }),
  makeItem({
    n: 2,
    type: 'evento',
    title: 'Salón Eterno',
    imageUrl: '/flyers/pulse-1990.jpg',
    venue: 'Salón Los Ángeles',
    venueCity: 'CDMX',
    date: daysAhead(3),
    artists: ['Orquesta Niebla'],
    vibeMin: 2,
    vibeMax: 5,
    genres: ['house'],
  }),
  makeItem({
    n: 3,
    type: 'evento',
    title: 'Normandie Sessions',
    imageUrl: '/flyers/eclipse.jpg',
    venue: 'Foro Normandie',
    venueCity: 'CDMX',
    date: daysAhead(6),
    artists: ['Cauce'],
    vibeMin: 4,
    vibeMax: 7,
  }),
  makeItem({
    n: 4,
    type: 'evento',
    title: 'Cine y Bajos',
    imageUrl: '/flyers/universe-planet.jpg',
    venue: 'Yu Yu',
    venueCity: 'CDMX',
    date: daysAhead(9),
    artists: ['Marea Baja'],
    vibeMin: 1,
    vibeMax: 4,
    genres: ['ambient'],
  }),
  makeItem({
    n: 5,
    type: 'evento',
    title: 'Secreto de Medianoche',
    venue: 'TBA',
    venueCity: 'CDMX',
    date: daysAhead(12),
    vibeMin: 7,
    vibeMax: 10,
  }),
]

const SAVES_RICH: ContentItem[] = [
  makeItem({
    n: 10,
    type: 'mix',
    title: 'Chaotic Trip — Set 1',
    imageUrl: '/flyers/spiral-tribe.jpg',
    author: 'backYardboy',
    mixUrl: 'https://www.mixcloud.com/backYardboy/chaotic-trip-set-1-for-gradiente/',
    embeds: [
      {
        platform: 'mixcloud',
        url: 'https://www.mixcloud.com/backYardboy/chaotic-trip-set-1-for-gradiente/',
      },
    ],
    duration: '1:02:10',
    vibeMin: 5,
    vibeMax: 8,
    genres: ['techno'],
  }),
  makeItem({
    n: 11,
    type: 'mix',
    title: 'What You Do To Me',
    imageUrl: '/flyers/rip-acidhouse.jpg',
    author: 'itsgettingtiresometoo',
    mixUrl: 'https://soundcloud.com/itsgettingtiresometoo/what-you-do-to-me',
    embeds: [
      {
        platform: 'soundcloud',
        url: 'https://soundcloud.com/itsgettingtiresometoo/what-you-do-to-me',
      },
    ],
    vibeMin: 3,
    vibeMax: 6,
    genres: ['house'],
  }),
  makeItem({
    n: 12,
    type: 'mix',
    title: 'Lofi Continuo',
    embeds: [{ platform: 'youtube', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk' }],
    vibeMin: 0,
    vibeMax: 3,
    genres: ['ambient'],
  }),
  makeItem({
    n: 13,
    type: 'mix',
    title: 'Cassette del Bajo Mundo',
    imageUrl: '/flyers/back-in-the-jungle.jpg',
    embeds: [{ platform: 'bandcamp', url: 'https://bandcamp.com/' }],
    vibeMin: 6,
    vibeMax: 9,
  }),
  ...EVENTS_RICH.slice(0, 3),
  makeItem({
    n: 14,
    type: 'review',
    title: 'Reseña: Niebla en Vinilo',
    author: 'iker',
    imageUrl: '/flyers/darkside.jpg',
  }),
  // n15 stays imageless on purpose — exercises the no-artwork panel state.
  makeItem({ n: 15, type: 'review', title: 'Reseña: Noche en Bucareli' }),
  makeItem({
    n: 16,
    type: 'editorial',
    title: 'El género es una mentira',
    editorial: true,
    imageUrl: '/flyers/man-or-machine.jpg',
    readTime: 9,
  }),
  makeItem({
    n: 17,
    type: 'noticia',
    title: 'Nueva residencia en la Roma',
    imageUrl: '/flyers/orbital-omen.jpg',
  }),
  makeItem({
    n: 18,
    type: 'articulo',
    title: 'Cartografía del under CDMX',
    imageUrl: '/flyers/tresor-underground.jpg',
    readTime: 14,
  }),
]

const PUBLISHED_RICH: ContentItem[] = [
  makeItem({
    n: 20,
    type: 'mix',
    title: 'Transmisión 001',
    imageUrl: '/flyers/kaos-sasha.jpg',
    hp: 42,
    hpLastUpdatedAt: daysAgo(0),
    genres: ['techno'],
  }),
  makeItem({
    n: 21,
    type: 'noticia',
    title: 'Aviso de la cabina',
    imageUrl: '/flyers/hardcore-massive.jpg',
    hp: 12,
    hpLastUpdatedAt: daysAgo(1),
  }),
  makeItem({
    n: 22,
    type: 'review',
    title: 'Reseña: Frontón en Llamas',
    imageUrl: '/flyers/phorm.jpg',
    hp: 27,
    hpLastUpdatedAt: daysAgo(1),
  }),
  makeItem({
    n: 23,
    type: 'editorial',
    title: 'Guías, no porteros',
    editorial: true,
    imageUrl: '/flyers/jungle-mania.jpg',
    hp: 61,
    hpLastUpdatedAt: daysAgo(0),
  }),
  // 2 harvested — broken-seal state in CULTIVAR / the garden.
  makeItem({
    n: 24,
    type: 'mix',
    title: 'Transmisión 000 (cosechada)',
    imageUrl: '/flyers/deathrow-techno.jpg',
    hp: 6,
    hpLastUpdatedAt: daysAgo(2),
    harvestedAt: daysAgo(8),
    harvestedAmount: 18,
    hpDecayMultiplier: 1.7,
  }),
  makeItem({
    n: 25,
    type: 'articulo',
    title: 'Archivo del ruido (cosechado)',
    imageUrl: '/flyers/void.jpg',
    hp: 3,
    hpLastUpdatedAt: daysAgo(3),
    harvestedAt: daysAgo(15),
    harvestedAmount: 22,
    hpDecayMultiplier: 1.7,
  }),
]

const DRAFTS_RICH: DraftItem[] = [
  makeDraft(makeItem({ n: 30, type: 'mix', title: 'Transmisión 002 (borrador)' }), 0),
  makeDraft(makeItem({ n: 31, type: 'editorial', title: 'Contra el algoritmo' }), 1),
  makeDraft(makeItem({ n: 32, type: 'evento', title: 'Fiesta sin nombre aún' }), 4),
]

function activityRows(): ActivityRow[] {
  const target = PUBLISHED_RICH[0]
  return [
    {
      key: 'lab-fx-act-1',
      kind: 'comment_on_item',
      source: 'COMENTARIO',
      actorId: ACTOR_A,
      targetTitle: target.title,
      excerpt: 'Este set me llevó directo al after…',
      itemSlug: target.slug,
      commentId: 'lab-fx-c1',
      createdAt: daysAgo(0.05),
    },
    {
      key: 'lab-fx-act-2',
      kind: 'reply_to_comment',
      source: 'COMENTARIO',
      actorId: ACTOR_B,
      targetTitle: PUBLISHED_RICH[3].title,
      excerpt: 'Totalmente de acuerdo con lo del gatekeeping.',
      itemSlug: PUBLISHED_RICH[3].slug,
      commentId: 'lab-fx-c2',
      createdAt: daysAgo(0.3),
    },
    {
      key: 'lab-fx-act-3',
      kind: 'reaction',
      source: 'REACCION',
      actorId: ACTOR_A,
      targetTitle: PUBLISHED_RICH[3].title,
      itemSlug: PUBLISHED_RICH[3].slug,
      commentId: 'lab-fx-c3',
      count: 3,
      createdAt: daysAgo(0.8),
    },
    {
      key: 'lab-fx-act-4',
      kind: 'foro_reply',
      source: 'FORO',
      actorId: ACTOR_B,
      targetTitle: '¿Dónde quedó el dub en CDMX?',
      excerpt: 'Hay una bocina escondida en la Obrera…',
      threadId: 'lab-fx-t1',
      createdAt: daysAgo(1.2),
    },
    {
      key: 'lab-fx-act-5',
      kind: 'foro_quote',
      source: 'FORO',
      actorId: ACTOR_A,
      targetTitle: '¿Dónde quedó el dub en CDMX?',
      excerpt: 'Citando tu mapa mental del sonido…',
      threadId: 'lab-fx-t1',
      createdAt: daysAgo(2),
    },
    {
      key: 'lab-fx-act-6',
      kind: 'logro',
      source: 'LOGRO',
      actorId: null,
      targetTitle: 'Voz publicada',
      trophyKey: 'published_voice',
      createdAt: daysAgo(3),
    },
    {
      key: 'lab-fx-act-7',
      kind: 'comment_on_item',
      source: 'COMENTARIO',
      actorId: ACTOR_B,
      targetTitle: PUBLISHED_RICH[2].title,
      excerpt: '¿Estuviste en la del sábado?',
      itemSlug: PUBLISHED_RICH[2].slug,
      commentId: 'lab-fx-c4',
      createdAt: daysAgo(4),
    },
    {
      key: 'lab-fx-act-8',
      kind: 'reaction',
      source: 'REACCION',
      actorId: ACTOR_B,
      targetTitle: PUBLISHED_RICH[2].title,
      itemSlug: PUBLISHED_RICH[2].slug,
      commentId: 'lab-fx-c5',
      count: 1,
      createdAt: daysAgo(5),
    },
    {
      key: 'lab-fx-act-9',
      kind: 'logro',
      source: 'LOGRO',
      actorId: null,
      targetTitle: 'Presencia registrada',
      trophyKey: 'presence_logged',
      createdAt: daysAgo(9),
    },
  ]
}

const NOVEDADES_RICH: ContentItem[] = [
  makeItem({
    n: 40,
    type: 'mix',
    title: 'Japan Sessions Vol. 4',
    partnerId: PARTNER_JAPAN,
    genres: ['techno'],
  }),
  makeItem({
    n: 41,
    type: 'noticia',
    title: 'FASCINOMA anuncia temporada',
    partnerId: PARTNER_FASCINOMA,
  }),
  makeItem({ n: 42, type: 'review', title: 'Reseña sin partner', genres: ['house'] }),
  makeItem({
    n: 43,
    type: 'evento',
    title: 'Proyección + DJ set en YuYu',
    partnerId: PARTNER_YUYU,
    date: daysAhead(5),
    venue: 'Yu Yu',
  }),
  makeItem({ n: 44, type: 'editorial', title: 'Editorial fuera de tus seguidos' }),
  makeItem({ n: 45, type: 'mix', title: 'Techno de válvulas', genres: ['techno'] }),
]

const VIBE_SELF_RICH: VibeSelfCheck[] = [3, 4, 5, 6, 5, 7, 4].map((min, i) => ({
  itemId: `lab-fx-vc-${i}`,
  vibeMin: min,
  vibeMax: Math.min(10, min + 2),
  createdAt: daysAgo(20 - i * 2),
  updatedAt: daysAgo(20 - i * 2),
}))

const ENGAGEMENT_RICH: EngagementSlice = { hp: 34, lastUpdatedAt: daysAgo(0.1) }
const ENGAGEMENT_ZERO: EngagementSlice = { hp: 0, lastUpdatedAt: null }

// ── Partner scenario blocks ─────────────────────────────────────────────────

const LISTINGS: MarketplaceListing[] = [
  {
    id: 'lab-fx-listing-1',
    title: 'Giegling - 30 (vinilo)',
    category: 'vinyl',
    price: 850,
    condition: 'NM',
    images: [],
    status: 'available',
    description: 'Prensado original, una sola puesta.',
    publishedAt: daysAgo(12),
    views: 0,
  },
  {
    id: 'lab-fx-listing-2',
    title: 'Cassette serie cabina 01',
    category: 'cassette',
    price: 220,
    condition: 'VG+',
    images: [],
    status: 'available',
    publishedAt: daysAgo(9),
    views: 0,
  },
  {
    id: 'lab-fx-listing-3',
    title: 'Lote flyers 1998-2003',
    category: 'vinyl',
    price: 400,
    condition: 'VG+',
    images: [],
    status: 'reserved',
    publishedAt: daysAgo(30),
    views: 0,
  },
  {
    id: 'lab-fx-listing-4',
    title: 'Mixer rotatorio (usado)',
    category: 'vinyl',
    price: 6200,
    condition: 'VG+',
    images: [],
    status: 'sold',
    publishedAt: daysAgo(45),
    views: 0,
  },
]

const PARTNER_SLICE: PartnerSlice = {
  id: PARTNER_JAPAN,
  slug: 'lab-fx-club-japan',
  title: 'Club Japan',
  partnerKind: 'venue',
  partnerUrl: 'https://instagram.com/japan_cdmx',
  imageUrl: '',
  marketplaceEnabled: true,
  marketplaceDescription: 'Discos y objetos de la cabina.',
  marketplaceLocation: 'Roma Norte, CDMX',
  marketplaceCurrency: 'MXN',
  listings: LISTINGS,
  // 2 OFERTAS — the acid-dot badges + the ACTIVIDAD fold-in below.
  unansweredListingIds: ['lab-fx-listing-1', 'lab-fx-listing-2'],
}

const OFERTA_ROWS: ActivityRow[] = [
  {
    key: 'lab-fx-oferta-1',
    kind: 'oferta',
    source: 'OFERTA',
    actorId: ACTOR_A,
    targetTitle: 'Giegling - 30 (vinilo)',
    listingId: 'lab-fx-listing-1',
    createdAt: daysAgo(0.2),
  },
  {
    key: 'lab-fx-oferta-2',
    kind: 'oferta',
    source: 'OFERTA',
    actorId: ACTOR_B,
    targetTitle: 'Cassette serie cabina 01',
    listingId: 'lab-fx-listing-2',
    createdAt: daysAgo(1.5),
  },
]

// ── Scenarios (BUILD_PLAN WP2: fresh / rich / partner / admin / smallN / error)

export type LabScenarioKey = 'fresh' | 'rich' | 'partner' | 'admin' | 'smallN' | 'error'

export interface LabScenario {
  key: LabScenarioKey
  label: string
  note: string
  slices: DashboardInitialSlices
  // Lab-boundary user for the shell's userOverride door (IdentitySpine /
  // DashMasthead) — the lab is anonymous, production never uses this.
  user: User
}

const LAB_USER_BASE: User = {
  id: '00000000-0000-4000-8000-0000000000a1',
  username: 'iker',
  displayName: 'Iker',
  role: 'guide',
  joinedAt: daysAgo(180),
  firma: 'la señal antes que el ruido',
  location: 'CDMX',
}

export const LAB_SCENARIOS: Record<LabScenarioKey, LabScenario> = {
  fresh: {
    key: 'fresh',
    label: 'FRESH',
    note: 'Cuenta recién nacida: 0 en todo. Cada widget debe verse dirigido, no roto.',
    slices: {
      engagement: ENGAGEMENT_ZERO,
    },
    user: LAB_USER_BASE,
  },
  rich: {
    key: 'rich',
    label: 'RICH',
    note: '12 guardados, 6 publicados (2 cosechados), 9 filas de actividad, 3 borradores. El estado «tocando» se maneja con el reproductor global real sobre los mixes guardados.',
    slices: {
      saves: SAVES_RICH,
      published: PUBLISHED_RICH,
      drafts: DRAFTS_RICH,
      activity: activityRows(),
      novedades: NOVEDADES_RICH,
      partnerOptions: PARTNER_OPTIONS,
      events: EVENTS_RICH,
      vibeSelf: VIBE_SELF_RICH,
      engagement: ENGAGEMENT_RICH,
      trophies: ['published_voice', 'presence_logged', 'presence_deep'],
      follows: [
        { kind: 'partner', key: PARTNER_JAPAN },
        { kind: 'genre', key: 'techno' },
      ],
    },
    user: LAB_USER_BASE,
  },
  partner: {
    key: 'partner',
    label: 'PARTNER',
    note: 'Equipo de partner: 4 artículos en el marketplace, 2 OFERTAS sin responder plegadas en ACTIVIDAD.',
    slices: {
      saves: SAVES_RICH.slice(0, 4),
      published: PUBLISHED_RICH.slice(0, 2),
      activity: [...OFERTA_ROWS, ...activityRows().slice(0, 3)],
      novedades: NOVEDADES_RICH,
      partnerOptions: PARTNER_OPTIONS,
      events: EVENTS_RICH,
      engagement: ENGAGEMENT_RICH,
      partner: PARTNER_SLICE,
      follows: [{ kind: 'partner', key: PARTNER_FASCINOMA }],
      // registry omitted on purpose: partner slice present → 'mercado' admitted
    },
    user: { ...LAB_USER_BASE, id: '00000000-0000-4000-8000-0000000000a2', partnerId: 'pa-club-japan', partnerAdmin: true },
  },
  admin: {
    key: 'admin',
    label: 'ADMIN',
    note: 'Variante admin: MERCADO en el registro sin partner propio (APROBACIONES es dato del route admin, fuera del contrato del provider — WP9).',
    slices: {
      saves: SAVES_RICH.slice(0, 2),
      published: PUBLISHED_RICH.slice(0, 3),
      drafts: DRAFTS_RICH.slice(0, 1),
      activity: activityRows().slice(0, 5),
      partnerOptions: PARTNER_OPTIONS,
      events: EVENTS_RICH,
      engagement: ENGAGEMENT_RICH,
      registry: [
        'cultivar',
        'actividad',
        'guardados',
        'reproductor',
        'novedades',
        'agenda',
        'mapa',
        'perfil',
        'mercado',
      ],
    },
    user: { ...LAB_USER_BASE, id: '00000000-0000-4000-8000-0000000000a3', role: 'admin' },
  },
  smallN: {
    key: 'smallN',
    label: 'SMALL-N',
    note: 'Realidad de prod: 2 filas de actividad, 1 evento sin venue (→ SIN UBICACIÓN), 2 checks de vibe (bajo el umbral de 5).',
    slices: {
      saves: SAVES_RICH.slice(0, 2),
      published: PUBLISHED_RICH.slice(0, 1),
      activity: activityRows().slice(0, 2),
      novedades: NOVEDADES_RICH.slice(0, 2),
      partnerOptions: PARTNER_OPTIONS,
      events: [
        makeItem({
          n: 50,
          type: 'evento',
          title: '25 años Jungle Empire',
          venue: '',
          venueCity: 'CDMX',
          date: daysAhead(1),
          vibeMin: 6,
          vibeMax: 9,
        }),
      ],
      vibeSelf: VIBE_SELF_RICH.slice(0, 2),
      engagement: { hp: 4, lastUpdatedAt: daysAgo(2) },
      trophies: ['presence_logged'],
      follows: [{ kind: 'partner', key: PARTNER_JAPAN }],
    },
    user: LAB_USER_BASE,
  },
  error: {
    key: 'error',
    label: 'ERROR',
    note: 'Slices caídos: los widgets muestran error honesto, nunca datos inventados; lastTickAt en null (el colofón no miente).',
    slices: {
      saves: SAVES_RICH.slice(0, 3),
      published: PUBLISHED_RICH.slice(0, 2),
      errors: {
        engagement: true,
        activity: true,
        novedades: true,
        events: true,
        vibeSelf: true,
        partner: true,
      },
      lastTickAt: null,
    },
    user: LAB_USER_BASE,
  },
}

export const LAB_SCENARIO_KEYS: readonly LabScenarioKey[] = [
  'fresh',
  'rich',
  'partner',
  'admin',
  'smallN',
  'error',
]
