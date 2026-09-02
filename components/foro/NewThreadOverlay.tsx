'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, Plus, Star, X } from 'lucide-react'
import { useAuth } from '@/components/auth/useAuth'
import { createTag, createThread, fetchCustomTags } from '@/lib/foro'
import { compressAndUploadImage } from '@/lib/imageUpload'
import {
  TAG_NAME_MAX,
  getSelectableGenres,
  getSelectableTags,
  slugifyTag,
  tagLabel,
  vibeForGenre,
} from '@/lib/genres'
import type { Tag } from '@/lib/types'
import { vibeToColor } from '@/lib/utils'
import {
  FORO_THREAD_GENRES_MAX,
  FORO_THREAD_GENRES_MIN,
  FORO_THREAD_IMAGES_MAX,
  FORO_THREAD_TAGS_MAX,
  FORO_THREAD_TAGS_MIN,
} from '@/lib/types'

// ── NewThreadOverlay ───────────────────────────────────────────────────────
//
// Modal composer for starting a new thread. Per spec:
//   - Login required (caller gates the trigger button, but we re-check here).
//   - At least one image is mandatory on OP — submit disabled until set.
//     Up to FORO_THREAD_IMAGES_MAX may be attached; the first is the cover.
//   - 1–5 genres required so the catalog vibe-slider can filter the thread.
//   - No anonymity: the author is the current user.
//
// Fase F chrome: a paper sheet over a flat ink scrim (same anatomy as
// components/overlay/OverlayShell), paper form fields with ink hairlines,
// and selection expressed as an ink FILL rather than a hue — a genre's vibe
// color survives only as an ink-outlined swatch square on its chip. Acid is
// reserved for the two actions that are the author's own: CREAR (a new tag)
// and PUBLICAR HILO, both as fill-blocks with ink type; when PUBLICAR is not
// yet armed it falls back to a plain ink-faint hairline chip.

// House focus grammar — 2px ink outline, offset 2.
const FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

// Field label — the paper register for the retired terminal label class:
// mono d11, uppercase, widest tracking, ink.
const FIELD_LABEL = 'font-mono text-d11 font-bold uppercase tracking-widest text-ink'

interface NewThreadOverlayProps {
  onClose: () => void
  onPosted: (threadId: string) => void
}

export function NewThreadOverlay({ onClose, onPosted }: NewThreadOverlayProps) {
  const { currentUser, isAuthed } = useAuth()
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  // Ordered gallery of uploaded Storage URLs. imageUrls[0] is the cover.
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [genres, setGenres] = useState<string[]>([])
  const [genreFilter, setGenreFilter] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagFilter, setTagFilter] = useState('')
  const [readError, setReadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Legacy ids are excluded — they duplicate current taxonomy entries and
  // made genres like "Hard Techno" show up twice in this list.
  const selectableGenres = useMemo(() => getSelectableGenres(), [])
  const genreSet = useMemo(() => new Set(genres), [genres])
  const filteredGenres = useMemo(() => {
    const q = genreFilter.trim().toLowerCase()
    if (!q) return selectableGenres
    return selectableGenres.filter(
      (g) => g.name.toLowerCase().includes(q) || g.id.includes(q),
    )
  }, [genreFilter, selectableGenres])

  const toggleGenre = (id: string) => {
    if (genreSet.has(id)) {
      setGenres((g) => g.filter((x) => x !== id))
      return
    }
    if (genres.length >= FORO_THREAD_GENRES_MAX) {
      setSubmitError(`Máximo ${FORO_THREAD_GENRES_MAX} géneros.`)
      return
    }
    setSubmitError(null)
    setGenres((g) => [...g, id])
  }

  // Full tag catalog = shipped list + tags other users have created. Loaded
  // once on open; a tag created here is appended locally so it's immediately
  // pickable without a refetch.
  const [customTags, setCustomTags] = useState<Tag[]>([])
  useEffect(() => {
    let alive = true
    void fetchCustomTags().then((t) => {
      if (alive) setCustomTags(t)
    })
    return () => {
      alive = false
    }
  }, [])

  const allTags = useMemo(() => {
    const shipped = getSelectableTags()
    const seen = new Set(shipped.map((t) => t.id))
    return [...shipped, ...customTags.filter((t) => !seen.has(t.id))]
  }, [customTags])

  const tagSet = useMemo(() => new Set(tags), [tags])
  const filteredTags = useMemo(() => {
    const q = tagFilter.trim().toLowerCase()
    if (!q) return allTags
    return allTags.filter(
      (t) => t.name.toLowerCase().includes(q) || t.id.includes(q),
    )
  }, [tagFilter, allTags])

  const toggleTag = (id: string) => {
    if (tagSet.has(id)) {
      setTags((t) => t.filter((x) => x !== id))
      return
    }
    if (tags.length >= FORO_THREAD_TAGS_MAX) {
      setSubmitError(`Máximo ${FORO_THREAD_TAGS_MAX} tags.`)
      return
    }
    setSubmitError(null)
    setTags((t) => [...t, id])
  }

  // ── Creating a new tag ───────────────────────────────────────────────────
  //
  // The composer requires 1–5 tags, so a fixed catalog meant a user whose
  // topic wasn't covered simply could not post. The filter input doubles as
  // a "create" field: when what's typed doesn't already exist, an ADD button
  // appears. The tag is registered in `foro_tags` so it joins the shared
  // list for everyone; if that write fails we still attach it to this thread
  // (foro_threads.tags is free-form) rather than blocking the post.
  const [creatingTag, setCreatingTag] = useState(false)
  const newTagName = tagFilter.trim()
  const newTagId = slugifyTag(newTagName)
  const canCreateTag =
    newTagId.length > 0 &&
    newTagName.length <= TAG_NAME_MAX &&
    !allTags.some((t) => t.id === newTagId) &&
    tags.length < FORO_THREAD_TAGS_MAX

  const addNewTag = async () => {
    if (!canCreateTag || creatingTag) return
    setCreatingTag(true)
    const res = await createTag(newTagName)
    setCreatingTag(false)
    const tag: Tag = res.ok ? res.tag : { id: newTagId, name: newTagName, custom: true }
    if (!res.ok) {
      setSubmitError(`El tag se aplicó a este hilo pero no se guardó en la lista: ${res.error}`)
    } else {
      setSubmitError(null)
    }
    setCustomTags((prev) => (prev.some((t) => t.id === tag.id) ? prev : [tag, ...prev]))
    setTags((prev) => (prev.includes(tag.id) ? prev : [...prev, tag.id]))
    setTagFilter('')
  }

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // ESC closes.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Upload a batch of picked/dropped files in order, appending each to the
  // gallery up to the cap. Uploads run sequentially so the resulting order
  // matches the order the user selected them.
  const readFiles = async (files: File[]) => {
    if (!currentUser) {
      setReadError('Inicia sesión para subir imágenes.')
      return
    }
    const images = files.filter((f) => f.type.startsWith('image/'))
    if (images.length !== files.length) {
      setReadError('Solo imágenes (jpg, png, webp, gif).')
    } else {
      setReadError(null)
    }

    let remaining = FORO_THREAD_IMAGES_MAX - imageUrls.length
    if (remaining <= 0) {
      setReadError(`Máximo ${FORO_THREAD_IMAGES_MAX} imágenes.`)
      return
    }
    setUploading(true)
    for (const file of images) {
      if (remaining <= 0) {
        setReadError(`Máximo ${FORO_THREAD_IMAGES_MAX} imágenes.`)
        break
      }
      const res = await compressAndUploadImage(file, currentUser.id)
      if (res.ok) {
        setImageUrls((prev) =>
          prev.length >= FORO_THREAD_IMAGES_MAX ? prev : [...prev, res.url],
        )
        remaining -= 1
      } else {
        setReadError(res.error)
      }
    }
    setUploading(false)
  }

  const removeImage = (url: string) =>
    setImageUrls((prev) => prev.filter((u) => u !== url))

  // Promote an image to the cover slot (index 0), preserving the rest's order.
  const makeCover = (url: string) =>
    setImageUrls((prev) => [url, ...prev.filter((u) => u !== url)])

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length > 0) void readFiles(files)
    e.target.value = ''
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files ?? [])
    if (files.length > 0) void readFiles(files)
  }

  const submit = async () => {
    if (!currentUser) {
      setSubmitError('Inicia sesión para publicar.')
      return
    }
    const subj = subject.trim()
    const bd = body.trim()
    const missing: string[] = []
    if (subj.length === 0) missing.push('asunto')
    if (bd.length === 0) missing.push('cuerpo')
    if (imageUrls.length === 0) missing.push('imagen')
    if (genres.length < FORO_THREAD_GENRES_MIN) {
      missing.push(`géneros (mín. ${FORO_THREAD_GENRES_MIN})`)
    }
    if (tags.length < FORO_THREAD_TAGS_MIN) {
      missing.push(`tags (mín. ${FORO_THREAD_TAGS_MIN})`)
    }
    if (missing.length > 0) {
      setSubmitError(`Falta: ${missing.join(', ')}`)
      return
    }
    setSubmitError(null)
    setSubmitting(true)
    const res = await createThread({
      subject: subj,
      body: bd,
      imageUrls,
      genres,
      tags,
    })
    setSubmitting(false)
    if (res.ok) {
      onPosted(res.id)
    } else {
      setSubmitError(res.error)
    }
  }

  if (!isAuthed) {
    // Defensive — caller should already gate, but render a minimal stub.
    return null
  }

  const canSubmit =
    subject.trim().length > 0 &&
    body.trim().length > 0 &&
    imageUrls.length > 0 &&
    genres.length >= FORO_THREAD_GENRES_MIN &&
    genres.length <= FORO_THREAD_GENRES_MAX &&
    tags.length >= FORO_THREAD_TAGS_MIN &&
    tags.length <= FORO_THREAD_TAGS_MAX

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-6 overlay-backdrop-in"
      onClick={onClose}
    >
      {/* Ink scrim — flat, no blur (fase C anatomy). */}
      <div className="absolute inset-0 bg-ink/60" aria-hidden />

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 flex w-full max-w-2xl flex-col overflow-hidden border border-ink bg-paper text-ink"
        style={{ maxHeight: 'min(92vh, 800px)' }}
      >
        {/* Chrome / header — raised paper band. */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-ink bg-paper-raised px-4 py-2">
          <div className="flex min-w-0 items-center gap-3">
            <span className="shrink-0 font-mono text-d11 font-bold uppercase tracking-widest text-ink">
              FORO · NUEVO HILO
            </span>
            <span className="hidden truncate font-mono text-d11 uppercase tracking-widest text-ink-faint sm:inline">
              como @{currentUser?.username}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className={`flex min-h-11 shrink-0 items-center gap-2 border border-ink bg-ink px-3 font-mono text-d11 font-bold tracking-widest text-paper transition-colors hover:bg-paper hover:text-ink ${FOCUS_RING}`}
          >
            <X size={12} className="sm:hidden" />
            <span>CERRAR</span>
            <span className="hidden sm:inline">ESC</span>
          </button>
        </div>

        {/* Form body */}
        <div
          className="flex-1 overflow-y-auto p-4"
          onDrop={onDrop}
          onDragOver={(e) => {
            e.preventDefault()
            if (!dragOver) setDragOver(true)
          }}
          onDragLeave={(e) => {
            if (e.currentTarget === e.target) setDragOver(false)
          }}
        >
          <div className="flex flex-col gap-4">
            {/* Subject */}
            <label className="flex flex-col gap-1.5">
              <span className={FIELD_LABEL}>
                ASUNTO <span className="text-sys-red-paper">*</span>
              </span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="el titular del hilo"
                maxLength={140}
                className={`min-h-11 border border-ink bg-paper-raised px-3 py-2 font-syne text-d18 font-extrabold text-ink transition-colors placeholder:font-syne placeholder:font-normal placeholder:text-ink-faint focus:bg-white ${FOCUS_RING}`}
              />
              <span className="font-mono text-[9px] tabular-nums tracking-widest text-ink-faint">
                {subject.length}/140
              </span>
            </label>

            {/* Body */}
            <label className="flex flex-col gap-1.5">
              <span className={FIELD_LABEL}>
                CUERPO <span className="text-sys-red-paper">*</span>
              </span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="el contenido del primer post — el resto puede responder"
                rows={6}
                className={`resize-y border border-ink bg-paper-raised px-3 py-2 font-grotesk text-d15 leading-relaxed text-ink transition-colors placeholder:text-ink-faint focus:bg-white ${FOCUS_RING}`}
              />
            </label>

            {/* Genre picker — 1 to 5 required, drives the catalog vibe filter */}
            <div className="flex flex-col gap-1.5">
              <span className={FIELD_LABEL}>
                GÉNEROS <span className="text-sys-red-paper">*</span>
                <span
                  className={`ml-2 normal-case ${
                    genres.length > FORO_THREAD_GENRES_MAX
                      ? 'text-sys-red-paper'
                      : 'text-ink-faint'
                  }`}
                >
                  {genres.length}/{FORO_THREAD_GENRES_MAX} · mín {FORO_THREAD_GENRES_MIN}
                </span>
              </span>

              {/* Selected chips */}
              {genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {genres.map((id) => {
                    const g = selectableGenres.find((x) => x.id === id)
                    if (!g) return null
                    const v = vibeForGenre(id)
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggleGenre(id)}
                        aria-label={`Quitar ${g.name}`}
                        className={`flex min-h-11 items-center gap-1.5 border border-ink bg-ink px-2.5 font-mono text-d11 tracking-wide text-paper transition-colors hover:bg-paper hover:text-ink ${FOCUS_RING}`}
                      >
                        {v !== null && (
                          <span
                            aria-hidden
                            className="h-2 w-2 shrink-0 border border-ink"
                            style={{ backgroundColor: vibeToColor(v) }}
                          />
                        )}
                        {g.name}
                        <X size={10} aria-hidden />
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Filter input + chip list */}
              <input
                type="text"
                value={genreFilter}
                onChange={(e) => setGenreFilter(e.target.value)}
                placeholder="filtrar géneros…"
                aria-label="Filtrar géneros"
                className={`min-h-11 border border-ink bg-paper-raised px-3 py-2 font-mono text-d13 text-ink transition-colors placeholder:text-ink-faint focus:bg-white ${FOCUS_RING}`}
              />
              <div className="flex max-h-56 flex-wrap gap-1.5 overflow-y-auto border border-dashed border-ink p-2">
                {filteredGenres.map((g) => {
                  const isOn = genreSet.has(g.id)
                  const v = vibeForGenre(g.id)
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggleGenre(g.id)}
                      aria-pressed={isOn}
                      className={`flex min-h-11 items-center gap-1.5 border px-2.5 font-mono text-d11 tracking-wide transition-colors ${
                        isOn
                          ? 'border-ink bg-ink text-paper hover:bg-paper hover:text-ink'
                          : 'border-ink-faint bg-paper text-ink hover:bg-ink hover:text-paper'
                      } ${FOCUS_RING}`}
                    >
                      {v !== null && (
                        <span
                          aria-hidden
                          className="h-2 w-2 shrink-0 border border-ink"
                          style={{ backgroundColor: vibeToColor(v) }}
                        />
                      )}
                      {g.name}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Tag picker — metadata keywords (lib/genres TAGS), min 1.
                Transversal qualities, separate from the genre/vibe axis.
                Shipped tags wear a dashed hairline, user-created ones a
                solid ink hairline — the distinction the old orange carried,
                restated without a hue. */}
            <div className="flex flex-col gap-1.5">
              <span className={FIELD_LABEL}>
                TAGS <span className="text-sys-red-paper">*</span>
                <span className="ml-2 normal-case text-ink-faint">
                  {tags.length}/{FORO_THREAD_TAGS_MAX} · mín {FORO_THREAD_TAGS_MIN} · ¿no está en la lista? escríbelo y dale CREAR
                </span>
              </span>

              {/* Selected chips */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((id) => {
                    const custom = customTags.find((x) => x.id === id)
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggleTag(id)}
                        aria-label={`Quitar ${custom?.name ?? tagLabel(id)}`}
                        className={`flex min-h-11 items-center gap-1.5 border ${
                          custom ? 'border-solid' : 'border-dashed'
                        } border-ink bg-ink px-2.5 font-mono text-d11 tracking-wide text-paper transition-colors hover:bg-paper hover:text-ink ${FOCUS_RING}`}
                      >
                        #{custom?.name ?? tagLabel(id)}
                        <X size={10} aria-hidden />
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Filter input + chip list */}
              <div className="flex items-stretch gap-1.5">
                <input
                  type="text"
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canCreateTag) {
                      e.preventDefault()
                      void addNewTag()
                    }
                  }}
                  maxLength={TAG_NAME_MAX}
                  placeholder="filtrar tags · o escribe uno nuevo…"
                  aria-label="Filtrar o crear tags"
                  className={`min-h-11 min-w-0 flex-1 border border-ink bg-paper-raised px-3 py-2 font-mono text-d13 text-ink transition-colors placeholder:text-ink-faint focus:bg-white ${FOCUS_RING}`}
                />
                {newTagId.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void addNewTag()}
                    disabled={!canCreateTag || creatingTag}
                    title={
                      allTags.some((t) => t.id === newTagId)
                        ? 'Ese tag ya existe'
                        : `Crear #${newTagId}`
                    }
                    className={`flex min-h-11 shrink-0 items-center gap-1 border px-3 font-mono text-d11 font-bold tracking-widest transition-colors disabled:cursor-not-allowed ${
                      canCreateTag && !creatingTag
                        ? 'border-ink bg-acid text-ink hover:bg-ink hover:text-acid'
                        : 'border-ink-faint bg-paper-raised text-ink-faint'
                    } ${FOCUS_RING}`}
                  >
                    <Plus size={12} />
                    <span>{creatingTag ? 'CREANDO…' : 'CREAR'}</span>
                  </button>
                )}
              </div>
              <div className="flex max-h-56 flex-wrap gap-1.5 overflow-y-auto border border-dashed border-ink p-2">
                {filteredTags.length === 0 && (
                  <span className="font-mono text-d11 tracking-widest text-ink-faint">
                    sin coincidencias — usa CREAR para agregar #{newTagId || '…'}
                  </span>
                )}
                {filteredTags.map((t) => {
                  const isOn = tagSet.has(t.id)
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTag(t.id)}
                      aria-pressed={isOn}
                      className={`flex min-h-11 items-center border px-2.5 font-mono text-d11 tracking-wide transition-colors ${
                        t.custom ? 'border-solid' : 'border-dashed'
                      } ${
                        isOn
                          ? 'border-ink bg-ink text-paper hover:bg-paper hover:text-ink'
                          : 'border-ink-faint bg-paper text-ink hover:bg-ink hover:text-paper'
                      } ${FOCUS_RING}`}
                    >
                      #{t.name}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Image upload — at least one mandatory, up to the cap. The
                first image (cover) is badged; any other can be promoted.
                Controls sit in a hairline-separated strip UNDER each plate
                (never floating over the art) so both hit ≥44px. */}
            <div className="flex flex-col gap-1.5">
              <span className={FIELD_LABEL}>
                IMÁGENES <span className="text-sys-red-paper">*</span>
                <span className="ml-2 normal-case text-ink-faint">
                  {imageUrls.length}/{FORO_THREAD_IMAGES_MAX} · la 1ª es la portada
                </span>
              </span>

              {imageUrls.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {imageUrls.map((url, i) => (
                    <div
                      key={url}
                      className={`flex w-24 flex-col border ${
                        i === 0 ? 'border-ink' : 'border-ink-faint'
                      } bg-paper-raised`}
                    >
                      <img
                        src={url}
                        alt={i === 0 ? 'portada' : `imagen ${i + 1}`}
                        className="h-24 w-full object-cover"
                      />
                      <div className="flex border-t border-ink-faint">
                        {i === 0 ? (
                          <span
                            className="flex min-h-11 flex-1 items-center justify-center border-r border-ink-faint bg-ink text-paper"
                            title="Portada"
                          >
                            <Star size={12} fill="currentColor" aria-hidden />
                            <span className="sr-only">Portada</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => makeCover(url)}
                            title="Hacer portada"
                            aria-label="Hacer portada"
                            className={`flex min-h-11 flex-1 items-center justify-center border-r border-ink-faint text-ink transition-colors hover:bg-ink hover:text-paper ${FOCUS_RING}`}
                          >
                            <Star size={12} aria-hidden />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImage(url)}
                          aria-label="Quitar imagen"
                          title="Quitar imagen"
                          className={`flex min-h-11 flex-1 items-center justify-center text-sys-red-paper transition-colors hover:bg-sys-red-paper hover:text-paper ${FOCUS_RING}`}
                        >
                          <X size={12} aria-hidden />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {imageUrls.length < FORO_THREAD_IMAGES_MAX && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className={`flex min-h-11 items-center justify-center gap-2 border border-dashed border-ink py-6 font-mono text-d11 font-bold uppercase tracking-widest text-ink transition-colors disabled:cursor-default disabled:opacity-60 ${
                    dragOver ? 'bg-acid' : 'bg-paper-raised hover:bg-ink hover:text-paper'
                  } ${FOCUS_RING}`}
                >
                  <ImagePlus size={14} />
                  <span>
                    {uploading
                      ? '◌ SUBIENDO…'
                      : imageUrls.length === 0
                      ? 'ELEGIR ARCHIVOS · O ARRASTRA IMÁGENES AQUÍ'
                      : 'AGREGAR MÁS · O ARRASTRA AQUÍ'}
                  </span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={onPick}
                className="hidden"
              />
              {readError && (
                <p className="border border-sys-red-paper px-2 py-1 font-mono text-d11 tracking-widest text-sys-red-paper">
                  {readError}
                </p>
              )}
            </div>

            {submitError && (
              <p className="border border-sys-red-paper bg-paper-raised px-3 py-2 font-mono text-d11 font-bold uppercase tracking-widest text-sys-red-paper">
                FALTA: {submitError.replace(/^Falta:\s*/, '')}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-ink bg-paper-raised px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className={`min-h-11 border border-ink px-3 font-mono text-d11 font-bold tracking-widest text-ink transition-colors hover:bg-ink hover:text-paper ${FOCUS_RING}`}
          >
            CANCELAR
          </button>
          {/* Acid fill-block — the author's own action. Falls back to a
              plain ink-faint chip while the OP is incomplete. */}
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit || submitting}
            className={`min-h-11 border px-4 font-mono text-d11 font-bold tracking-widest transition-colors disabled:cursor-not-allowed ${
              canSubmit && !submitting
                ? 'border-ink bg-acid text-ink hover:bg-ink hover:text-acid'
                : 'border-ink-faint bg-paper-raised text-ink-faint'
            } ${FOCUS_RING}`}
          >
            {submitting ? '◌ PUBLICANDO…' : '▶ PUBLICAR HILO'}
          </button>
        </div>
      </div>
    </div>
  )
}
