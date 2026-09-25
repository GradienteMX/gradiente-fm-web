'use client'

/**
 * NUEVO HILO — opening a thread, on one sheet, in five steps you can take in
 * any order: images (1–5, the first is the cover), subject, body, genres
 * (1–5, they decide the temperature the thread lives at) and tags (1–5,
 * pick or create). The right column is the poster exactly as it will be
 * pasted, the slot it takes, what it pushes off the wall, and an honest
 * list of what's missing. Publishing is a hold, like every commitment.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import type { ForoThread, Genre, Tag } from '@/lib/types'
import {
  FORO_THREAD_GENRES_MAX,
  FORO_THREAD_GENRES_MIN,
  FORO_THREAD_IMAGES_MAX,
  FORO_THREAD_TAGS_MAX,
  FORO_THREAD_TAGS_MIN,
} from '@/lib/types'
import { getDirectChildren, getRootGenres, getSelectableTags, slugifyTag, TAG_NAME_MAX, tagLabel } from '@/lib/genres'
import { newUuid, useDispatch, useNow, useWorld } from '@/lib/store/world'
import { useMe } from '@/lib/store/session'
import { bandLabel, energyVariation } from '@/lib/vibe'
import { Sheet } from '@/components/kit/Sheet'
import { HoldButton } from '@/components/kit/HoldButton'
import { Mark } from '@/components/kit/Glyph'
import { asentar } from '@/components/trama/api'
import { Cartel } from './Cartel'
import { FlyerPicker } from './Flyers'
import { customTags, eVar, onEnergy, fold, FORO_THREAD_CAP, genreEnergy, genreName, imageFiles, imageToDataUrl, pad2, tagName, threadBand } from './foro'
import styles from './NuevoHilo.module.css'

if (typeof window !== 'undefined') gsap.registerPlugin(Flip)

const SUBJECT_MAX = 140
const BODY_MAX = 6000

interface Draft {
  images: string[]
  subject: string
  body: string
  genres: string[]
  tags: string[]
  made: Tag[]
}

interface Group {
  root: Genre
  kids: Genre[]
  hit: boolean
}

/** Closing the sheet by accident shouldn't cost the draft (this session only). */
const memory = new Map<string, Draft>()

export function NuevoHilo({
  open,
  wall,
  onClose,
  onPublished,
}: {
  open: boolean
  /** Thread ids on the wall now, slot order. */
  wall: string[]
  onClose: () => void
  onPublished: (id: string, energy: number) => void
}) {
  return (
    <Sheet open={open} onClose={onClose} label="Abrir un hilo" width={1180}>
      {open ? <Mesa wall={wall} onClose={onClose} onPublished={onPublished} /> : null}
    </Sheet>
  )
}

function Mesa({ wall, onClose, onPublished }: { wall: string[]; onClose: () => void; onPublished: (id: string, energy: number) => void }) {
  const me = useMe()
  const threads = useWorld((s) => s.world.threads)
  const dispatch = useDispatch()
  const now = useNow()
  const init = me ? (memory.get(me.id) ?? null) : null

  const [images, setImages] = useState<string[]>(init?.images ?? [])
  const [subject, setSubject] = useState(init?.subject ?? '')
  const [body, setBody] = useState(init?.body ?? '')
  const [genres, setGenres] = useState<string[]>(init?.genres ?? [])
  const [tags, setTags] = useState<string[]>(init?.tags ?? [])
  const [made, setMade] = useState<Tag[]>(init?.made ?? [])
  const [genreQ, setGenreQ] = useState('')
  const [tagQ, setTagQ] = useState('')
  const [openRoots, setOpenRoots] = useState<string[]>([])
  const [flyers, setFlyers] = useState(false)
  const [busy, setBusy] = useState(0)
  const [imgNote, setImgNote] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)
  const thumbsRef = useRef<HTMLDivElement>(null)
  const flipState = useRef<Flip.FlipState | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const dragFrom = useRef<number | null>(null)

  useEffect(() => {
    if (me) memory.set(me.id, { images, subject, body, genres, tags, made })
  }, [me, images, subject, body, genres, tags, made])

  // A sheet is opening: any print-reveal still running underneath finishes now.
  useEffect(() => {
    asentar()
  }, [])

  // Thumbnails keep their identity when reordered.
  useLayoutEffect(() => {
    const st = flipState.current
    flipState.current = null
    if (!st || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    Flip.from(st, { duration: 0.5, ease: 'expo.out', targets: thumbsRef.current?.querySelectorAll('[data-thumb]') ?? [] })
  }, [images])

  const band = threadBand(genres)
  const full = wall.length >= FORO_THREAD_CAP
  const falling = full ? threads[wall[wall.length - 1]] : null

  // ── images ────────────────────────────────────────────────────────────────
  const snap = () => {
    const els = thumbsRef.current?.querySelectorAll('[data-thumb]')
    if (els?.length) flipState.current = Flip.getState(els)
  }

  const addFiles = async (list: FileList | File[] | null | undefined) => {
    const files = imageFiles(list)
    if (!files.length) {
      setImgNote('Solo imágenes: JPG, PNG, WEBP o GIF.')
      return
    }
    const room = FORO_THREAD_IMAGES_MAX - images.length
    if (room <= 0) {
      setImgNote(`Ya hay ${FORO_THREAD_IMAGES_MAX}. Quita una para agregar otra.`)
      return
    }
    const take = files.slice(0, room)
    setImgNote(files.length > room ? `Caben ${FORO_THREAD_IMAGES_MAX}: se agregaron ${take.length}.` : null)
    setBusy((b) => b + take.length)
    for (const f of take) {
      try {
        const url = await imageToDataUrl(f)
        snap()
        setImages((cur) => (cur.length >= FORO_THREAD_IMAGES_MAX || cur.includes(url) ? cur : [...cur, url]))
      } catch {
        setImgNote(`No pudimos leer «${f.name}».`)
      } finally {
        setBusy((b) => b - 1)
      }
    }
  }

  const toggleFlyer = (src: string) => {
    snap()
    setImages((cur) => (cur.includes(src) ? cur.filter((x) => x !== src) : cur.length >= FORO_THREAD_IMAGES_MAX ? cur : [...cur, src]))
  }
  const move = (i: number, j: number) => {
    if (j < 0 || j >= images.length || i === j) return
    snap()
    setImages((cur) => {
      const next = [...cur]
      const [x] = next.splice(i, 1)
      next.splice(j, 0, x)
      return next
    })
  }
  const makeCover = (i: number) => move(i, 0)
  const removeAt = (i: number) => {
    snap()
    setImages((cur) => cur.filter((_, k) => k !== i))
    setImgNote(null)
  }

  // ── genres ────────────────────────────────────────────────────────────────
  const groups = useMemo(() => {
    const q = fold(genreQ.trim())
    return getRootGenres()
      .map((root): Group | null => {
        const kids = getDirectChildren(root.id)
        if (!q) return { root, kids, hit: false }
        const rootHit = fold(root.name).includes(q) || root.id.includes(q)
        const hitKids = rootHit ? kids : kids.filter((k) => fold(k.name).includes(q) || k.id.includes(q))
        return rootHit || hitKids.length ? { root, kids: hitKids, hit: true } : null
      })
      .filter((g): g is Group => g !== null)
  }, [genreQ])

  const toggleGenre = (id: string) =>
    setGenres((cur) => (cur.includes(id) ? cur.filter((g) => g !== id) : cur.length >= FORO_THREAD_GENRES_MAX ? cur : [...cur, id]))
  const genresFull = genres.length >= FORO_THREAD_GENRES_MAX

  // ── tags ──────────────────────────────────────────────────────────────────
  const catalog = useMemo(() => {
    const shipped = getSelectableTags()
    const seen = new Set(shipped.map((t) => t.id))
    const out: Tag[] = [...shipped]
    for (const t of [...customTags(threads), ...made]) {
      if (seen.has(t.id)) continue
      seen.add(t.id)
      out.push(t)
    }
    return out
  }, [threads, made])
  const tq = tagQ.trim()
  const slug = slugifyTag(tq)
  const exact = catalog.find((t) => t.id === slug) ?? null
  const shownTags = tq ? catalog.filter((t) => fold(t.name).includes(fold(tq)) || (slug && t.id.includes(slug))) : catalog
  const tagsFull = tags.length >= FORO_THREAD_TAGS_MAX
  const canCreate = slug.length > 0 && tq.length <= TAG_NAME_MAX && !exact && !tagsFull
  const toggleTag = (id: string) =>
    setTags((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= FORO_THREAD_TAGS_MAX ? cur : [...cur, id]))
  const createTag = () => {
    if (!canCreate) return
    setMade((m) => [...m, { id: slug, name: tagLabel(slug), custom: true }])
    setTags((cur) => [...cur, slug])
    setTagQ('')
  }

  // ── readiness ─────────────────────────────────────────────────────────────
  const checks = [
    {
      ok: images.length >= 1,
      label: images.length ? `${images.length} ${images.length === 1 ? 'imagen' : 'imágenes'} · la primera es la portada` : 'Falta al menos una imagen',
    },
    { ok: subject.trim().length > 0 && subject.length <= SUBJECT_MAX, label: subject.trim() ? 'Asunto' : 'Falta el asunto' },
    { ok: body.trim().length > 0 && body.length <= BODY_MAX, label: !body.trim() ? 'Falta el cuerpo' : body.length > BODY_MAX ? `El cuerpo pasa de ${BODY_MAX} caracteres` : 'Cuerpo' },
    {
      ok: genres.length >= FORO_THREAD_GENRES_MIN && genres.length <= FORO_THREAD_GENRES_MAX,
      label: genres.length ? `${genres.length} ${genres.length === 1 ? 'género' : 'géneros'} · ${band.known ? bandLabel(Math.round(band.min), Math.round(band.max)) : 'sin temperatura conocida'}` : 'Elige al menos un género',
    },
    { ok: tags.length >= FORO_THREAD_TAGS_MIN && tags.length <= FORO_THREAD_TAGS_MAX, label: tags.length ? `${tags.length} ${tags.length === 1 ? 'tag' : 'tags'}` : 'Elige al menos un tag' },
  ]
  if (busy > 0) checks.push({ ok: false, label: 'Preparando imágenes…' })
  const valid = checks.every((c) => c.ok)
  const current = checks.findIndex((c) => !c.ok)

  const publish = () => {
    if (!me || !valid) return
    const at = new Date().toISOString()
    // foro_threads.id is a uuid: minted here, kept by the route (foro.ts § ids).
    const id = newUuid()
    const thread: ForoThread = {
      id,
      authorId: me.id,
      subject: subject.trim(),
      body: body.trim(),
      imageUrl: images[0],
      imageUrls: images,
      genres,
      tags,
      createdAt: at,
      bumpedAt: at,
    }
    dispatch({ t: 'thread', thread, at })
    if (me) memory.delete(me.id)
    onPublished(id, band.mid)
  }

  const discard = () => {
    if (me) memory.delete(me.id)
    setImages([])
    setSubject('')
    setBody('')
    setGenres([])
    setTags([])
    setMade([])
    setImgNote(null)
  }

  if (!me) return null

  const nowIso = now.toISOString()
  const preview: ForoThread = {
    id: 'fr-vista',
    authorId: me.id,
    subject: subject.trim() || 'Tu asunto aparece aquí',
    body,
    imageUrl: images[0] ?? '',
    imageUrls: images,
    genres,
    tags,
    createdAt: nowIso,
    bumpedAt: nowIso,
  }
  const freeAfter = Math.max(0, FORO_THREAD_CAP - Math.min(FORO_THREAD_CAP, wall.length + 1))

  return (
    <div
      className={styles.mesa}
      style={{ ['--e' as string]: eVar(band.mid), ['--on-e' as string]: onEnergy(band.mid) }}
      onPaste={(e) => {
        const files = imageFiles(e.clipboardData.files)
        if (!files.length) return
        e.preventDefault()
        void addFiles(files)
      }}
      onDragOver={(e) => {
        if (![...e.dataTransfer.types].includes('Files')) return
        e.preventDefault()
        if (!drag) setDrag(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
        setDrag(false)
      }}
      onDrop={(e) => {
        if (![...e.dataTransfer.types].includes('Files')) return
        e.preventDefault()
        setDrag(false)
        void addFiles(e.dataTransfer.files)
      }}
    >
      <header className={styles.head}>
        <div>
          <p className="label" style={{ color: 'var(--ink-3)' }}>
            Foro · nuevo hilo
          </p>
          <h2 className={styles.title}>Abrir un hilo</h2>
          <p className={styles.as}>
            Como <b>@{me.username}</b>. Sin anonimato: tu nombre va en el cartel.
          </p>
        </div>
        <button type="button" className={styles.x} onClick={onClose} aria-label="Cerrar (Esc). El borrador se guarda en esta sesión.">
          <Mark name="close" size={16} />
        </button>
      </header>

      <div className={styles.grid}>
        <div className={styles.main}>
          {/* 1 · images */}
          <Step n={1} title="Imágenes" done={checks[0].ok} current={current === 0} aside={`${images.length}/${FORO_THREAD_IMAGES_MAX}`} hint="De 1 a 5. La primera es la portada del cartel; arrastra para ordenar.">
            <div className={styles.drop} data-drag={drag || undefined}>
              {images.length ? (
                <div ref={thumbsRef} className={styles.thumbs}>
                  {images.map((src, i) => (
                    <figure
                      key={src}
                      data-thumb=""
                      className={styles.thumb}
                      data-cover={i === 0 || undefined}
                      draggable
                      onDragStart={(e) => {
                        dragFrom.current = i
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/x-foro-thumb', String(i))
                      }}
                      onDragOver={(e) => {
                        if (dragFrom.current === null) return
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      onDrop={(e) => {
                        if (dragFrom.current === null) return
                        e.preventDefault()
                        e.stopPropagation()
                        const from = dragFrom.current
                        dragFrom.current = null
                        move(from, i)
                      }}
                      onDragEnd={() => {
                        dragFrom.current = null
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={i === 0 ? 'Portada' : `Imagen ${i + 1}`} draggable={false} />
                      <span className={styles.thumbTag}>{i === 0 ? 'Portada' : pad2(i + 1)}</span>
                      <figcaption className={styles.thumbTools}>
                        <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Mover antes">
                          <Mark name="arrow" size={12} className={styles.flip} />
                        </button>
                        {i > 0 ? (
                          <button type="button" onClick={() => makeCover(i)} className={styles.coverBtn}>
                            Portada
                          </button>
                        ) : null}
                        <button type="button" onClick={() => move(i, i + 1)} disabled={i === images.length - 1} aria-label="Mover después">
                          <Mark name="arrow" size={12} />
                        </button>
                        <button type="button" onClick={() => removeAt(i)} aria-label="Quitar imagen" data-danger="">
                          <Mark name="close" size={11} />
                        </button>
                      </figcaption>
                    </figure>
                  ))}
                  {busy > 0 ? <div className={styles.thumbBusy}>Preparando…</div> : null}
                </div>
              ) : busy > 0 ? (
                <p className={styles.dropText}>Preparando imágenes…</p>
              ) : (
                <p className={styles.dropText}>
                  Suelta imágenes aquí, pégalas, o elige abajo.
                  <span>Se reducen a 1600 px para que el muro pese poco.</span>
                </p>
              )}
              <div className={styles.dropTools}>
                <button type="button" className={styles.tool} onClick={() => fileRef.current?.click()} disabled={images.length >= FORO_THREAD_IMAGES_MAX} data-autofocus="">
                  <Mark name="plus" size={13} />
                  Elegir archivos
                </button>
                <button type="button" className={styles.tool} data-on={flyers || undefined} onClick={() => setFlyers((f) => !f)} aria-expanded={flyers}>
                  Flyers de la casa
                </button>
                {imgNote ? (
                  <span className={styles.note} role="status">
                    {imgNote}
                  </span>
                ) : null}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  const list = e.target.files ? [...e.target.files] : []
                  e.target.value = ''
                  void addFiles(list)
                }}
              />
            </div>
            {flyers ? (
              <div className={styles.flyers} data-lenis-prevent="">
                <FlyerPicker picked={images} full={images.length >= FORO_THREAD_IMAGES_MAX} onPick={toggleFlyer} />
              </div>
            ) : null}
          </Step>

          {/* 2 · subject */}
          <Step n={2} title="Asunto" done={checks[1].ok} current={current === 1} aside={`${subject.length}/${SUBJECT_MAX}`} hint="Lo que se lee en el muro, a la temperatura de tus géneros.">
            <textarea
              className={styles.subject}
              value={subject}
              maxLength={SUBJECT_MAX}
              rows={2}
              onChange={(e) => setSubject(e.target.value.replace(/\s*\n+\s*/g, ' '))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.preventDefault()
              }}
              placeholder="¿De qué va el hilo?"
              aria-label="Asunto del hilo"
              style={{ fontVariationSettings: energyVariation(band.mid) }}
            />
          </Step>

          {/* 3 · body */}
          <Step n={3} title="Cuerpo" done={checks[2].ok} current={current === 2} aside={body.length > BODY_MAX - 600 ? `${body.length}/${BODY_MAX}` : undefined} hint="El primer post. Los demás responden abajo; los enlaces y videos de YouTube se muestran en el hilo.">
            <textarea className={styles.body} value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder="Cuenta, pregunta, propone." aria-label="Cuerpo del hilo" />
          </Step>

          {/* 4 · genres */}
          <Step
            n={4}
            title="Géneros"
            done={checks[3].ok}
            current={current === 3}
            aside={`${genres.length}/${FORO_THREAD_GENRES_MAX}`}
            hint="De 1 a 5. Deciden en qué temperatura vive el hilo: el horizonte del foro filtra por ellos."
          >
            {genres.length ? (
              <div className={styles.picked}>
                {genres.map((g) => (
                  <button key={g} type="button" className={styles.pickedChip} onClick={() => toggleGenre(g)} aria-label={`Quitar ${genreName(g)}`}>
                    <Dot id={g} />
                    {genreName(g)}
                    <Mark name="close" size={10} />
                  </button>
                ))}
                {band.known ? (
                  <span className={styles.temp} style={{ fontVariationSettings: energyVariation(band.mid) }}>
                    {bandLabel(Math.round(band.min), Math.round(band.max))}
                  </span>
                ) : null}
              </div>
            ) : null}
            <label className={styles.filter}>
              <Mark name="search" size={14} />
              <input
                value={genreQ}
                onChange={(e) => setGenreQ(e.target.value)}
                placeholder="Filtrar géneros: techno, cumbia, ambient…"
                aria-label="Filtrar géneros"
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && genreQ) {
                    e.stopPropagation()
                    setGenreQ('')
                  }
                }}
              />
            </label>
            <div className={styles.genreBox} data-lenis-prevent="">
              {groups.length ? (
                groups.map(({ root, kids, hit }) => {
                  const expanded = hit || openRoots.includes(root.id)
                  const inside = kids.filter((k) => genres.includes(k.id)).length
                  return (
                    <section key={root.id} className={styles.group} data-open={expanded || undefined}>
                      <div className={styles.groupHead}>
                        <GenreChip id={root.id} name={root.name} on={genres.includes(root.id)} disabled={genresFull} onToggle={toggleGenre} root />
                        {kids.length ? (
                          <button
                            type="button"
                            className={styles.expand}
                            aria-expanded={expanded}
                            onClick={() => setOpenRoots((cur) => (cur.includes(root.id) ? cur.filter((x) => x !== root.id) : [...cur, root.id]))}
                            disabled={hit}
                          >
                            {expanded ? (hit ? `${kids.length} ${kids.length === 1 ? 'coincidencia' : 'coincidencias'}` : 'cerrar') : `${kids.length} subgéneros`}
                            {inside ? <b> · {inside} elegido{inside === 1 ? '' : 's'}</b> : null}
                          </button>
                        ) : null}
                      </div>
                      {expanded && kids.length ? (
                        <div className={styles.kids}>
                          {kids.map((k) => (
                            <GenreChip key={k.id} id={k.id} name={k.name} on={genres.includes(k.id)} disabled={genresFull} onToggle={toggleGenre} />
                          ))}
                        </div>
                      ) : null}
                    </section>
                  )
                })
              ) : (
                <p className={styles.nothing}>Sin géneros para «{genreQ.trim()}».</p>
              )}
            </div>
          </Step>

          {/* 5 · tags */}
          <Step n={5} title="Tags" done={checks[4].ok} current={current === 4} aside={`${tags.length}/${FORO_THREAD_TAGS_MAX}`} hint="De 1 a 5. Cualidades que cruzan géneros. ¿No está? Escríbelo y créalo.">
            {tags.length ? (
              <div className={styles.picked}>
                {tags.map((id) => (
                  <button key={id} type="button" className={styles.pickedChip} data-tag="" onClick={() => toggleTag(id)} aria-label={`Quitar ${tagName(id)}`}>
                    #{tagName(id)}
                    <Mark name="close" size={10} />
                  </button>
                ))}
              </div>
            ) : null}
            <div className={styles.tagRow}>
              <label className={styles.filter}>
                <span className={styles.hash}>#</span>
                <input
                  value={tagQ}
                  maxLength={TAG_NAME_MAX}
                  onChange={(e) => setTagQ(e.target.value)}
                  placeholder="Filtrar o crear: after, vinilo, cdmx…"
                  aria-label="Filtrar o crear tags"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (exact) {
                        if (!tags.includes(exact.id)) toggleTag(exact.id)
                        setTagQ('')
                      } else createTag()
                    } else if (e.key === 'Escape' && tagQ) {
                      e.stopPropagation()
                      setTagQ('')
                    }
                  }}
                />
              </label>
              {slug && !exact ? (
                <button type="button" className={styles.create} onClick={createTag} disabled={!canCreate}>
                  <Mark name="plus" size={12} />
                  Crear #{slug}
                </button>
              ) : null}
            </div>
            {slug && !exact && canCreate ? (
              <p className={styles.createNote}>
                Se guardará como <code>#{slug}</code> y se leerá «{tagLabel(slug)}».
              </p>
            ) : null}
            <div className={styles.tagBox} data-lenis-prevent="">
              {shownTags.length ? (
                shownTags.map((t) => {
                  const on = tags.includes(t.id)
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={styles.tagChip}
                      data-on={on || undefined}
                      data-custom={t.custom || undefined}
                      disabled={tagsFull && !on}
                      onClick={() => toggleTag(t.id)}
                      aria-pressed={on}
                    >
                      #{t.name}
                    </button>
                  )
                })
              ) : (
                <p className={styles.nothing}>Nada con «{tq}». Créalo con Enter.</p>
              )}
            </div>
          </Step>
        </div>

        <aside className={styles.side}>
          <div className={styles.sideInner}>
            <p className="label" style={{ color: 'var(--ink-3)' }}>
              Así entra al muro
            </p>
            <div className={styles.preview} data-empty={!images.length || undefined}>
              <Cartel thread={preview} slot={1} replies={0} now={now} author={me.username} still />
            </div>
            <p className={styles.consequence}>
              Entra en el lugar <b>01</b>.{' '}
              {full && falling ? (
                <>
                  El 30 —<i>«{falling.subject}»</i>— cae del muro.
                </>
              ) : (
                <>
                  Quedan {freeAfter} {freeAfter === 1 ? 'lugar libre' : 'lugares libres'} de {FORO_THREAD_CAP}.
                </>
              )}
            </p>
            <ul className={styles.checks} aria-label="Lo que falta">
              {checks.map((c) => (
                <li key={c.label} data-ok={c.ok || undefined}>
                  <span className={styles.checkMark} aria-hidden="true">
                    {c.ok ? <Mark name="check" size={12} /> : null}
                  </span>
                  {c.label}
                </li>
              ))}
            </ul>
            <HoldButton onConfirm={publish} disabled={!valid} energy={band.mid} full holdingLabel="Pegando en el muro…">
              Publicar hilo
            </HoldButton>
            <p className={styles.holdNote}>{valid ? 'Mantén presionado para pegarlo.' : 'Se activa cuando no falte nada.'}</p>
            {images.length || subject || body || genres.length || tags.length ? (
              <button type="button" className={styles.discard} onClick={discard}>
                Descartar borrador
              </button>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  )
}

function Step({
  n,
  title,
  hint,
  done,
  current,
  aside,
  children,
}: {
  n: number
  title: string
  hint?: string
  done: boolean
  current: boolean
  aside?: string
  children: React.ReactNode
}) {
  return (
    <section className={styles.step} data-done={done || undefined} data-current={current || undefined}>
      <header className={styles.stepHead}>
        <span className={styles.stepNum}>{done ? <Mark name="check" size={13} /> : n}</span>
        <h3 className={styles.stepTitle}>{title}</h3>
        {aside ? <span className={styles.stepAside}>{aside}</span> : null}
      </header>
      {hint ? <p className={styles.stepHint}>{hint}</p> : null}
      <div className={styles.stepBody}>{children}</div>
    </section>
  )
}

function Dot({ id }: { id: string }) {
  const e = genreEnergy(id)
  return <i className={styles.dot} style={{ background: e === null ? 'var(--ink-4)' : eVar(e) }} />
}

function GenreChip({
  id,
  name,
  on,
  disabled,
  onToggle,
  root,
}: {
  id: string
  name: string
  on: boolean
  disabled: boolean
  onToggle: (id: string) => void
  root?: boolean
}) {
  return (
    <button type="button" className={styles.genreChip} data-on={on || undefined} data-root={root || undefined} disabled={disabled && !on} onClick={() => onToggle(id)} aria-pressed={on}>
      <Dot id={id} />
      {name}
    </button>
  )
}
