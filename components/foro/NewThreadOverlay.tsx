'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { useAuth } from '@/components/auth/useAuth'
import { addThread, newThreadId } from '@/lib/foro'
import { GENRES, vibeForGenre } from '@/lib/genres'
import { vibeToColor } from '@/lib/utils'
import {
  FORO_THREAD_GENRES_MAX,
  FORO_THREAD_GENRES_MIN,
  type ForoThread,
} from '@/lib/types'

// ── NewThreadOverlay ───────────────────────────────────────────────────────
//
// Modal composer for starting a new thread. Per spec:
//   - Login required (caller gates the trigger button, but we re-check here).
//   - Image is mandatory on OP — submit is disabled until set.
//   - 1–5 genres required so the catalog vibe-slider can filter the thread.
//   - No anonymity: the author is the current user.

interface NewThreadOverlayProps {
  onClose: () => void
  onPosted: (threadId: string) => void
}

export function NewThreadOverlay({ onClose, onPosted }: NewThreadOverlayProps) {
  const { currentUser, isAuthed } = useAuth()
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [genres, setGenres] = useState<string[]>([])
  const [genreFilter, setGenreFilter] = useState('')
  const [readError, setReadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const genreSet = useMemo(() => new Set(genres), [genres])
  const filteredGenres = useMemo(() => {
    const q = genreFilter.trim().toLowerCase()
    if (!q) return GENRES
    return GENRES.filter(
      (g) => g.name.toLowerCase().includes(q) || g.id.includes(q),
    )
  }, [genreFilter])

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

  const readFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setReadError('Solo imágenes (jpg, png, webp, gif).')
      return
    }
    setReadError(null)
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') setImageDataUrl(result)
    }
    reader.onerror = () => setReadError('No se pudo leer el archivo.')
    reader.readAsDataURL(file)
  }

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) readFile(file)
    e.target.value = ''
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) readFile(file)
  }

  const submit = () => {
    if (!currentUser) {
      setSubmitError('Inicia sesión para publicar.')
      return
    }
    const subj = subject.trim()
    const bd = body.trim()
    const missing: string[] = []
    if (subj.length === 0) missing.push('asunto')
    if (bd.length === 0) missing.push('cuerpo')
    if (!imageDataUrl) missing.push('imagen')
    if (genres.length < FORO_THREAD_GENRES_MIN) {
      missing.push(`géneros (mín. ${FORO_THREAD_GENRES_MIN})`)
    }
    if (missing.length > 0) {
      setSubmitError(`Falta: ${missing.join(', ')}`)
      return
    }
    setSubmitError(null)
    const now = new Date().toISOString()
    const thread: ForoThread = {
      id: newThreadId(),
      authorId: currentUser.id,
      subject: subj,
      body: bd,
      imageUrl: imageDataUrl!,
      genres,
      createdAt: now,
      bumpedAt: now,
    }
    addThread(thread)
    onPosted(thread.id)
  }

  if (!isAuthed) {
    // Defensive — caller should already gate, but render a minimal stub.
    return null
  }

  const canSubmit =
    subject.trim().length > 0 &&
    body.trim().length > 0 &&
    imageDataUrl !== null &&
    genres.length >= FORO_THREAD_GENRES_MIN &&
    genres.length <= FORO_THREAD_GENRES_MAX

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-6 overlay-backdrop-in"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" aria-hidden />

      <div
        onClick={(e) => e.stopPropagation()}
        className="eva-box eva-scanlines relative z-10 flex w-full max-w-2xl flex-col overflow-hidden bg-base overlay-panel-in"
        style={{ maxHeight: 'min(92vh, 800px)' }}
      >
        {/* Chrome */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-base/95 px-4 py-2.5 backdrop-blur-sm">
          <div className="flex min-w-0 items-center gap-3">
            <span className="shrink-0 font-mono text-[10px] tracking-widest" style={{ color: '#F97316' }}>
              //FORO·NUEVO·HILO
            </span>
            <span className="sys-label hidden truncate uppercase text-muted sm:inline">
              como @{currentUser?.username}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="flex items-center gap-1.5 border border-border/70 bg-black px-3 py-2 font-mono text-[10px] tracking-widest text-secondary transition-colors hover:border-white/60 hover:text-primary sm:gap-2 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:text-muted"
          >
            <span className="hidden sm:inline">[ESC]</span>
            <X size={14} className="sm:hidden" />
            <span>CERRAR</span>
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
              <span className="sys-label text-muted">
                ASUNTO <span className="text-sys-orange">*</span>
              </span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="el titular del hilo"
                maxLength={140}
                className="border bg-black px-3 py-2 font-syne text-base font-bold text-primary outline-none transition-colors focus:border-sys-orange"
                style={{ borderColor: '#242424' }}
              />
              <span className="font-mono text-[9px] tracking-widest text-muted">
                {subject.length}/140
              </span>
            </label>

            {/* Body */}
            <label className="flex flex-col gap-1.5">
              <span className="sys-label text-muted">
                CUERPO <span className="text-sys-orange">*</span>
              </span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="el contenido del primer post — el resto puede responder"
                rows={6}
                className="resize-y border bg-black px-3 py-2 font-mono text-[12px] leading-relaxed text-primary outline-none transition-colors focus:border-sys-orange"
                style={{ borderColor: '#242424' }}
              />
            </label>

            {/* Genre picker — 1 to 5 required, drives the catalog vibe filter */}
            <div className="flex flex-col gap-1.5">
              <span className="sys-label text-muted">
                GÉNEROS <span className="text-sys-orange">*</span>
                <span
                  className="ml-2 normal-case text-[9px]"
                  style={{
                    color:
                      genres.length > FORO_THREAD_GENRES_MAX
                        ? '#E63329'
                        : genres.length >= FORO_THREAD_GENRES_MIN
                        ? '#9CA3AF'
                        : '#9CA3AF',
                  }}
                >
                  {genres.length}/{FORO_THREAD_GENRES_MAX} · mín {FORO_THREAD_GENRES_MIN}
                </span>
              </span>

              {/* Selected chips */}
              {genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {genres.map((id) => {
                    const g = GENRES.find((x) => x.id === id)
                    if (!g) return null
                    const v = vibeForGenre(id)
                    const accent = v !== null ? vibeToColor(v) : '#F97316'
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggleGenre(id)}
                        className="flex items-center gap-1 border px-2 py-0.5 font-mono text-[10px] tracking-wide transition-colors"
                        style={{
                          borderColor: accent,
                          color: accent,
                          backgroundColor: `${accent}15`,
                        }}
                      >
                        {g.name}
                        <X size={9} aria-hidden />
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
                className="border bg-black px-3 py-1.5 font-mono text-xs text-primary outline-none transition-colors focus:border-sys-orange"
                style={{ borderColor: '#242424' }}
              />
              <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto border border-dashed border-border p-2">
                {filteredGenres.map((g) => {
                  const isOn = genreSet.has(g.id)
                  const v = vibeForGenre(g.id)
                  const accent = v !== null ? vibeToColor(v) : '#888'
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggleGenre(g.id)}
                      className="border px-2 py-0.5 font-mono text-[10px] tracking-wide transition-colors"
                      style={{
                        borderColor: isOn ? accent : '#242424',
                        color: isOn ? accent : '#888',
                        backgroundColor: isOn ? `${accent}15` : 'transparent',
                      }}
                    >
                      {g.name}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Image upload — mandatory */}
            <div className="flex flex-col gap-1.5">
              <span className="sys-label text-muted">
                IMAGEN <span className="text-sys-orange">*</span>
                <span className="ml-2 normal-case text-[9px] text-muted/80">
                  obligatoria en el post original
                </span>
              </span>
              {imageDataUrl ? (
                <div className="flex items-start gap-3">
                  <img
                    src={imageDataUrl}
                    alt="vista previa"
                    className="max-h-40 max-w-[200px] border border-border object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setImageDataUrl(null)}
                    className="flex items-center gap-1.5 border border-sys-red px-2 py-1 font-mono text-[10px] tracking-widest text-sys-red transition-colors hover:bg-sys-red hover:text-black"
                  >
                    <X size={10} /> QUITAR
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 border border-dashed py-6 font-mono text-[11px] tracking-widest text-muted transition-colors hover:border-sys-orange hover:text-primary"
                  style={{
                    borderColor: dragOver ? '#F97316' : '#242424',
                    backgroundColor: dragOver ? 'rgba(249,115,22,0.05)' : 'transparent',
                  }}
                >
                  <ImagePlus size={14} />
                  <span>ELEGIR ARCHIVO · O ARRASTRA UNA IMAGEN AQUÍ</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onPick}
                className="hidden"
              />
              {readError && (
                <p className="font-mono text-[10px] tracking-widest text-sys-red">⚠ {readError}</p>
              )}
            </div>

            {submitError && (
              <p className="border border-sys-red bg-sys-red/10 px-3 py-2 font-mono text-[11px] tracking-widest text-sys-red">
                ⚠ FALTA: {submitError.replace(/^Falta:\s*/, '')}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-base/95 px-4 py-3 backdrop-blur-sm">
          <button
            type="button"
            onClick={onClose}
            className="border border-border px-3 py-1.5 font-mono text-[10px] tracking-widest text-secondary transition-colors hover:border-white/60 hover:text-primary"
          >
            CANCELAR
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="border px-3 py-1.5 font-mono text-[10px] tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              borderColor: '#F97316',
              color: '#F97316',
              backgroundColor: 'rgba(249,115,22,0.08)',
            }}
          >
            ▶ PUBLICAR HILO
          </button>
        </div>
      </div>
    </div>
  )
}
