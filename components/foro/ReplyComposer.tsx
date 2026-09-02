'use client'

import { useRef, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { useAuth } from '@/components/auth/useAuth'
import { createReply } from '@/lib/foro'
import { compressAndUploadImage } from '@/lib/imageUpload'

// ── ReplyComposer ──────────────────────────────────────────────────────────
//
// Pinned at the bottom of the thread overlay. Login-gated. Supports an
// optional image attachment (replies aren't required to have one).
// Posts via Enter; shift+Enter inserts a newline. ESC clears.
//
// Fase F chrome: paper field with an ink hairline, ink-chip secondary
// actions, and an acid fill-block ENVIAR — the submit is the reader's OWN
// action, the one whitelisted acid use on this surface. Disabled, it drops
// back to a plain ink-faint hairline chip (acid never states "not yet").

// House focus grammar — 2px ink outline, offset 2.
const FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

interface ReplyComposerProps {
  threadId: string
  // When set, the composer pre-fills with `>>id` quote-link headers, one per
  // line. Used when a user clicks a post id in the thread to quote it.
  initialQuotedIds?: string[]
  onPosted?: () => void
}

export function ReplyComposer({ threadId, initialQuotedIds = [], onPosted }: ReplyComposerProps) {
  const { currentUser, isAuthed, openLogin } = useAuth()
  const [body, setBody] = useState(
    initialQuotedIds.length > 0
      ? initialQuotedIds.map((id) => `>>${id}`).join(' ') + ' '
      : '',
  )
  // Holds the uploaded Storage URL — name kept for diff-friendliness.
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [readError, setReadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isAuthed) {
    return (
      <button
        type="button"
        onClick={() => openLogin()}
        className={`min-h-11 w-full border border-dashed border-ink px-3 py-3 text-left font-mono text-d11 font-bold uppercase tracking-widest text-ink transition-colors hover:bg-ink hover:text-paper ${FOCUS_RING}`}
      >
        INICIA SESIÓN PARA RESPONDER
      </button>
    )
  }

  const readFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setReadError('Solo imágenes (jpg, png, webp, gif).')
      return
    }
    if (!currentUser) return
    setReadError(null)
    setUploading(true)
    const res = await compressAndUploadImage(file, currentUser.id)
    setUploading(false)
    if (res.ok) {
      setImageDataUrl(res.url)
    } else {
      setReadError(res.error)
    }
  }

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void readFile(file)
    e.target.value = ''
  }

  // Parse `>>id` tokens from the body so we can store them on the reply.
  const extractQuotedIds = (text: string): string[] => {
    const matches = text.match(/>>([a-z0-9-]+)/gi)
    if (!matches) return []
    return Array.from(new Set(matches.map((m) => m.slice(2))))
  }

  const submit = async () => {
    if (!currentUser) return
    const trimmed = body.trim()
    if (trimmed.length === 0) return
    setSubmitting(true)
    const quotedReplyIds = extractQuotedIds(trimmed)
    const res = await createReply({
      threadId,
      body: trimmed,
      imageUrl: imageDataUrl ?? undefined,
      quotedReplyIds: quotedReplyIds.length > 0 ? quotedReplyIds : undefined,
    })
    setSubmitting(false)
    if (res.ok) {
      setBody('')
      setImageDataUrl(null)
      onPosted?.()
    } else {
      setReadError(res.error)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void submit()
    }
    if (e.key === 'Escape') {
      setBody('')
      setImageDataUrl(null)
    }
  }

  const canSend = body.trim().length > 0 && !submitting

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 font-mono text-d11 uppercase tracking-widest text-ink-faint">
        <span>
          COMO <span className="font-bold text-ink">@{currentUser?.username}</span>
        </span>
        <span>ENTER ENVÍA · SHIFT+ENTER SALTO · ESC LIMPIA</span>
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={onKeyDown}
        aria-label="Responder al hilo"
        placeholder="responder al hilo · usa >>id para citar"
        rows={3}
        className={`resize-y border border-ink bg-paper-raised px-3 py-2 font-grotesk text-d15 leading-relaxed text-ink transition-colors placeholder:text-ink-faint focus:bg-white ${FOCUS_RING}`}
      />

      {imageDataUrl && (
        <div className="flex w-fit flex-col border border-ink bg-paper-raised">
          <img
            src={imageDataUrl}
            alt="adjunto"
            className="max-h-32 max-w-[200px] object-cover"
          />
          <button
            type="button"
            onClick={() => setImageDataUrl(null)}
            aria-label="Quitar adjunto"
            className={`flex min-h-11 items-center justify-center gap-1.5 border-t border-sys-red-paper font-mono text-d11 font-bold tracking-widest text-sys-red-paper transition-colors hover:bg-sys-red-paper hover:text-paper ${FOCUS_RING}`}
          >
            <X size={11} />
            QUITAR
          </button>
        </div>
      )}

      {readError && (
        <p className="border border-sys-red-paper px-2 py-1 font-mono text-d11 tracking-widest text-sys-red-paper">
          {readError}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={`flex min-h-11 items-center gap-1.5 border border-ink px-3 font-mono text-d11 font-bold tracking-widest text-ink transition-colors hover:bg-ink hover:text-paper disabled:cursor-default disabled:opacity-60 ${FOCUS_RING}`}
        >
          <ImagePlus size={12} /> {uploading ? 'SUBIENDO…' : 'ADJUNTAR'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onPick}
          className="hidden"
        />
        <button
          type="button"
          onClick={submit}
          disabled={body.trim().length === 0 || submitting}
          className={`min-h-11 border px-4 font-mono text-d11 font-bold tracking-widest transition-colors disabled:cursor-not-allowed ${
            canSend
              ? 'border-ink bg-acid text-ink hover:bg-ink hover:text-acid'
              : 'border-ink-faint bg-paper-raised text-ink-faint'
          } ${FOCUS_RING}`}
        >
          {submitting ? '◌ ENVIANDO…' : '▶ ENVIAR'}
        </button>
      </div>
    </div>
  )
}
