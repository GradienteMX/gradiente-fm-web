'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatDistanceToNowStrict, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Trash2 } from 'lucide-react'
import { useAuth } from '@/components/auth/useAuth'
import type { ListingComment } from '@/lib/types'

// Lightweight comment thread for a marketplace listing — buyers ask, the
// seller replies. Flat with one level of replies; seller comments are badged.
// No reactions / no rank effects (see migration 0033).

function ago(iso: string): string {
  try {
    return formatDistanceToNowStrict(parseISO(iso), { locale: es, addSuffix: false }).toUpperCase()
  } catch {
    return '—'
  }
}

export function ListingComments({ listingId }: { listingId: string }) {
  const { isAuthed, currentUser, openLogin } = useAuth()
  const [comments, setComments] = useState<ListingComment[]>([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [replyTo, setReplyTo] = useState<ListingComment | null>(null)
  const [posting, setPosting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/listings/${encodeURIComponent(listingId)}/comments`)
      if (res.ok) {
        const j = await res.json()
        setComments((j.comments ?? []) as ListingComment[])
      }
    } finally {
      setLoading(false)
    }
  }, [listingId])

  useEffect(() => {
    void load()
  }, [load])

  const post = async () => {
    const text = body.trim()
    if (!text || posting) return
    setPosting(true)
    try {
      const res = await fetch(`/api/listings/${encodeURIComponent(listingId)}/comments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: text, parentId: replyTo?.id ?? null }),
      })
      if (res.ok) {
        setBody('')
        setReplyTo(null)
        await load()
      }
    } finally {
      setPosting(false)
    }
  }

  const remove = async (id: string) => {
    const res = await fetch(
      `/api/listings/${encodeURIComponent(listingId)}/comments/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    )
    if (res.ok) await load()
  }

  const tops = comments.filter((c) => !c.parentId)
  const repliesOf = (id: string) => comments.filter((c) => c.parentId === id)

  const Row = ({ c, reply }: { c: ListingComment; reply?: boolean }) => (
    <div className={reply ? 'ml-4 border-l border-border pl-3' : ''}>
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[10px] tracking-widest text-primary">
            @{c.author.username}
          </span>
          {c.isSeller && (
            <span
              className="border px-1 py-px font-mono text-[8px] tracking-widest"
              style={{ borderColor: '#FBBF24', color: '#FBBF24' }}
            >
              VENDEDOR
            </span>
          )}
          <span className="font-mono text-[8px] tracking-widest text-muted">
            {ago(c.createdAt)}
          </span>
        </div>
        {currentUser?.id === c.author.id && (
          <button
            type="button"
            onClick={() => remove(c.id)}
            aria-label="Borrar comentario"
            className="text-muted transition-colors hover:text-sys-red"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
      <p className="mt-0.5 whitespace-pre-line font-mono text-[11px] leading-relaxed text-secondary">
        {c.body}
      </p>
      {!reply && isAuthed && (
        <button
          type="button"
          onClick={() => setReplyTo(c)}
          className="mt-1 font-mono text-[9px] tracking-widest text-muted transition-colors hover:text-sys-orange"
        >
          RESPONDER
        </button>
      )}
    </div>
  )

  return (
    <div className="flex flex-col gap-3 border-t border-border/40 pt-3">
      <span className="font-mono text-[9px] tracking-widest text-muted">
        PREGUNTAS · COMENTARIOS{comments.length > 0 ? ` (${comments.length})` : ''}
      </span>

      {loading ? (
        <span className="font-mono text-[10px] text-muted">Cargando…</span>
      ) : tops.length === 0 ? (
        <span className="font-mono text-[10px] text-muted">
          Sé el primero en preguntar.
        </span>
      ) : (
        <div className="flex flex-col gap-3">
          {tops.map((c) => (
            <div key={c.id} className="flex flex-col gap-2">
              <Row c={c} />
              {repliesOf(c.id).map((r) => (
                <Row key={r.id} c={r} reply />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Composer */}
      {isAuthed ? (
        <div className="flex flex-col gap-1.5">
          {replyTo && (
            <span className="flex items-center gap-2 font-mono text-[9px] tracking-widest text-muted">
              RESPONDIENDO A @{replyTo.author.username}
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="text-muted hover:text-sys-red"
              >
                ×
              </button>
            </span>
          )}
          <textarea
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Pregunta por la condición, el envío, regatea…"
            className="w-full resize-none border bg-base px-2 py-1.5 font-mono text-[11px] text-primary placeholder:text-muted/60 focus:border-sys-orange focus:outline-none"
            style={{ borderColor: '#242424' }}
          />
          <button
            type="button"
            onClick={post}
            disabled={!body.trim() || posting}
            className="self-end border border-sys-orange bg-sys-orange/10 px-3 py-1 font-mono text-[10px] tracking-widest text-sys-orange transition-colors hover:bg-sys-orange/20 disabled:opacity-40"
          >
            {posting ? 'ENVIANDO…' : 'ENVIAR'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => openLogin()}
          className="self-start font-mono text-[10px] tracking-widest text-sys-orange transition-colors hover:text-primary"
        >
          ▶ Inicia sesión para comentar
        </button>
      )}
    </div>
  )
}
