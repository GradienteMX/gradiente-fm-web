'use client'

/**
 * BUSCADOR — `/` from anywhere. Plain substring search over everything
 * that lives here (titles, venues, artists, bylines, genres, franjas).
 * Your own drafts come first. ↑↓ to move, ↵ to open, Esc to leave.
 * Printed as a ledger: one indexical head per kind, the format code on its
 * stock, titles set at their piece's energy; the row you're on inverts.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUI } from '@/lib/store/ui'
import { useItems, useWorld } from '@/lib/store/world'
import { useMe } from '@/lib/store/session'
import { getGenreNames } from '@/lib/genres'
import { effectiveBand, energyVariation } from '@/lib/vibe'
import { Sheet } from '@/components/kit/Sheet'
import { FormatGlyph, FORMAT_CODE, FORMAT_LABEL, FORMAT_ON, FORMAT_STOCK, Mark } from '@/components/kit/Glyph'
import { BandChip, Kbd } from '@/components/kit/Bits'
import { Avatar } from '@/components/kit/Persona'
import type { ContentItem } from '@/lib/types'
import styles from './Buscador.module.css'

const two = (n: number) => String(n).padStart(2, '0')

const GROUP_NAME: Record<Result['kind'], string> = {
  draft: 'Borradores',
  user: 'Personas',
  item: 'Piezas',
  thread: 'Hilos',
}

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

function haystack(i: ContentItem): string {
  return norm(
    [i.title, i.subtitle, i.venue, i.venueCity, i.author, i.mixSeries, ...(i.artists ?? []), ...getGenreNames(i.genres)].filter(Boolean).join(' · '),
  )
}

export function Buscador() {
  const open = useUI((s) => s.searchOpen)
  const setOpen = useUI((s) => s.setSearch)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      e.preventDefault()
      setOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])

  return (
    <Sheet open={open} onClose={() => setOpen(false)} label="Buscar" variant="top" width={720} z={90}>
      {open ? <Body onClose={() => setOpen(false)} /> : null}
    </Sheet>
  )
}

type Result =
  | { kind: 'draft'; item: ContentItem; draftId: string }
  | { kind: 'item'; item: ContentItem; draftId: null }
  | { kind: 'user'; id: string; title: string; sub: string; href: string }
  | { kind: 'thread'; id: string; title: string; sub: string; href: string }

function Body({ onClose }: { onClose: () => void }) {
  const items = useItems()
  const me = useMe()
  const drafts = useWorld((s) => s.world.drafts)
  const users = useWorld((s) => s.world.users)
  const threads = useWorld((s) => s.world.threads)
  const openLectura = useUI((s) => s.openLectura)
  const router = useRouter()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const list = useRef<HTMLDivElement>(null)

  const index = useMemo(() => items.map((i) => ({ i, h: haystack(i) })), [items])

  const results = useMemo<Result[]>(() => {
    const nq = norm(q.trim())
    if (nq.length < 2) return []
    const mine: Result[] = me
      ? Object.values(drafts)
          .filter((d) => d.authorId === me.id && norm(d.item.title).includes(nq))
          .map((d) => ({ kind: 'draft' as const, item: d.item, draftId: d.id }))
      : []
    const people: Result[] = Object.values(users)
      .filter((u) => norm(`${u.username} ${u.displayName}`).includes(nq))
      .slice(0, 4)
      .map((u) => ({ kind: 'user' as const, id: u.id, title: u.displayName, sub: `@${u.username}`, href: `/u/${u.username}` }))
    const found: Result[] = index
      .filter((x) => x.h.includes(nq))
      .sort((a, b) => Number(norm(b.i.title).startsWith(nq)) - Number(norm(a.i.title).startsWith(nq)))
      .slice(0, 30)
      .map((x) => ({ kind: 'item' as const, item: x.i, draftId: null }))
    const hilos: Result[] = Object.values(threads)
      .filter((t) => !t.deletion && norm(`${t.subject} ${t.body}`).includes(nq))
      .slice(0, 4)
      .map((t) => ({ kind: 'thread' as const, id: t.id, title: t.subject, sub: 'Hilo del foro', href: `/foro?hilo=${t.id}` }))
    return [...mine, ...people, ...found, ...hilos]
  }, [q, index, drafts, me, users, threads])

  // A new query starts the walk at the top.
  const search = (v: string) => {
    setQ(v)
    setSel(0)
  }

  const go = (r: Result) => {
    onClose()
    if (r.kind === 'draft') router.push(`/taller/mesa?draft=${r.draftId}`)
    else if (r.kind === 'user' || r.kind === 'thread') router.push(r.href)
    else openLectura(r.item.slug)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSel((s) => Math.min(results.length - 1, s + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSel((s) => Math.max(0, s - 1))
    } else if (e.key === 'Enter' && results[sel]) {
      e.preventDefault()
      go(results[sel])
    }
  }

  useEffect(() => {
    list.current?.querySelector(`[data-i="${sel}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  // One printed section per kind, in the order the flat list runs — the
  // keyboard walks the flat index straight through the heads.
  const groups = useMemo(() => {
    const out: Array<{ kind: Result['kind']; rows: Array<{ r: Result; idx: number }> }> = []
    results.forEach((r, idx) => {
      const last = out[out.length - 1]
      if (last && last.kind === r.kind) last.rows.push({ r, idx })
      else out.push({ kind: r.kind, rows: [{ r, idx }] })
    })
    return out
  }, [results])

  const row = (r: Result, idx: number) => {
    const common = {
      type: 'button' as const,
      className: styles.row,
      'data-i': idx,
      'data-sel': idx === sel || undefined,
      onMouseEnter: () => setSel(idx),
      onClick: () => go(r),
    }
    if (r.kind === 'user') {
      const u = users[r.id]
      return (
        <li key={`${r.kind}-${r.id}`} id={`r-${idx}`} role="option" aria-selected={idx === sel}>
          <button {...common}>
            <span className={styles.cell}>{u ? <Avatar user={u} size={26} /> : <Mark name="dot" size={14} />}</span>
            <span className={styles.text}>
              <span className={styles.name}>{r.title}</span>
              <span className={styles.meta}>Persona · {r.sub}</span>
            </span>
          </button>
        </li>
      )
    }
    if (r.kind === 'thread') {
      return (
        <li key={`${r.kind}-${r.id}`} id={`r-${idx}`} role="option" aria-selected={idx === sel}>
          <button {...common}>
            <span className={styles.cell}>
              <span className={styles.code} data-kind="hilo">
                <Mark name="comments" size={10} />
                HI
              </span>
            </span>
            <span className={styles.text}>
              <span className={styles.name}>{r.title}</span>
              <span className={styles.meta}>{r.sub}</span>
            </span>
          </button>
        </li>
      )
    }
    const b = effectiveBand(r.item)
    const mid = (b.min + b.max) / 2
    return (
      <li key={`${r.kind}-${r.item.id}`} id={`r-${idx}`} role="option" aria-selected={idx === sel}>
        <button {...common}>
          <span className={styles.cell}>
            <span className={styles.code} data-draft={r.kind === 'draft' || undefined} style={{ ['--stock' as string]: FORMAT_STOCK[r.item.type], ['--stock-on' as string]: FORMAT_ON[r.item.type] }}>
              <FormatGlyph type={r.item.type} size={10} />
              {FORMAT_CODE[r.item.type]}
            </span>
          </span>
          <span className={styles.text}>
            <span className={styles.title} style={{ fontVariationSettings: energyVariation(mid) }}>
              {r.kind === 'draft' ? <span className="sr-only">Borrador: </span> : null}
              {r.item.title}
            </span>
            <span className={styles.meta}>
              {FORMAT_LABEL[r.item.type]}
              {r.item.venue ? ` · ${r.item.venue}` : ''}
              {r.item.author ? ` · ${r.item.author}` : ''}
            </span>
          </span>
          {r.item.type !== 'franja' ? (
            <span className={styles.bandCell}>
              <BandChip min={b.min} max={b.max} />
            </span>
          ) : null}
        </button>
      </li>
    )
  }

  const typing = q.trim().length < 2

  return (
    <div className={styles.body} onKeyDown={onKey}>
      <div className={styles.bar}>
        <span className={styles.barMark} aria-hidden="true">
          <Mark name="search" size={20} />
        </span>
        <input
          className={styles.input}
          value={q}
          onChange={(e) => search(e.target.value)}
          placeholder="Busca piezas, noches, artistas, franjas…"
          aria-label="Buscar"
          data-autofocus=""
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls="buscador-list"
          aria-activedescendant={results[sel] ? `r-${sel}` : undefined}
        />
        {q ? (
          <button type="button" className={styles.clear} onClick={() => search('')}>
            Limpiar
          </button>
        ) : null}
      </div>
      <p className={styles.status} data-empty={(!typing && !results.length) || undefined}>
        {typing ? (
          <>
            <span>Escribe al menos dos letras</span>
            <span className={styles.keys}>
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> moverte
            </span>
            <span className={styles.keys}>
              <Kbd>↵</Kbd> abrir
            </span>
            <span className={styles.keys}>
              <Kbd>Esc</Kbd> salir
            </span>
          </>
        ) : results.length ? (
          <>
            <span className={styles.count}>{two(results.length)}</span>
            {results.length === 30 ? '+' : ''} resultados
          </>
        ) : (
          'Nada con ese nombre aquí todavía.'
        )}
      </p>
      <div className={styles.list} ref={list} id="buscador-list" role="listbox" aria-label="Resultados">
        {groups.map((g, gi) => {
          const n = g.rows.length
          const more = g.kind === 'item' && n === 30
          return (
            <div key={g.kind} className={styles.group} role="group" aria-labelledby={`buscador-g-${g.kind}`}>
              <p id={`buscador-g-${g.kind}`} className={styles.groupHead}>
                <span className={styles.gn}>{two(gi + 1)}</span>
                <span className={styles.slash}>/</span>
                <span className={styles.gname}>{GROUP_NAME[g.kind]}</span>
                <span className={styles.grest}>
                  — {two(n)}
                  {more ? '+' : ''}
                  {g.kind === 'draft' ? ' · solo tú los ves' : ''}
                </span>
              </p>
              <ul className={styles.rows} role="presentation">
                {g.rows.map(({ r, idx }) => row(r, idx))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
