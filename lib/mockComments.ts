import type { Comment, Reaction, ReactionKind } from './types'

// ── Mock comment seed ───────────────────────────────────────────────────────
//
// Visual-prototype discussion data threaded across a handful of real
// ContentItem ids (see lib/mockData.ts). Designed to exercise:
//   - flat top-level comments + nested replies
//   - thread depth ≥ 5 (depth-cap linearization will activate at 4)
//   - controversy hot-spots (high resonates AND high disagree)
//   - moderator-deleted tombstone with preserved replies
//   - edited comments
//   - the full ASCII reaction palette
//
// When the real backend (see [[Supabase Migration]]) lands, swap this file
// for a Supabase `comments` query — consumers use `getCommentsForItem` and
// won't change.

function r(userId: string, kind: ReactionKind, createdAt: string): Reaction {
  return { userId, kind, createdAt }
}

export const MOCK_COMMENTS: Comment[] = [
  // ── ar-001 — articulo (heavy discussion + controversy + tombstone) ──
  {
    id: 'cm-001',
    contentItemId: 'ar-001',
    parentId: null,
    authorId: 'u-datavismo',
    body: 'Lo que me interesa de este texto es cómo trata la repetición no como recurso sino como tesis. La pista no avanza, te avanza a ti.',
    createdAt: '2026-04-22T14:12:00',
    reactions: [
      r('u-hzamorate', 'resonates', '2026-04-22T14:30:00'),
      r('u-og-loma', 'resonates', '2026-04-22T15:01:00'),
      r('u-insider-tlali', 'signal', '2026-04-22T16:48:00'),
    ],
  },
  {
    id: 'cm-002',
    contentItemId: 'ar-001',
    parentId: 'cm-001',
    authorId: 'u-hzamorate',
    body: 'Exacto. Y por eso el formato largo aguanta — un loop de 90s no se sostiene en un tweet.',
    createdAt: '2026-04-22T15:24:00',
    reactions: [
      r('u-datavismo', 'resonates', '2026-04-22T15:40:00'),
      r('u-og-loma', 'resonates', '2026-04-22T16:02:00'),
    ],
  },
  {
    id: 'cm-003',
    contentItemId: 'ar-001',
    parentId: 'cm-002',
    authorId: 'u-og-loma',
    body: 'Hay un ensayo de Kodwo Eshun que dice algo parecido sobre la repetición como "futuro detenido". Si alguien lo encuentra que lo postee.',
    createdAt: '2026-04-22T17:11:00',
    reactions: [r('u-insider-tlali', 'signal', '2026-04-22T18:05:00')],
  },
  {
    id: 'cm-004',
    contentItemId: 'ar-001',
    parentId: 'cm-003',
    authorId: 'u-normal-meri',
    body: '"More Brilliant Than the Sun" — capítulo 3 si no me equivoco.',
    createdAt: '2026-04-22T18:42:00',
    reactions: [r('u-og-loma', 'resonates', '2026-04-22T19:00:00')],
  },
  {
    id: 'cm-005',
    contentItemId: 'ar-001',
    parentId: 'cm-004',
    authorId: 'u-insider-tlali',
    body: 'Ese exacto. Hay PDF rondando, no lo voy a postear acá pero pista: archive.org.',
    createdAt: '2026-04-22T19:15:00',
    reactions: [],
  },

  // controversy hot-spot — high resonates + high disagree, both count
  {
    id: 'cm-006',
    contentItemId: 'ar-001',
    parentId: null,
    authorId: 'u-og-loma',
    body: 'No coincido con la tesis central. Reducir el dub techno a "repetición meditativa" es perder de vista que es música de baile, no una sesión de yoga.',
    createdAt: '2026-04-23T09:33:00',
    reactions: [
      r('u-hzamorate', 'resonates', '2026-04-23T09:58:00'),
      r('u-normal-yag', 'resonates', '2026-04-23T10:14:00'),
      r('u-datavismo', 'disagree', '2026-04-23T10:22:00'),
      r('u-insider-tlali', 'disagree', '2026-04-23T11:01:00'),
      r('u-normal-meri', 'provocative', '2026-04-23T11:48:00'),
    ],
  },
  {
    id: 'cm-007',
    contentItemId: 'ar-001',
    parentId: 'cm-006',
    authorId: 'u-normal-yag',
    body: 'Esto. Lo único que pediría es que se lea en pista de baile, no en escritorio.',
    createdAt: '2026-04-23T10:18:00',
    reactions: [
      r('u-og-loma', 'resonates', '2026-04-23T10:32:00'),
      r('u-insider-tlali', 'disagree', '2026-04-23T11:04:00'),
      r('u-datavismo', 'disagree', '2026-04-23T11:25:00'),
    ],
  },
  {
    id: 'cm-008',
    contentItemId: 'ar-001',
    parentId: 'cm-006',
    authorId: 'u-insider-tlali',
    body: 'Es ambas cosas. La música de baile más interesante de los últimos 30 años justamente disuelve esa frontera. Basic Channel, Chain Reaction, todo el catálogo de Echocord — son discos para bailar Y para escuchar dormido.',
    createdAt: '2026-04-23T11:09:00',
    reactions: [
      r('u-datavismo', 'resonates', '2026-04-23T11:30:00'),
      r('u-hzamorate', 'resonates', '2026-04-23T12:01:00'),
      r('u-og-loma', 'provocative', '2026-04-23T12:45:00'),
    ],
  },

  // moderator-deleted tombstone with preserved reply
  {
    id: 'cm-009',
    contentItemId: 'ar-001',
    parentId: null,
    authorId: 'u-normal-meri',
    body: '[contenido eliminado]',
    createdAt: '2026-04-23T13:22:00',
    reactions: [],
    deletion: {
      moderatorId: 'u-mod-rumor',
      reason: 'spam · enlace a venta no relacionada',
      deletedAt: '2026-04-23T13:48:00',
    },
  },
  {
    id: 'cm-010',
    contentItemId: 'ar-001',
    parentId: 'cm-009',
    authorId: 'u-normal-yag',
    body: 'No abran ese link, ya lo reporté.',
    createdAt: '2026-04-23T13:35:00',
    reactions: [r('u-mod-rumor', 'signal', '2026-04-23T13:49:00')],
  },

  // edited comment
  {
    id: 'cm-011',
    contentItemId: 'ar-001',
    parentId: null,
    authorId: 'u-normal-meri',
    body: 'Lo leí dos veces y la segunda funcionó mejor. La primera me perdí en la mitad.',
    createdAt: '2026-04-24T08:14:00',
    editedAt: '2026-04-24T08:22:00',
    reactions: [r('u-hzamorate', 'resonates', '2026-04-24T08:45:00')],
  },

  // ── ed-001 — editorial ─────────────────────────────────────────────
  {
    id: 'cm-012',
    contentItemId: 'ed-001',
    parentId: null,
    authorId: 'u-hzamorate',
    body: 'Esta editorial me parece la posición más clara que han tomado hasta ahora. Bien.',
    createdAt: '2026-04-20T11:00:00',
    reactions: [
      r('u-datavismo', 'resonates', '2026-04-20T11:15:00'),
      r('u-og-loma', 'signal', '2026-04-20T12:30:00'),
    ],
  },
  {
    id: 'cm-013',
    contentItemId: 'ed-001',
    parentId: 'cm-012',
    authorId: 'u-og-loma',
    body: 'De acuerdo, aunque me gustaría ver cómo sostienen esta postura cuando empiecen a entrar marcas.',
    createdAt: '2026-04-20T13:42:00',
    reactions: [
      r('u-hzamorate', 'provocative', '2026-04-20T14:01:00'),
      r('u-insider-tlali', 'resonates', '2026-04-20T14:18:00'),
    ],
  },
  {
    id: 'cm-014',
    contentItemId: 'ed-001',
    parentId: null,
    authorId: 'u-insider-tlali',
    body: 'Es bonito leer algo que no intenta venderme nada. Gracias.',
    createdAt: '2026-04-20T16:08:00',
    reactions: [
      r('u-datavismo', 'resonates', '2026-04-20T16:30:00'),
      r('u-hzamorate', 'resonates', '2026-04-20T17:00:00'),
    ],
  },
  {
    id: 'cm-015',
    contentItemId: 'ed-001',
    parentId: null,
    authorId: 'u-normal-meri',
    body: 'Tengo dudas. ¿Cómo se concilia "no hay algoritmo" con que igual hay que decidir qué se sube al feed?',
    createdAt: '2026-04-21T10:15:00',
    editedAt: '2026-04-21T10:18:00',
    reactions: [
      r('u-og-loma', 'provocative', '2026-04-21T10:42:00'),
      r('u-normal-yag', 'resonates', '2026-04-21T11:05:00'),
    ],
  },
  {
    id: 'cm-016',
    contentItemId: 'ed-001',
    parentId: 'cm-015',
    authorId: 'u-datavismo',
    body: 'Decisión editorial sí, ranking automatizado no. La diferencia es quién carga la responsabilidad.',
    createdAt: '2026-04-21T11:22:00',
    reactions: [
      r('u-hzamorate', 'resonates', '2026-04-21T11:40:00'),
      r('u-insider-tlali', 'signal', '2026-04-21T12:18:00'),
      r('u-normal-meri', 'resonates', '2026-04-21T13:02:00'),
    ],
  },

  // ── mx-001 — mix (lighter discussion, more reactions per comment) ──
  {
    id: 'cm-017',
    contentItemId: 'mx-001',
    parentId: null,
    authorId: 'u-og-loma',
    body: 'Set obligatorio. La transición del minuto 38 al 41 es brutal.',
    createdAt: '2026-04-19T22:14:00',
    reactions: [
      r('u-hzamorate', 'resonates', '2026-04-19T22:30:00'),
      r('u-datavismo', 'resonates', '2026-04-19T23:01:00'),
      r('u-insider-tlali', 'signal', '2026-04-20T00:18:00'),
      r('u-normal-meri', 'resonates', '2026-04-20T08:45:00'),
      r('u-normal-yag', 'resonates', '2026-04-20T09:12:00'),
    ],
  },
  {
    id: 'cm-018',
    contentItemId: 'mx-001',
    parentId: null,
    authorId: 'u-normal-yag',
    body: 'Track ID del minuto 27? Suena a algo de Livity Sound pero no lo ubico.',
    createdAt: '2026-04-20T10:42:00',
    reactions: [r('u-normal-meri', 'signal', '2026-04-20T11:00:00')],
  },
  {
    id: 'cm-019',
    contentItemId: 'mx-001',
    parentId: 'cm-018',
    authorId: 'u-datavismo',
    body: 'Es Batu — "False Memories", remix de Pessimist. Buen oído.',
    createdAt: '2026-04-20T11:15:00',
    reactions: [
      r('u-normal-yag', 'resonates', '2026-04-20T11:20:00'),
      r('u-og-loma', 'signal', '2026-04-20T12:08:00'),
      r('u-hzamorate', 'resonates', '2026-04-20T12:30:00'),
    ],
  },
  {
    id: 'cm-020',
    contentItemId: 'mx-001',
    parentId: null,
    authorId: 'u-insider-tlali',
    body: 'Excelente curaduría de tracks que no son obvios. Gracias por no caer en los hits.',
    createdAt: '2026-04-21T19:30:00',
    reactions: [
      r('u-datavismo', 'resonates', '2026-04-21T20:00:00'),
      r('u-og-loma', 'resonates', '2026-04-21T20:45:00'),
    ],
  },

  // ── rv-001 — review (small dissent thread) ─────────────────────────
  {
    id: 'cm-021',
    contentItemId: 'rv-001',
    parentId: null,
    authorId: 'u-normal-meri',
    body: 'La reseña captura exactamente lo que sentí escuchándolo. Coincido en todo.',
    createdAt: '2026-04-18T15:42:00',
    reactions: [r('u-insider-tlali', 'resonates', '2026-04-18T16:00:00')],
  },
  {
    id: 'cm-022',
    contentItemId: 'rv-001',
    parentId: null,
    authorId: 'u-og-loma',
    body: 'No me convence la calificación. El disco tiene momentos que no se sostienen y la reseña los pasa por alto.',
    createdAt: '2026-04-18T18:21:00',
    reactions: [
      r('u-hzamorate', 'provocative', '2026-04-18T19:00:00'),
      r('u-normal-yag', 'resonates', '2026-04-18T19:32:00'),
      r('u-insider-tlali', 'disagree', '2026-04-18T20:08:00'),
    ],
  },
  {
    id: 'cm-023',
    contentItemId: 'rv-001',
    parentId: 'cm-022',
    authorId: 'u-insider-tlali',
    body: 'Cuáles momentos? Curioso, no lo sentí así.',
    createdAt: '2026-04-18T20:14:00',
    reactions: [r('u-og-loma', 'signal', '2026-04-18T20:40:00')],
  },
  {
    id: 'cm-024',
    contentItemId: 'rv-001',
    parentId: 'cm-023',
    authorId: 'u-og-loma',
    body: 'Track 4 y track 7 — ambos pierden tensión a mitad. El resto sí me parece sólido.',
    createdAt: '2026-04-18T21:02:00',
    reactions: [
      r('u-insider-tlali', 'provocative', '2026-04-18T21:30:00'),
      r('u-hzamorate', 'resonates', '2026-04-18T22:00:00'),
    ],
  },
  {
    id: 'cm-025',
    contentItemId: 'rv-001',
    parentId: null,
    authorId: 'u-hzamorate',
    body: 'Reseña justa, ni hype ni demolición. Más de esto.',
    createdAt: '2026-04-19T09:15:00',
    reactions: [
      r('u-datavismo', 'resonates', '2026-04-19T09:30:00'),
      r('u-normal-meri', 'resonates', '2026-04-19T10:00:00'),
    ],
  },
]

// ── Lookups & helpers ──────────────────────────────────────────────────────

export function getCommentsForItem(contentItemId: string): Comment[] {
  return MOCK_COMMENTS.filter((c) => c.contentItemId === contentItemId)
}

export function getCommentById(id: string): Comment | undefined {
  return MOCK_COMMENTS.find((c) => c.id === id)
}

// Engagement = total reaction count, irrespective of kind. No kind subtracts
// from another — disagreement is signal, not suppression.
// See [[No Algorithm]] / "controversy as discussion".
export function engagementScore(comment: Comment): number {
  return comment.reactions.length
}

// Reply count for a single comment within a flat list (one level only).
// Recursive descendant counting is the consumer's job — depends on whether
// they want immediate children or full subtree size.
export function directReplyCount(comment: Comment, all: Comment[]): number {
  return all.filter((c) => c.parentId === comment.id).length
}

// Recursive descendant count — every reply, reply-of-reply, etc. Used for the
// "thread weight" visual signal on collapsed threads.
export function descendantCount(comment: Comment, all: Comment[]): number {
  const direct = all.filter((c) => c.parentId === comment.id)
  return direct.reduce((sum, child) => sum + 1 + descendantCount(child, all), 0)
}
