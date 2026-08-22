'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, ExternalLink } from 'lucide-react'
import type { EmbedPlatform, MixEmbed } from '@/lib/types'
import {
  PLATFORM_LABELS,
  PLATFORM_ORDER,
  detectPlatform,
  MIXCLOUD_UNSUPPORTED_NOTE,
} from '@/components/embed/platforms'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'

// ── EmbedListL — pliego fork of forms/shared/Fields.tsx EmbedList ───────────
//
// The dark original stays byte-untouched. Logic is verbatim, including the
// multi-URL smart paste (whitespace/newline-separated URLs split into rows
// with auto-detected platforms) and the live platform sync while typing.
// Only the chrome is pliego.

export function EmbedListL({
  embeds,
  onChange,
}: {
  embeds: MixEmbed[]
  onChange: (next: MixEmbed[]) => void
}) {
  const [focusIndex, setFocusIndex] = useState<number | null>(null)

  const add = (initialUrl = '') => {
    const platform =
      (initialUrl ? detectPlatform(initialUrl) : null) ?? 'soundcloud'
    onChange([...embeds, { platform, url: initialUrl }])
    setFocusIndex(embeds.length)
  }
  const update = (i: number, patch: Partial<MixEmbed>) =>
    onChange(embeds.map((e, idx) => (idx === i ? { ...e, ...patch } : e)))
  const remove = (i: number) => onChange(embeds.filter((_, idx) => idx !== i))

  // Smart paste: if the pasted text contains multiple URLs (whitespace or
  // newline separated), split them into rows with auto-detected platforms.
  const handlePaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    i: number,
  ) => {
    const text = e.clipboardData.getData('text').trim()
    if (!text) return
    const urls = text
      .split(/[\s\n]+/)
      .map((u) => u.trim())
      .filter((u) => /^https?:\/\//i.test(u))
    if (urls.length <= 1) return // default single-URL paste
    e.preventDefault()
    const next = embeds.slice()
    // First URL replaces the current row; rest append after.
    next[i] = {
      url: urls[0],
      platform: detectPlatform(urls[0]) ?? embeds[i]?.platform ?? 'soundcloud',
    }
    for (const extra of urls.slice(1)) {
      next.push({
        url: extra,
        platform: detectPlatform(extra) ?? 'soundcloud',
      })
    }
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-2">
      {embeds.length === 0 && (
        <p className="font-mono text-d11 text-ink-faint">
          Sin fuentes. Añade al menos una para habilitar ABRIR FUENTE.
        </p>
      )}
      {embeds.map((e, i) => (
        <EmbedRowL
          key={i}
          embed={e}
          shouldFocus={focusIndex === i}
          onFocused={() => setFocusIndex(null)}
          onChange={(patch) => update(i, patch)}
          onRemove={() => remove(i)}
          onPaste={(ev) => handlePaste(ev, i)}
        />
      ))}
      <button
        type="button"
        onClick={() => add()}
        className={`flex min-h-11 items-center gap-2 self-start border border-dashed border-ink px-3 font-mono text-d11 uppercase tracking-widest text-ink hover:bg-ink hover:text-paper md:min-h-9 ${FOCUS_RING}`}
      >
        <Plus size={12} strokeWidth={2} /> AÑADIR FUENTE
      </button>
      {embeds.length === 0 && (
        <p className="font-mono text-d11 leading-relaxed text-ink-faint">
          Tip: pega varias URLs separadas por salto de línea y se añaden en
          filas con plataforma auto-detectada.
        </p>
      )}
      <p className="font-mono text-d11 leading-relaxed text-ink-faint">
        SoundCloud · YouTube · Mixcloud · Spotify se reproducen en el
        reproductor de Gradiente. Bandcamp solo abre como enlace externo.
      </p>
    </div>
  )
}

function EmbedRowL({
  embed,
  shouldFocus,
  onFocused,
  onChange,
  onRemove,
  onPaste,
}: {
  embed: MixEmbed
  shouldFocus: boolean
  onFocused: () => void
  onChange: (patch: Partial<MixEmbed>) => void
  onRemove: () => void
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (shouldFocus && ref.current) {
      ref.current.focus()
      onFocused()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldFocus])

  const detected = embed.url ? detectPlatform(embed.url) : null
  const mismatch = detected && detected !== embed.platform

  return (
    <div className="grid grid-cols-[120px_1fr_auto] gap-2 border border-dashed border-ink-faint p-2">
      <select
        value={embed.platform}
        onChange={(ev) =>
          onChange({ platform: ev.target.value as EmbedPlatform })
        }
        aria-label="Plataforma de la fuente"
        className={`min-h-11 border bg-paper-raised px-2 font-mono text-d11 uppercase tracking-widest ${
          mismatch ? 'border-sys-red-paper text-sys-red-paper' : 'border-ink text-ink'
        } ${FOCUS_RING}`}
      >
        {PLATFORM_ORDER.map((p) => (
          <option key={p} value={p}>
            {PLATFORM_LABELS[p]}
          </option>
        ))}
      </select>
      <input
        ref={ref}
        type="text"
        value={embed.url}
        onChange={(ev) => {
          const url = ev.target.value
          const det = detectPlatform(url)
          // Live-sync platform to detected value as the user types / pastes —
          // removes friction of manually picking from the dropdown.
          if (det && det !== embed.platform) {
            onChange({ url, platform: det })
          } else {
            onChange({ url })
          }
        }}
        onPaste={onPaste}
        placeholder="https://soundcloud.com/…"
        className={`min-h-11 min-w-0 border bg-paper-raised px-2 font-mono text-d13 text-ink placeholder:text-ink-faint ${
          mismatch ? 'border-sys-red-paper' : 'border-ink'
        } ${FOCUS_RING}`}
      />
      <div className="flex items-center gap-1.5">
        {embed.url && (
          <a
            href={embed.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Abrir fuente"
            className={`flex h-11 w-11 items-center justify-center border border-ink text-ink hover:bg-ink hover:text-paper md:h-9 md:w-9 ${FOCUS_RING}`}
          >
            <ExternalLink size={13} strokeWidth={2} />
          </a>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label="Eliminar fuente"
          className={`flex h-11 w-11 items-center justify-center border border-ink text-ink hover:border-sys-red-paper hover:bg-sys-red-paper hover:text-paper md:h-9 md:w-9 ${FOCUS_RING}`}
        >
          <Trash2 size={13} strokeWidth={2} />
        </button>
      </div>
      {embed.platform === 'mixcloud' && (
        <p
          className="font-mono text-d11 leading-relaxed text-ink-soft"
          style={{ gridColumn: '1 / -1' }}
        >
          {'// '}
          {MIXCLOUD_UNSUPPORTED_NOTE}
        </p>
      )}
    </div>
  )
}
