'use client'
import { useEffect, useRef, useState } from 'react'
import type { MixEmbed } from '@/lib/types'
import { PLATFORM_LABELS, PLATFORM_ORDER, detectPlatform, isPlayablePlatform } from '@/components/embed/platforms'
import { usableUrl } from '@/lib/contentReadiness'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'

export function EmbedListL({ embeds, onChange }: { embeds: MixEmbed[]; onChange: (next: MixEmbed[]) => void }) {
  const [focusIndex, setFocusIndex] = useState<number | null>(null)
  const displayed: MixEmbed[] = embeds.length ? embeds : [{ platform: 'soundcloud', url: '' }]
  const update = (i: number, patch: Partial<MixEmbed>) => onChange(displayed.map((e, index) => index === i ? { ...e, ...patch } : e))
  return <div className="grid gap-4">
    <p className="text-d15 leading-relaxed text-ink-soft">Pega el enlace de tu mix. Reconocemos la plataforma; comprueba que el audio esté disponible.</p>
    {displayed.map((embed, i) => <SourceRow key={i} embed={embed} index={i} focus={focusIndex === i} onFocused={() => setFocusIndex(null)} onChange={(patch) => update(i, patch)}
      onRemove={() => onChange(embeds.filter((_, index) => index !== i))}
      onPaste={(e) => {
        const urls = e.clipboardData.getData('text').trim().split(/\s+/).filter(usableUrl)
        if (urls.length < 2) return
        e.preventDefault()
        const next = displayed.slice()
        next.splice(i, 1, ...urls.map((url) => ({ url, platform: detectPlatform(url) ?? 'soundcloud' as const })))
        onChange(next)
      }} />)}
    <button type="button" onClick={() => { onChange([...displayed, { platform: 'soundcloud', url: '' }]); setFocusIndex(displayed.length) }} className={`min-h-11 w-fit border border-ink px-4 text-d13 ${FOCUS_RING}`}>+ Añadir otra fuente</button>
    <p className="text-d13 leading-relaxed text-ink-soft">SoundCloud, YouTube y Spotify pueden reproducirse en Gradiente. Bandcamp y Mixcloud se abren en su sitio. Puedes pegar varios enlaces, uno por línea.</p>
  </div>
}

function SourceRow({ embed, index, focus, onFocused, onChange, onRemove, onPaste }: {
  embed: MixEmbed; index: number; focus: boolean; onFocused: () => void; onChange: (patch: Partial<MixEmbed>) => void;
  onRemove: () => void; onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { if (focus) { input.current?.focus(); onFocused() } }, [focus, onFocused])
  const detected = detectPlatform(embed.url)
  const valid = usableUrl(embed.url)
  return <div className="min-w-0 border-b border-ink/20 pb-4">
    <label className="grid gap-2 text-d15 font-bold">{index === 0 ? 'Enlace del audio' : `Otra fuente ${index + 1}`}
      <input ref={input} type="url" value={embed.url} onPaste={onPaste} placeholder="https://soundcloud.com/tu-perfil/tu-mix"
        onChange={(e) => { const url = e.target.value; onChange({ url, platform: detectPlatform(url) ?? embed.platform }) }}
        className={`min-h-12 min-w-0 w-full border border-ink bg-paper-raised px-3 font-normal ${FOCUS_RING}`} />
    </label>
    {embed.url && <>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-d13 text-ink-soft">{detected ? `${PLATFORM_LABELS[detected]} · ${isPlayablePlatform(detected) ? 'plataforma detectada' : 'enlace externo'}` : valid ? 'Enlace externo · plataforma sin reconocer' : 'Incluye el enlace completo, empezando por https://'}</p>
        {valid && <a href={embed.url} target="_blank" rel="noreferrer" className={`inline-flex min-h-11 items-center border border-ink px-3 text-d13 ${FOCUS_RING}`}>Probar audio ↗</a>}
      </div>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <details><summary className={`min-h-11 cursor-pointer py-3 text-d13 text-ink-soft ${FOCUS_RING}`}>Ajustar plataforma</summary>
          <select aria-label={`Plataforma de la fuente ${index + 1}`} value={embed.platform} onChange={(e) => onChange({ platform: e.target.value as MixEmbed['platform'] })} className={`min-h-11 border border-ink bg-paper px-3 text-d13 ${FOCUS_RING}`}>{PLATFORM_ORDER.map((p) => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}</select>
        </details>
        <button type="button" onClick={onRemove} className={`min-h-11 text-d13 text-ink-soft underline ${FOCUS_RING}`}>Quitar fuente</button>
      </div>
    </>}
  </div>
}
