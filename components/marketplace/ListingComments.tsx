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
//
// «EL PLIEGO» fase F. Rendered only inside [[MarketplaceListingDetail]], so it
// takes the same `variant` its host does: `paper` (default) is the house
// sheet; `dark` is the inverted ink panel for a host whose ground stays dark
// (/mapa). Same anatomy either way — hairlines, mono labels, no glow.

type SkinName = 'paper' | 'dark'

interface Skin {
  rule: string
  label: string
  author: string
  body: string
  sellerBadge: string
  destructive: string
  field: string
  cta: string
  ghost: string
  focus: string
}

const SKINS: Record<SkinName, Skin> = {
  paper: {
    rule: 'border-ink',
    label: 'text-ink-faint',
    author: 'text-ink',
    body: 'text-ink-soft',
    sellerBadge: 'bg-ink text-paper',
    destructive: 'text-ink-faint hover:text-sys-red-paper',
    field:
      'border border-ink bg-paper-raised text-ink placeholder:text-ink-faint focus:border-ink',
    cta: 'border border-ink bg-ink text-paper hover:bg-paper hover:text-ink',
    ghost: 'border border-ink text-ink hover:bg-ink hover:text-paper',
    focus: 'focus-visible:outline-ink',
  },
  dark: {
    rule: 'border-panel-text/40',
    label: 'text-panel-text/60',
    author: 'text-panel-text',
    body: 'text-panel-text/80',
    sellerBadge: 'bg-panel-text text-ink',
    destructive: 'text-panel-text/60 hover:text-sys-red-paper',
    field:
      'border border-panel-text/40 bg-ink text-panel-text placeholder:text-panel-text/50 focus:border-panel-text',
    cta: 'border border-panel-text bg-panel-text text-ink hover:bg-panel hover:text-panel-text',
    ghost:
      'border border-panel-text/50 text-panel-text hover:bg-panel-text hover:text-ink',
    focus: 'focus-visible:outline-panel-text',
  },
}

const FOCUS_BASE =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'

function ago(iso: string): string {
  try {
    return formatDistanceToNowStrict(parseISO(iso), { locale: es, addSuffix: false }).toUpperCase()
  } catch {
    return '—'
  }
}

export function ListingComments({
  listingId,
  variant = 'paper',
}: {
  listingId: string
  variant?: SkinName
}) {
  const skin = SKINS[variant]
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
    <div className={reply ? `ml-4 border-l pl-3 ${skin.rule}` : ''}>
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className={`font-mono text-d11 font-bold tracking-widest ${skin.author}`}>
            @{c.author.username}
          </span>
          {c.isSeller && (
            <span
              className={`px-1 py-px font-mono text-d11 font-bold uppercase tracking-widest ${skin.sellerBadge}`}
            >
              VENDEDOR
            </span>
          )}
          <span className={`font-mono text-d11 uppercase tracking-widest ${skin.label}`}>
            {ago(c.createdAt)}
          </span>
        </div>
        {currentUser?.id === c.author.id && (
          <button
            type="button"
            onClick={() => remove(c.id)}
            aria-label="Borrar comentario"
            // 44px target on phones, compact on desktop — same concession
            // CommentsColumn makes for inline controls inside dense text.
            className={`flex min-h-11 shrink-0 items-center px-1 transition-colors sm:min-h-0 ${skin.destructive} ${FOCUS_BASE} ${skin.focus}`}
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
      <p className={`mt-0.5 whitespace-pre-line font-grotesk text-d13 leading-relaxed ${skin.body}`}>
        {c.body}
      </p>
      {!reply && isAuthed && (
        <button
          type="button"
          onClick={() => setReplyTo(c)}
          className={`mt-1 flex min-h-11 w-fit items-center px-2 font-mono text-d11 font-bold uppercase tracking-widest transition-colors ${skin.ghost} ${FOCUS_BASE} ${skin.focus}`}
        >
          RESPONDER
        </button>
      )}
    </div>
  )

  return (
    <div className={`flex flex-col gap-3 border-t pt-3 ${skin.rule}`}>
      <span className={`font-mono text-d11 font-bold uppercase tracking-widest ${skin.label}`}>
        PREGUNTAS · COMENTARIOS{comments.length > 0 ? ` (${comments.length})` : ''}
      </span>

      {loading ? (
        <span className={`font-grotesk text-d13 ${skin.label}`}>Cargando…</span>
      ) : tops.length === 0 ? (
        <span className={`font-grotesk text-d13 ${skin.label}`}>
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
            <span
              className={`flex items-center gap-2 font-mono text-d11 uppercase tracking-widest ${skin.label}`}
            >
              RESPONDIENDO A @{replyTo.author.username}
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                aria-label="Cancelar respuesta"
                className={`flex min-h-11 items-center px-1 transition-colors sm:min-h-0 ${skin.destructive} ${FOCUS_BASE} ${skin.focus}`}
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
            className={`w-full resize-none px-2 py-1.5 font-grotesk text-d13 focus:outline-none ${skin.field}`}
          />
          <button
            type="button"
            onClick={post}
            disabled={!body.trim() || posting}
            className={`flex min-h-11 items-center self-end px-3 font-mono text-d11 font-bold uppercase tracking-widest transition-colors disabled:opacity-40 ${skin.cta} ${FOCUS_BASE} ${skin.focus}`}
          >
            {posting ? 'ENVIANDO…' : 'ENVIAR'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => openLogin()}
          className={`flex min-h-11 items-center self-start px-3 font-mono text-d11 font-bold uppercase tracking-widest transition-colors ${skin.ghost} ${FOCUS_BASE} ${skin.focus}`}
        >
          INICIA SESIÓN PARA COMENTAR
        </button>
      )}
    </div>
  )
}
