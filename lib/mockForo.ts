import type { ForoReply, ForoThread } from './types'

// ── Foro seed data ──────────────────────────────────────────────────────────
//
// Mock threads + replies for the imageboard catalog. Mirrors the [[mockComments]]
// idiom — fixed seed, layered under a sessionStorage shadow store ([[foro]]).
//
// Bump order is bumpedAt desc. Replies push their parent thread's bumpedAt
// forward; threads with no replies stay at createdAt. Catalog caps at 30
// visible threads (the page truncates the sorted list).

export const MOCK_THREADS: ForoThread[] = [
  {
    id: 'fr-001',
    authorId: 'u-og-loma',
    subject: '¿qué se siente realmente el "after" en CDMX?',
    body: 'pregunta para los que llegan al amanecer. ¿el after es parte del rave o ya es otra cosa? últimamente siento que cada lineup deja sin energía la primera mitad y todo se concentra en el cierre. ¿se está perdiendo el flujo?',
    imageUrl: '/flyers/orbital-omen.jpg',
    genres: ['peak-techno', 'hard-techno', 'dark-techno', 'techno-raw'],
    createdAt: '2026-04-22T03:14:00',
    bumpedAt: '2026-04-25T18:42:00',
  },
  {
    id: 'fr-002',
    authorId: 'u-insider-tlali',
    subject: 'recomienden vinilo mexicano de los 90s',
    body: 'estoy armando un set de raíces locales y siento que se me escapan piezas. más allá de Murcof y Nortec — específicamente prensados mexicanos de 92 a 99. drop names, drop labels.',
    imageUrl: '/flyers/pulse-1990.jpg',
    genres: ['electronica', 'latin-electronic', 'idm', 'house'],
    createdAt: '2026-04-19T22:01:00',
    bumpedAt: '2026-04-25T11:08:00',
  },
  {
    id: 'fr-003',
    authorId: 'u-normal-meri',
    subject: 'primera vez en Club Japan — qué esperar',
    body: 'voy el sábado. nunca he estado. ¿la barra es razonable? ¿la pista se llena temprano o tarde? cualquier nota de supervivencia se agradece.',
    imageUrl: '/flyers/eclipse.jpg',
    genres: ['tech-house', 'techno-raw', 'peak-techno'],
    createdAt: '2026-04-24T14:30:00',
    bumpedAt: '2026-04-26T02:15:00',
  },
  {
    id: 'fr-004',
    authorId: 'u-normal-yag',
    subject: 'el sonido del jungle 92 se está reanimando, pero ¿con quién?',
    body: 'escucho sets recientes y me suenan a 1992 pero pasados por filtros modernos. no sé si es nostalgia o si realmente hay un retorno. ¿quiénes están cargando esa antorcha en latinoamérica?',
    imageUrl: '/flyers/jungle-mania.jpg',
    genres: ['jungle', 'drum-and-bass', 'breaks', 'uk-bass'],
    createdAt: '2026-04-15T19:00:00',
    bumpedAt: '2026-04-23T09:22:00',
  },
  {
    id: 'fr-005',
    authorId: 'u-mod-rumor',
    subject: 'recordatorio · normas básicas del foro',
    body: 'sin imagen no hay hilo. sin login no hay post. el orden lo determina el bump y la fecha — no hay likes, no hay favoritos. respeten al de al lado y usen >>id para citar respuestas. eso es todo.',
    imageUrl: '/flyers/man-or-machine.jpg',
    genres: ['electronica'],
    createdAt: '2026-04-01T00:00:00',
    bumpedAt: '2026-04-20T16:00:00',
  },
  {
    id: 'fr-006',
    authorId: 'u-hzamorate',
    subject: 'taller de modular en Roma Norte — interés general',
    body: 'sondeando interés. estamos pensando en un taller de fin de semana, nivel principiante a intermedio, con módulos prestados. comenten si caerían y qué les gustaría aprender.',
    imageUrl: '/flyers/phorm.jpg',
    genres: ['idm', 'ambient-techno', 'electronica', 'techno-raw'],
    createdAt: '2026-04-18T11:45:00',
    bumpedAt: '2026-04-22T20:30:00',
  },
  {
    id: 'fr-007',
    authorId: 'u-ikerio',
    subject: 'tracklist del último mix de gradiente — ¿alguien identificó el track 7?',
    body: 'tengo Shazam roto y ese track me persigue. arranca a los 42:18, breakbeat con sintes ácidos arriba. cualquier pista se agradece.',
    imageUrl: '/flyers/darkside.jpg',
    genres: ['breaks', 'drum-and-bass', 'idm'],
    createdAt: '2026-04-21T15:20:00',
    bumpedAt: '2026-04-24T13:00:00',
  },
  {
    id: 'fr-008',
    authorId: 'u-og-loma',
    subject: 'la barra de Bahidorá fue el verdadero peak',
    body: 'controvertido pero lo sostengo. los lineups quedaron bien pero la conversación que se armó frente a la barra del río el domingo por la mañana fue el momento del festival. ¿alguien más?',
    imageUrl: '/flyers/back-in-the-jungle.jpg',
    genres: ['organic-house', 'downtempo', 'house', 'dub'],
    createdAt: '2026-04-10T08:00:00',
    bumpedAt: '2026-04-19T07:45:00',
  },
]

export const MOCK_REPLIES: ForoReply[] = [
  // fr-001 — after CDMX (3 replies)
  {
    id: 'fp-001-01',
    threadId: 'fr-001',
    authorId: 'u-insider-tlali',
    body: 'el after dejó de ser parte del rave hace unos años. ahora es su propio circuito, con sus propios DJs locales que casi no aparecen en el cartel principal. eso no es necesariamente malo.',
    createdAt: '2026-04-22T05:30:00',
  },
  {
    id: 'fp-001-02',
    threadId: 'fr-001',
    authorId: 'u-normal-yag',
    body: '>>fp-001-01 esto. el after es una escena paralela. el problema es cuando los promotores grandes intentan absorberlo y rompen lo que lo hacía funcionar.',
    createdAt: '2026-04-23T12:10:00',
    quotedReplyIds: ['fp-001-01'],
  },
  {
    id: 'fp-001-03',
    threadId: 'fr-001',
    authorId: 'u-mod-rumor',
    body: 'la energía no se está perdiendo, se está redistribuyendo. los sets de cierre concentran gente porque el resto del lineup se volvió predecible. los headliners ya no toman riesgos.',
    createdAt: '2026-04-25T18:42:00',
  },

  // fr-002 — vinilo mexicano (2 replies)
  {
    id: 'fp-002-01',
    threadId: 'fr-002',
    authorId: 'u-og-loma',
    body: 'busca el sello Opción Sónica de mediados de los 90. también prensados de Static Discos antes de que se mudara la operación. y cualquier cosa de Silverio temprano si te interesa lo más raro.',
    imageUrl: '/flyers/eternal-hell.jpg',
    createdAt: '2026-04-20T14:00:00',
  },
  {
    id: 'fp-002-02',
    threadId: 'fr-002',
    authorId: 'u-ikerio',
    body: '>>fp-002-01 +1 a Opción Sónica. agrega Konfort y los EPs de Aurora Bonus de 1997. también vale la pena rastrear maxi-singles de Antiguos Astronautas si los encuentras.',
    createdAt: '2026-04-25T11:08:00',
    quotedReplyIds: ['fp-002-01'],
  },

  // fr-003 — Club Japan primera vez (4 replies)
  {
    id: 'fp-003-01',
    threadId: 'fr-003',
    authorId: 'u-hzamorate',
    body: 'la pista se llena después de las 2am. antes hay espacio para moverse. la barra es razonable pero acepta efectivo más rápido que tarjeta.',
    createdAt: '2026-04-24T20:15:00',
  },
  {
    id: 'fp-003-02',
    threadId: 'fr-003',
    authorId: 'u-og-loma',
    body: 'ponte zapatos cómodos. el sistema de sonido pide que te quedes hasta el cierre.',
    createdAt: '2026-04-25T09:30:00',
  },
  {
    id: 'fp-003-03',
    threadId: 'fr-003',
    authorId: 'u-normal-meri',
    body: '>>fp-003-01 >>fp-003-02 gracias. ¿algo que evitar o consejo de seguridad?',
    createdAt: '2026-04-25T19:00:00',
    quotedReplyIds: ['fp-003-01', 'fp-003-02'],
  },
  {
    id: 'fp-003-04',
    threadId: 'fr-003',
    authorId: 'u-insider-tlali',
    body: '>>fp-003-03 sal en grupo, mantén tu bebida vigilada y el regreso en taxi de app. la zona está bien pero las 5am son las 5am.',
    createdAt: '2026-04-26T02:15:00',
    quotedReplyIds: ['fp-003-03'],
  },

  // fr-004 — jungle 92 (1 reply)
  {
    id: 'fp-004-01',
    threadId: 'fr-004',
    authorId: 'u-insider-tlali',
    body: 'no es nostalgia. hay una nueva camada de productores en BR y MX que están sampleando los breaks originales y haciendo cosas nuevas. busca a los crews de São Paulo más jóvenes.',
    imageUrl: '/flyers/hardcore-massive.jpg',
    createdAt: '2026-04-23T09:22:00',
  },

  // fr-005 — normas (1 reply)
  {
    id: 'fp-005-01',
    threadId: 'fr-005',
    authorId: 'u-datavismo',
    body: 'fijado. respeten las normas, este foro es para conversación real.',
    createdAt: '2026-04-20T16:00:00',
  },

  // fr-006 — taller modular (2 replies)
  {
    id: 'fp-006-01',
    threadId: 'fr-006',
    authorId: 'u-normal-yag',
    body: 'caigo. me interesa secuenciación generativa más que sound design.',
    createdAt: '2026-04-21T22:00:00',
  },
  {
    id: 'fp-006-02',
    threadId: 'fr-006',
    authorId: 'u-normal-meri',
    body: 'también caigo. soy total principiante, ¿hay límite de cupo?',
    createdAt: '2026-04-22T20:30:00',
  },

  // fr-007 — track 7 (2 replies)
  {
    id: 'fp-007-01',
    threadId: 'fr-007',
    authorId: 'u-og-loma',
    body: 'suena a algo de Plus 8 de los 90s pero no me atrevo a apostar. ¿puedes subir un fragmento?',
    createdAt: '2026-04-22T11:00:00',
  },
  {
    id: 'fp-007-02',
    threadId: 'fr-007',
    authorId: 'u-ikerio',
    body: '>>fp-007-01 lo subiré cuando llegue a casa. agradezco la corazonada de Plus 8, voy a revisar los catálogos.',
    createdAt: '2026-04-24T13:00:00',
    quotedReplyIds: ['fp-007-01'],
  },

  // fr-008 — barra de Bahidorá (1 reply)
  {
    id: 'fp-008-01',
    threadId: 'fr-008',
    authorId: 'u-hzamorate',
    body: 'concuerdo. la conversación informal en festivales suele ser donde se cocinan los proyectos del año siguiente.',
    createdAt: '2026-04-19T07:45:00',
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────

export function getReplyCount(threadId: string, replies: ForoReply[]): number {
  return replies.filter((r) => r.threadId === threadId).length
}

export function getRepliesForThread(
  threadId: string,
  replies: ForoReply[],
): ForoReply[] {
  return replies
    .filter((r) => r.threadId === threadId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}
