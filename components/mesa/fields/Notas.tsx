'use client'

/**
 * NOTAS AL PIE — each note has an id; write `[^id]` in the body where the
 * call goes. The table tells you which notes are cited and which calls in
 * the text point nowhere.
 */

import { useState } from 'react'
import type { ArticleBlock, Footnote } from '@/lib/types'
import { Mark } from '@/components/kit/Glyph'
import { IconBtn } from './bits'
import b from './blocks.module.css'
import f from './fields.module.css'

function refsIn(blocks: ArticleBlock[]): Set<string> {
  const out = new Set<string>()
  for (const blk of blocks) {
    const t = 'text' in blk ? blk.text : blk.kind === 'list' ? blk.items.join(' ') : ''
    for (const m of t.matchAll(/\[\^([^\]]+)\]/g)) out.add(m[1])
  }
  return out
}

export function Notas({ value, onChange, blocks }: { value: Footnote[]; onChange: (v: Footnote[]) => void; blocks: ArticleBlock[] }) {
  const [copied, setCopied] = useState<string | null>(null)
  const cited = refsIn(blocks)
  const ids = new Set(value.map((n) => n.id))
  const orphans = [...cited].filter((r) => !ids.has(r))

  const add = () => {
    let n = value.length + 1
    while (ids.has(`n${n}`)) n++
    onChange([...value, { id: `n${n}`, text: '' }])
    requestAnimationFrame(() => document.getElementById(`mesa-note-${value.length}`)?.focus())
  }

  const copy = async (id: string) => {
    try {
      await navigator.clipboard.writeText(`[^${id}]`)
    } catch {
      /* the reference is visible anyway */
    }
    setCopied(id)
    window.setTimeout(() => setCopied(null), 1400)
  }

  return (
    <div className={f.stack} style={{ gap: 12 }}>
      <p className={f.note}>
        Escribe <span className={f.mono}>[^n1]</span> en el texto donde quieras la llamada; aquí va lo que dice. En la lectura se numeran solas.
      </p>
      {value.length ? (
        <div className={f.rows}>
          {value.map((n, i) => (
            <div key={i} className={b.note}>
              <button type="button" className={b.ref} onClick={() => copy(n.id)} title="Copiar la referencia">
                {copied === n.id ? <Mark name="check" size={12} /> : null}[^{n.id || '?'}]
              </button>
              <input
                id={`mesa-note-${i}`}
                className={f.cell}
                value={n.text}
                placeholder="Lo que dice la nota…"
                aria-label={`Texto de la nota ${n.id}`}
                onChange={(e) => onChange(value.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))}
              />
              <span className={b.cited} data-no={!cited.has(n.id) || undefined}>
                {cited.has(n.id) ? 'citada' : 'sin llamada'}
              </span>
              <IconBtn label={`Quitar la nota ${n.id}`} onClick={() => onChange(value.filter((_, k) => k !== i))}>
                <Mark name="close" size={12} />
              </IconBtn>
            </div>
          ))}
        </div>
      ) : null}
      <button type="button" className={f.add} onClick={add}>
        <Mark name="plus" size={13} /> Nota
      </button>
      {orphans.length ? (
        <p className={f.warn}>
          El texto llama a {orphans.map((o) => `[^${o}]`).join(', ')}, {orphans.length === 1 ? 'que no existe' : 'que no existen'} aquí.
        </p>
      ) : null}
    </div>
  )
}
