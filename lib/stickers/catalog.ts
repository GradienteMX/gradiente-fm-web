/**
 * The sticker catalog, derived from the world (never hand-listed).
 *
 * A DESIGN is one picture; each finish it's printed in is an entry of its
 * own (its own id, price and run), grouped by `design` (finish.ts):
 *   · a franja's mark (die-cut) — vinyl, the open run everyone starts with;
 *     a numbered holo run (ed. 150, the family seeded per franja); a
 *     foil-stamped metal run (ed. 50: oro, plata, cobre or grafito, some
 *     embossed); about half also pour an epoxy dome over the vinyl; a few
 *     run a lenticular (ed. 100) that flips to the franja's livery.
 *   · its typographic sticker (tipo or tape) — paper; plus spot varnish or
 *     raised ink, and for some a blind emboss or a deboss (ed. 120).
 *   · about a third also run a numbered edition seal (holo or glitter).
 *   · every night has one stub or flyer circle, obtained with a ticket; the
 *     finish varies by night (a festival's circle in holo láser, a
 *     letterpress stub, now and then a foil ticket).
 *   · the house gives two to everyone who comes through La Puerta.
 * Prices scale with the finish (the demo never charges). Editions are real
 * runs, counted in acquisition order — never fake scarcity.
 *
 * Plus a deterministic demo history for the seed people: stickers applied
 * over the months since they joined, so the credenciales already look worn,
 * and a handful of special finishes each (several holo families, a metal, a
 * dome, a lenticular) on the case and in the binder.
 */

import type { ContentItem, FranjaKind, User } from '@/lib/types'
import { hash01 } from '@/lib/hash'
import { designOf, finishOf, HOLO_KINDS, METAL_NOMBRE, METALS } from './finish'
import type { HoloKind, Relieve, StickerCopy, StickerDef, StickerPlacement } from './types'

const KIND: Record<FranjaKind, string> = {
  label: 'Sello',
  promoter: 'Promotora',
  venue: 'Venue',
  dealer: 'Dealer',
  colectivo: 'Colectivo',
  festival: 'Festival',
  club: 'Club',
  medios: 'Medio',
  'mix-series': 'Serie de mixes',
  plataforma: 'Plataforma',
}

const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
const two = (n: number) => String(n).padStart(2, '0')

function dayCode(iso: string): string {
  const d = new Date(iso)
  return `${two(d.getDate())}.${two(d.getMonth() + 1)}`
}

function longDate(iso: string): string {
  const d = new Date(iso)
  return `${two(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

function slugCode(slug: string): string {
  return slug
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 4)
    .toUpperCase()
    .padEnd(4, 'X')
}

const pickOf = <T>(arr: readonly T[], h: number): T => arr[Math.min(arr.length - 1, Math.floor(h * arr.length))]

export const CASA_STICKERS = ['st-casa-energia', 'st-casa-registro'] as const

/** What each finish costs once payments exist (MXN). */
const PRECIO = {
  papel: 25,
  papelRelieve: 35,
  papelGofrado: 45,
  vinil: 35,
  domo: 55,
  holo: 65,
  lenticular: 80,
  foil: 90,
  foilGofrado: 100,
  edicion: 60,
} as const

export function buildStickerCatalog(items: ContentItem[]): Record<string, StickerDef> {
  const out: Record<string, StickerDef> = {}
  const add = (d: StickerDef) => {
    out[d.id] = d
  }
  const byId = new Map(items.map((it) => [it.id, it]))

  // Mean energy of what each franja put into the world (its colour of ink).
  const energy = new Map<string, { sum: number; n: number }>()
  for (const it of items) {
    if (!it.franjaId || it.type === 'franja') continue
    const e = energy.get(it.franjaId) ?? { sum: 0, n: 0 }
    e.sum += (it.vibeMin + it.vibeMax) / 2
    e.n++
    energy.set(it.franjaId, e)
  }
  const franjaEnergy = (id: string) => {
    const e = energy.get(id)
    return e && e.n ? e.sum / e.n : 5
  }

  for (const f of items) {
    if (f.type !== 'franja') continue
    const h = hash01(f.id + ':st')
    const e = franjaEnergy(f.id)
    const kind = f.franjaKind ? KIND[f.franjaKind] : 'Franja'
    const code = `FR·${slugCode(f.slug)}`
    // The franja's two foil families: its mark's run and its edition seal's.
    const famLogo = Math.floor(hash01(f.id + ':fam') * HOLO_KINDS.length) % HOLO_KINDS.length
    const famEd = (famLogo + 1 + Math.floor(hash01(f.id + ':edfam') * (HOLO_KINDS.length - 1))) % HOLO_KINDS.length

    if (f.imageUrl) {
      const logo: StickerDef = {
        id: `st-${f.slug}-logo`,
        source: 'franja',
        franjaId: f.id,
        name: `${f.title} — logo`,
        form: 'logo',
        material: 'vinil',
        energy: e,
        price: PRECIO.vinil,
        art: { title: f.title, lines: [kind, 'CDMX'], code, logo: f.imageUrl, seed: h },
        via: 'compra',
        size: 0.24,
        aspect: 1,
      }
      add(logo)
      const variant = (suffix: string, name: string, patch: Partial<StickerDef>) =>
        add({ ...logo, id: `${logo.id}-${suffix}`, design: logo.id, name: `${f.title} — ${name}`, ...patch })
      if (hash01(f.id + ':domo') < 0.45) variant('domo', 'logo con domo', { relieve: 'domo', price: PRECIO.domo })
      variant('holo', 'logo holo', { material: 'holo', holo: HOLO_KINDS[famLogo], price: PRECIO.holo, edition: 150 })
      if (hash01(f.id + ':lenti') < 0.25) variant('lenticular', 'logo lenticular', { material: 'lenticular', price: PRECIO.lenticular, edition: 100 })
      const metal = pickOf(METALS, hash01(f.id + ':metal'))
      const emboss = hash01(f.id + ':mrel') < 0.4
      variant('foil', `logo en foil ${METAL_NOMBRE[metal].toLowerCase()}`, {
        material: 'metal',
        metal,
        relieve: emboss ? 'gofrado' : 'liso',
        price: emboss ? PRECIO.foilGofrado : PRECIO.foil,
        edition: 50,
      })
    }

    const tipoForm = h < 0.5 ? 'tipo' : 'cinta'
    const tipo: StickerDef = {
      id: `st-${f.slug}-tipo`,
      source: 'franja',
      franjaId: f.id,
      name: `${f.title} — tipográfico`,
      form: tipoForm,
      material: 'papel',
      energy: e,
      price: PRECIO.papel,
      art: { title: f.title, lines: [kind, 'Gradiente · CDMX'], code, logo: f.imageUrl, seed: hash01(f.id + ':tipo') },
      via: 'compra',
      size: h < 0.5 ? 0.3 : 0.36,
      aspect: h < 0.5 ? 1.6 : 4.2,
    }
    add(tipo)
    const inked: Relieve = hash01(f.id + ':trel') < 0.5 ? 'barniz' : 'tinta'
    add({
      ...tipo,
      id: `${tipo.id}-${inked}`,
      design: tipo.id,
      name: `${f.title} — tipográfico ${inked === 'barniz' ? 'con barniz' : 'en tinta alzada'}`,
      relieve: inked,
      price: PRECIO.papelRelieve,
    })
    // A tape doesn't take an emboss; a block of type does.
    if (tipoForm === 'tipo' && hash01(f.id + ':temb') < 0.45) {
      const pressed: Relieve = hash01(f.id + ':temb2') < 0.5 ? 'gofrado' : 'hundido'
      add({
        ...tipo,
        id: `${tipo.id}-${pressed}`,
        design: tipo.id,
        name: `${f.title} — tipográfico ${pressed}`,
        relieve: pressed,
        price: PRECIO.papelGofrado,
        edition: 120,
      })
    }

    if (h < 0.34) {
      const glitter = h < 0.12
      add({
        id: `st-${f.slug}-holo`,
        source: 'franja',
        franjaId: f.id,
        name: `${f.title} — edición ${glitter ? 'brillo' : 'holo'}`,
        form: hash01(f.id + ':form') < 0.5 ? 'circulo' : 'sello',
        material: glitter ? 'brillo' : 'holo',
        holo: glitter ? undefined : HOLO_KINDS[famEd],
        energy: e,
        price: PRECIO.edicion,
        edition: 150,
        art: { title: f.title, lines: [kind, 'Edición numerada'], code, logo: f.imageUrl, seed: hash01(f.id + ':holo') },
        via: 'compra',
        size: 0.22,
        aspect: 1,
      })
    }
  }

  for (const ev of items) {
    if (ev.type !== 'evento' || !ev.date) continue
    const h = hash01(ev.id + ':st')
    const mid = (ev.vibeMin + ev.vibeMax) / 2
    const circle = Boolean(ev.imageUrl) && h < 0.42
    const lineup = (ev.artists ?? []).slice(0, 4).join(' · ')
    // The finish of the night: a festival's circle is holo láser; some other
    // circles run holo or a dome; stubs are paper, some letterpressed, now
    // and then a foil ticket.
    const festival = ev.franjaId ? byId.get(ev.franjaId)?.franjaKind === 'festival' : false
    const hf = hash01(ev.id + ':fin')
    const hr = hash01(ev.id + ':rel')
    let finish: Pick<StickerDef, 'material' | 'holo' | 'metal' | 'relieve'>
    if (circle) {
      if (festival) finish = { material: 'holo', holo: 'laser' }
      else if (hf < 0.24) finish = { material: 'holo', holo: pickOf<HoloKind>(['laser', 'prisma', 'galaxia', 'aceite'], hash01(ev.id + ':fam')) }
      else finish = { material: 'vinil', relieve: hr < 0.22 ? 'domo' : undefined }
    } else if (hf > 0.93) finish = { material: 'metal', metal: hr < 0.5 ? 'oro' : 'plata' }
    else finish = { material: 'papel', relieve: hr < 0.22 ? 'hundido' : hr < 0.34 ? 'tinta' : undefined }
    add({
      id: `st-ev-${ev.id}`,
      source: 'evento',
      eventId: ev.id,
      franjaId: ev.franjaId,
      name: `${ev.title} — ${circle ? 'círculo' : 'talón'}`,
      form: circle ? 'circulo' : 'boleto',
      ...finish,
      energy: mid,
      art: {
        title: ev.title,
        lines: [ev.venue ?? 'CDMX', longDate(ev.date), lineup].filter(Boolean),
        code: `EV·${dayCode(ev.date)}`,
        image: ev.imageUrl,
        date: ev.date,
        seed: h,
      },
      via: 'boleto',
      size: circle ? 0.22 : 0.3,
      aspect: circle ? 1 : 2.1,
    })
  }

  add({
    id: 'st-casa-energia',
    source: 'casa',
    name: 'Energía, no género — de la casa',
    form: 'tipo',
    material: 'papel',
    energy: 5,
    art: { title: 'ENERGÍA, NO GÉNERO', lines: ['Gradiente', 'CDMX'], code: 'GR·00', seed: 0.37 },
    via: 'regalo',
    size: 0.3,
    aspect: 1.6,
  })
  add({
    id: 'st-casa-registro',
    source: 'casa',
    name: 'Registro — de la casa',
    form: 'sello',
    material: 'vinil',
    energy: 8,
    art: { title: 'GRADIENTE', lines: ['Trama'], code: 'GR·⊕', seed: 0.71 },
    via: 'regalo',
    size: 0.2,
    aspect: 1,
  })
  return out
}

/** The finishes of one design, cheapest first (the shelf's options). */
export function variantsOf(catalog: Record<string, StickerDef>, design: string): StickerDef[] {
  return Object.values(catalog)
    .filter((d) => designOf(d) === design)
    .sort((a, b) => (a.price ?? 0) - (b.price ?? 0) || a.id.localeCompare(b.id))
}

// ── the demo history ────────────────────────────────────────────────────────

/** How many stickers each seed person has collected (their case's density). */
const COLLECTION: Record<string, number> = {
  'u-datavismo': 15,
  'u-og-loma': 13,
  'u-hzamorate': 10,
  'u-ikerio': 11,
  'u-insider-tlali': 8,
  'u-curator-radiolopez': 6,
  'u-mod-rumor': 4,
  'u-normal-yag': 5,
  'u-normal-meri': 3,
}

/**
 * The special finishes each seed person also holds, in the order they got
 * them: `true` = pressed onto the case, `false` = still in the binder.
 *   holo      a franja's holo run, in a family this person doesn't hold yet
 *             (the named family first, when some franja runs it)
 *   propio    the holo run of their own franja
 *   gemelo    a second copy of the holo they got just before (two copies of
 *             one design: the foil proves they're not the same)
 *   foil · domo · lenticular · relieve (an embossed / varnished / raised tipo)
 * Between them, datavismo, og-loma and ikerio hold all eight holo families.
 */
type Especial = 'holo' | 'propio' | 'gemelo' | 'foil' | 'domo' | 'lenticular' | 'relieve'
const ESPECIALES: Record<string, Array<[Especial, boolean, HoloKind?]>> = {
  'u-datavismo': [
    ['holo', true, 'laser'],
    ['foil', true],
    ['lenticular', true],
    ['holo', true, 'escamas'],
    ['domo', false],
    ['holo', false, 'prisma'],
    ['foil', false],
    ['relieve', false],
  ],
  'u-og-loma': [
    ['propio', true],
    ['holo', true, 'motivo'],
    ['lenticular', true],
    ['domo', true],
    ['relieve', true],
    ['foil', false],
    ['holo', false, 'aceite'],
    ['gemelo', false],
  ],
  'u-ikerio': [
    ['holo', true, 'hielo'],
    ['foil', true],
    ['domo', true],
    ['holo', false, 'galaxia'],
    ['gemelo', false],
    ['lenticular', false],
    ['holo', false, 'diamante'],
    ['relieve', false],
  ],
  'u-hzamorate': [
    ['holo', true, 'aceite'],
    ['lenticular', false],
  ],
  'u-insider-tlali': [
    ['domo', true],
    ['holo', false, 'hielo'],
  ],
  'u-curator-radiolopez': [['foil', false]],
  'u-normal-yag': [['propio', false]],
}

export interface StickerSeed {
  binder: Record<string, StickerCopy>
  placements: Record<string, StickerPlacement>
  serials: Record<string, number>
}

/**
 * Deterministic collections for the seed people: house gifts at joining,
 * then purchases from franjas they're close to and stubs of past nights,
 * applied over time — a couple stay in the binder, unapplied, for the
 * editor — and then their special finishes (ESPECIALES), newest of all.
 */
export function seedStickers(users: User[], catalog: Record<string, StickerDef>, items: Record<string, ContentItem>, now: number): StickerSeed {
  const binder: Record<string, StickerCopy> = {}
  const placements: Record<string, StickerPlacement> = {}
  const serials: Record<string, number> = {}
  const defs = Object.values(catalog)
  // The first print of each design (the pool the history was always drawn from).
  const franjaDefs = defs.filter((d) => d.source === 'franja' && designOf(d) === d.id)
  const pastEvents = defs.filter((d) => d.source === 'evento' && d.art.date && Date.parse(d.art.date) < now)
  const runs = {
    holo: defs.filter((d) => d.source === 'franja' && d.material === 'holo' && designOf(d) !== d.id),
    foil: defs.filter((d) => d.source === 'franja' && d.material === 'metal'),
    domo: defs.filter((d) => d.source === 'franja' && d.relieve === 'domo'),
    lenticular: defs.filter((d) => d.source === 'franja' && d.material === 'lenticular'),
    relieve: defs.filter((d) => d.source === 'franja' && d.material === 'papel' && (d.relieve ?? 'liso') !== 'liso'),
  }

  for (const u of users) {
    const n = COLLECTION[u.id] ?? 0
    const joined = Date.parse(u.joinedAt)
    if (!Number.isFinite(joined)) continue
    let z = 0
    const give = (def: StickerDef, at: number, k: number | string, apply: boolean) => {
      const uid = `sc-${u.id}-${k}`
      let serial: number | undefined
      if (def.edition) {
        serial = (serials[def.id] ?? 0) + 1
        if (serial > def.edition) return
        serials[def.id] = serial
      }
      const atIso = new Date(at).toISOString()
      binder[uid] = { uid, stickerId: def.id, userId: u.id, at: atIso, via: def.via, serial }
      if (!apply) return
      const r = (s: string) => hash01(`${uid}:${s}`)
      const back = r('face') < 0.62
      // The front keeps its name band mostly clear; stickers gather at the edges.
      const edgeX = r('x') < 0.5 ? 0.1 + r('xx') * 0.26 : 0.64 + r('xx') * 0.26
      placements[uid] = {
        uid,
        userId: u.id,
        face: back ? 'dorso' : 'frente',
        x: back ? 0.12 + r('x') * 0.76 : edgeX,
        y: back ? 0.14 + r('y') * 0.72 : r('y') < 0.5 ? 0.12 + r('yy') * 0.2 : 0.7 + r('yy') * 0.18,
        rot: (r('rot') - 0.5) * 0.9,
        scale: 0.82 + r('scale') * 0.36,
        z: ++z,
        at: new Date(at + 3_600_000 * (2 + r('delay') * 70)).toISOString(),
        wear: r('wear') < 0.18 ? 0.25 : 0,
      }
    }

    // The house's two, at joining.
    CASA_STICKERS.forEach((id, i) => catalog[id] && give(catalog[id], joined + i * 60_000, i, true))
    if (!n) continue

    // Franjas close to this person first (their own, then everyone's).
    const own = franjaDefs.filter((d) => d.franjaId && d.franjaId === u.franjaId)
    const pool = [...own, ...franjaDefs, ...pastEvents]
    const span = Math.max(1, now - joined - 86_400_000)
    const nights = new Set<string>()
    for (let k = 0; k < n; k++) {
      const pick = pool[Math.floor(hash01(`${u.id}:pick:${k}`) * (k < own.length ? own.length : pool.length))]
      if (!pick) continue
      if (pick.eventId && items[pick.eventId] && Date.parse(items[pick.eventId].date ?? '') < joined) continue
      // One ticket, one stub: a night's sticker is never doubled.
      if (pick.eventId) {
        if (nights.has(pick.eventId)) continue
        nights.add(pick.eventId)
      }
      // Spread across their time here, oldest first.
      const at = joined + span * ((k + hash01(`${u.id}:t:${k}`) * 0.8) / (n + 1))
      const apply = k < n - 2
      give(pick, at, k + CASA_STICKERS.length, apply)
    }

    // The special finishes: the last few months, one every week or three.
    const list = ESPECIALES[u.id]
    if (!list) continue
    const families = new Set<string>()
    const metals = new Set<string>()
    const taken = new Set<string>()
    let last: StickerDef | null = null
    const ranked = (arr: StickerDef[], salt: string) => [...arr].sort((a, b) => hash01(`${u.id}:${salt}:${a.id}`) - hash01(`${u.id}:${salt}:${b.id}`))
    const freshHolo = (d: StickerDef) => !taken.has(d.id) && !families.has(finishOf(d).holo ?? '')
    // Oldest first: each one a week or three after the one before, the last a few days ago.
    const gaps = list.map((_, i) => 9 + hash01(`${u.id}:esp:${i}`) * 11)
    list.forEach(([want, apply, fam], i) => {
      let def: StickerDef | undefined
      if (want === 'gemelo') def = last ?? undefined
      else if (want === 'propio') def = runs.holo.find((d) => d.franjaId && d.franjaId === u.franjaId) ?? ranked(runs.holo, 'h').find(freshHolo)
      else if (want === 'holo') def = ranked(runs.holo, 'h').find((d) => freshHolo(d) && (!fam || d.holo === fam)) ?? ranked(runs.holo, 'h').find(freshHolo)
      else if (want === 'foil') def = ranked(runs.foil, 'f').find((d) => !taken.has(d.id) && !metals.has(d.metal ?? ''))
      else def = ranked(runs[want], want).find((d) => !taken.has(d.id))
      if (!def) return
      taken.add(def.id)
      const f = finishOf(def)
      if (f.holo) families.add(f.holo)
      if (f.metal) metals.add(f.metal)
      if (def.material === 'holo') last = def
      const daysAgo = gaps.slice(i).reduce((a, b) => a + b, 0) * 0.8
      const at = Math.max(joined + 86_400_000, now - daysAgo * 86_400_000)
      give(def, at, `v${i}`, apply)
    })
  }
  return { binder, placements, serials }
}
