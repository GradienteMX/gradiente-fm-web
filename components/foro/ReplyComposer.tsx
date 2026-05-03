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
        onClick={openLogin}
        className="w-full border border-dashed px-3 py-3 text-left font-mono text-[10px] tracking-widest text-muted transition-colors hover:border-white/40 hover:text-primary"
        style={{ borderColor: '#242424' }}
      >
        <span style={{ color: '#F97316' }}>[+]</span> INICIA SESIÓN PARA RESPONDER
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

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between font-mono text-[10px] tracking-widest text-muted">
        <span>
          COMO <span className="text-primary">@{currentUser?.username}</span>
        </span>
        <span className="text-[9px]">ENTER ENVÍA · SHIFT+ENTER SALTO · ESC LIMPIA</span>
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="responder al hilo · usa >>id para citar"
        rows={3}
        className="resize-y border bg-black px-3 py-2 font-mono text-[12px] leading-relaxed text-primary outline-none transition-colors focus:border-sys-orange"
        style={{ borderColor: '#242424' }}
      />

      {imageDataUrl && (
        <div className="relative w-fit">
          <img
            src={imageDataUrl}
            alt="adjunto"
            className="max-h-32 max-w-[200px] border border-border object-cover"
          />
          <button
            type="button"
            onClick={() => setImageDataUrl(null)}
            aria-label="Quitar adjunto"
            className="absolute right-1 top-1 flex items-center justify-center border border-sys-red bg-black/85 p-1 text-sys-red transition-colors hover:bg-sys-red hover:text-black"
          >
            <X size={10} />
          </button>
        </div>
      )}

      {readError && (
        <p className="font-mono text-[10px] tracking-widest text-sys-red">⚠ {readError}</p>
      )}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 border border-border px-2 py-1 font-mono text-[10px] tracking-widest text-muted transition-colors hover:border-white/40 hover:text-primary disabled:cursor-default disabled:opacity-60"
        >
          <ImagePlus size={11} /> {uploading ? 'SUBIENDO…' : 'ADJUNTAR'}
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
          className="border px-3 py-1.5 font-mono text-[10px] tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            borderColor: '#F97316',
            color: '#F97316',
            backgroundColor: 'rgba(249,115,22,0.08)',
          }}
        >
          {submitting ? '◌ ENVIANDO…' : '▶ ENVIAR'}
        </button>
      </div>
    </div>
  )
}
