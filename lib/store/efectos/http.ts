/**
 * How an effect talks to an app/api route.
 *
 *   send()        one JSON request; a refusal throws an EffectError whose
 *                 `userMessage` is Spanish (see `refusal`)
 *   inOrder()     writes to the same row go out one after another, so two
 *                 quick toggles can't reach the server in the wrong order,
 *                 and a write that points at a row still being created waits
 *                 for it
 *   bestEffort()  a secondary write (an HL event after a save) whose failure
 *                 must not undo the gesture
 *   uploadImage() a data: URL (the foro's images, prepared in the browser)
 *                 becomes a stored image (/api/ingest-image → WebP, uploads
 *                 bucket) before the row that shows it is written
 */

import { EffectError } from '../effects'

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface SendOptions {
  /** What the person reads when the server says no without a reason of its own. */
  fallback?: string
  /** Spanish copy for particular refusals (403, 409…), over whatever the route says. */
  messages?: Partial<Record<number, string>>
  /** Survive the page going away (a pagehide autosave). Only small bodies: browsers cap keepalive at 64 KB. */
  keepalive?: boolean
  /** Answers that mean the intent already holds (a delete of something already gone: 404). */
  okStatuses?: number[]
}

/** A refusal from a route, with its status. */
export class HttpError extends EffectError {
  constructor(
    message: string,
    userMessage: string,
    public readonly status: number,
  ) {
    super(message, userMessage)
  }
}

export const NETWORK_MESSAGE = 'No pudimos conectar con el servidor. El cambio se deshizo.'
export const DEFAULT_FALLBACK = 'No se pudo guardar. El cambio se deshizo.'
const KEEPALIVE_MAX = 60_000

/** The house copy per status, when the route didn't say it in Spanish. */
const STATUS_MESSAGE: Partial<Record<number, string>> = {
  401: 'Tu sesión se cerró. Entra de nuevo y vuelve a intentarlo.',
  403: 'No tienes permiso para hacer esto.',
  404: 'Eso ya no está: pudo haberse borrado.',
  409: 'Eso ya existe o cambió mientras tanto. Recarga e intenta de nuevo.',
  413: 'Es demasiado pesado para subirlo.',
  422: 'Falta algo para poder guardarlo.',
  429: 'Demasiados intentos seguidos. Espera un momento.',
  503: 'Esa parte todavía no está disponible.',
}

/**
 * Whether a route's message is already Spanish (the newer routes answer the
 * person directly — «Ya existe un ítem con este id.»; the older ones speak
 * English to developers — «Forbidden», «item not found»).
 */
export function isSpanish(text: string): boolean {
  return (
    /[áéíóúñü¿¡]/i.test(text) ||
    /\b(el|la|los|las|del|que|una?|ya|tu|tus|para|con|sin|solo|puedes|puede|debe|falta|existe|permiso|sesión|código|entrada|encontrad[ao]|autorizad[ao]|todavía|aún|escribe|indica|revisa|hilo|pieza|comentario)\b/i.test(text)
  )
}

/**
 * The sentence the person reads when a route says no: the route's own reason
 * when it gives one in Spanish (it knows exactly why — `message` is where the
 * newer routes put it), else the effect's copy for that status, else the
 * house copy for the status, else the effect's fallback. Pure.
 */
export function refusal(status: number, data: unknown, opts: Pick<SendOptions, 'messages' | 'fallback'> = {}): string {
  const d = (data && typeof data === 'object' ? data : {}) as { message?: unknown; error?: unknown }
  for (const m of [d.message, d.error]) {
    if (typeof m === 'string' && m.trim() && isSpanish(m)) return m.trim()
  }
  return opts.messages?.[status] ?? STATUS_MESSAGE[status] ?? opts.fallback ?? DEFAULT_FALLBACK
}

/** One JSON request to an app/api route; a non-2xx answer throws an EffectError in Spanish. */
export async function send<T = Record<string, unknown>>(method: Method, url: string, body?: unknown, opts: SendOptions = {}): Promise<T> {
  const json = body === undefined ? undefined : JSON.stringify(body)
  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers: json === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: json,
      keepalive: Boolean(opts.keepalive && (json?.length ?? 0) < KEEPALIVE_MAX),
    })
  } catch (err) {
    throw new EffectError(`${method} ${url}: ${err instanceof Error ? err.message : 'sin red'}`, NETWORK_MESSAGE)
  }
  const data: unknown = await res.json().catch(() => ({}))
  if (!res.ok && !opts.okStatuses?.includes(res.status)) throw new HttpError(`${method} ${url} → ${res.status}`, refusal(res.status, data, opts), res.status)
  return data as T
}

const lanes = new Map<string, Promise<unknown>>()

/**
 * Run `task` after every earlier task in its own lane has settled — and
 * after whatever is in flight in the lanes it depends on. A lane is one row:
 * `item:<id>`, `comment:<id>`, `thread:<id>`… So two quick toggles reach the
 * server in the order they were made, and a reply to a comment that is still
 * being created waits for it (its row is the foreign key). A failed task
 * doesn't block the ones behind it; an idle lane costs nothing.
 */
export function inOrder<T>(own: string, task: () => Promise<T>, after: string[] = []): Promise<T> {
  const waits: Promise<unknown>[] = []
  for (const k of [own, ...after]) {
    const lane = lanes.get(k)
    if (lane) waits.push(lane)
  }
  const prev = waits.length ? Promise.all(waits) : Promise.resolve()
  const run = prev.then(task, task)
  const tail = run.then(
    () => undefined,
    () => undefined,
  )
  lanes.set(own, tail)
  void tail.then(() => {
    if (lanes.get(own) === tail) lanes.delete(own)
  })
  return run
}

/** A secondary write whose failure is logged, never shown, never undone. */
export function bestEffort(p: Promise<unknown>, label: string): void {
  p.catch((err: unknown) => {
    if (process.env.NODE_ENV !== 'production') console.warn(`[world] ${label} (sin consecuencias):`, err)
  })
}

/**
 * The item-side HL event production's client emitted after a click, an open,
 * a successful save or comment (main:lib/hpEvents.ts): fire-and-forget,
 * keepalive (a click followed by a navigation still arrives). The route
 * weights it (record_hp_event, novelty-weighted); pg_cron folds it into
 * items.hp within five minutes.
 */
export function hpEvent(itemId: string, kind: 'click' | 'open' | 'save' | 'comment'): void {
  bestEffort(send('POST', '/api/hp-events', { item_id: itemId, kind }, { keepalive: true }), `HL «${kind}»`)
}

/**
 * An image the browser prepared as a data: URL, stored for good: POST
 * /api/ingest-image (multipart) transcodes it to WebP (≤ 1440 px) into the
 * caller's own folder of the uploads bucket and answers its public URL.
 * Anything that isn't a data: URL (a flyer of the house, an uploaded URL)
 * passes through untouched.
 */
export async function uploadImage(src: string, folder: 'foro'): Promise<string> {
  if (!src.startsWith('data:')) return src
  let blob: Blob
  try {
    blob = await (await fetch(src)).blob()
  } catch {
    throw new EffectError('data: URL ilegible', 'No pudimos leer una de las imágenes. Vuelve a elegirla.')
  }
  const form = new FormData()
  const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/gif' ? 'gif' : blob.type === 'image/webp' ? 'webp' : 'jpg'
  form.append('file', new File([blob], `imagen.${ext}`, { type: blob.type || 'image/jpeg' }))
  form.append('folder', folder)
  let res: Response
  try {
    res = await fetch('/api/ingest-image', { method: 'POST', body: form })
  } catch {
    throw new EffectError('POST /api/ingest-image: sin red', NETWORK_MESSAGE)
  }
  const data = (await res.json().catch(() => ({}))) as { url?: unknown }
  if (!res.ok || typeof data.url !== 'string') {
    throw new EffectError(`POST /api/ingest-image → ${res.status}`, refusal(res.status, data, { fallback: 'No pudimos subir la imagen. El cambio se deshizo.', messages: { 400: 'Esa imagen no se pudo procesar. Prueba con JPG, PNG o WEBP.', 422: 'Esa imagen no se pudo procesar. Prueba con JPG, PNG o WEBP.' } }))
  }
  return data.url
}
