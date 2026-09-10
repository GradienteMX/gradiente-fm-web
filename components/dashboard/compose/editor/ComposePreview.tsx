'use client'
import { useState } from 'react'
import type { ArticleBlock, ContentItem } from '@/lib/types'
import { BodyBlocks } from '@/components/overlay/ArticuloOverlay'
import { ContentCardPreview } from '@/components/cards/ContentCard'
import { VibeMeterLight } from '@/components/dashboard/widgets/shared/VibeMeterLight'
import { categoryColorOnLight, typeDisplayLabel } from '@/lib/dashboard/palette'
import { usableUrl } from '@/lib/contentReadiness'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'

export function ComposePreview({ draft, full = false }: { draft: ContentItem; full?: boolean }) {
  const [mode, setMode] = useState<'card' | 'reading'>(full ? 'reading' : 'card')
  const item = { ...draft, title: draft.title.trim() || 'Sin título' }
  const blocks: ArticleBlock[] = draft.articleBody?.length ? draft.articleBody : (draft.bodyPreview ?? '').split(/\n\s*\n/).filter((p) => p.trim()).map((text) => ({ kind: 'p', text }))
  return <section aria-label="Vista previa del borrador" className="min-w-0">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-ink pb-4">
      <h2 className="font-mono text-d13 font-bold uppercase tracking-widest">Así se verá</h2>
      <div className="flex" role="group" aria-label="Formato de vista previa">
        {(['card', 'reading'] as const).map((value) => <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)} className={`min-h-11 border border-ink px-3 text-d13 ${mode === value ? 'bg-ink text-paper' : 'bg-paper text-ink'} ${FOCUS_RING}`}>{value === 'card' ? 'Tarjeta' : 'Lectura'}</button>)}
      </div>
    </div>
    {mode === 'card' ? <div className="mx-auto max-w-lg">
      <div className="h-[390px]"><ContentCardPreview item={item} /></div>
      <p className="mt-3 font-grotesk text-d15 text-ink-soft">{draft.excerpt || 'El resumen de tu pieza aparecerá aquí.'}</p>
      <div className="mt-4"><VibeMeterLight band={[draft.vibeMin, draft.vibeMax]} /></div>
    </div> : <article className="overflow-hidden border border-ink bg-paper-raised">
      {draft.imageUrl && <figure>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={draft.imageUrl} alt={draft.title ? `Portada de ${draft.title}` : 'Portada del borrador'} className="max-h-[420px] w-full object-contain" />
        {draft.heroCaption && <figcaption className="px-6 pt-2 text-d13 text-ink-soft">{draft.heroCaption}</figcaption>}
      </figure>}
      <div className="p-5 md:p-9">
        <p className="mb-3 font-mono text-d11 uppercase tracking-widest">{typeDisplayLabel(draft.type)} · Vista previa</p>
        <h2 className="break-words font-syne text-d28 font-extrabold leading-tight md:text-4xl">{item.title}</h2>
        {(draft.subtitle || draft.excerpt) && <p className="mt-4 font-grotesk text-d18 leading-relaxed text-ink-soft">{draft.subtitle || draft.excerpt}</p>}
        {draft.author && <p className="my-5 border-y border-ink py-3 text-d13">Por {draft.author}</p>}
        {draft.type === 'evento' && <dl className="my-6 grid gap-3 border-y border-ink py-5 text-d15">
          <div><dt className="font-bold">Fecha y hora</dt><dd>{draft.date?.replace('T', ' ').slice(0, 16) || 'Por definir'}{draft.endDate ? ` → ${draft.endDate.replace('T', ' ').slice(0, 16)}` : ''}</dd></div>
          <div><dt className="font-bold">Lugar</dt><dd>{[draft.venue, draft.venueCity].filter(Boolean).join(' · ') || 'Por definir'}</dd></div>
          {!!draft.artists?.length && <div><dt className="font-bold">Artistas</dt><dd>{draft.artists.join(' · ')}</dd></div>}
          {draft.price && <div><dt className="font-bold">Entradas</dt><dd>{draft.price}</dd></div>}
        </dl>}
        <div className="my-6"><BodyBlocks blocks={blocks} color={categoryColorOnLight(draft.type)} /></div>
        {draft.type === 'mix' && <div className="my-6">
          <p className="mb-3 font-bold">Audio{draft.duration ? ` · ${draft.duration}` : ''}</p>
          {(draft.embeds ?? []).filter((e) => usableUrl(e.url)).map((e, i) => <a key={`${i}:${e.url}`} href={e.url} target="_blank" rel="noreferrer" className={`mb-2 block min-h-11 border border-ink px-3 py-3 text-d13 underline ${FOCUS_RING}`}>Probar audio en {e.platform} ↗</a>)}
          {!!draft.tracklist?.length && <ol className="mt-5 divide-y divide-ink/20">{draft.tracklist.map((track, i) => <li key={i} className="py-3 text-d15"><span className="mr-3 font-mono text-d11">{String(i + 1).padStart(2, '0')}</span>{track.artist} — {track.title}</li>)}</ol>}
        </div>}
        {!!draft.footnotes?.length && <ol className="mt-6 border-t border-ink pt-4 text-d13">{draft.footnotes.map((note) => <li id={`fn-${note.id}`} key={note.id} className="mb-3">{note.id}. {note.text}</li>)}</ol>}
        <VibeMeterLight band={[draft.vibeMin, draft.vibeMax]} />
        {draft.poll && <aside className="mt-6 border-t border-ink pt-4"><p className="font-mono text-d11">Encuesta · sin votación en la vista previa</p><p className="mt-2 text-d18">{draft.poll.prompt}</p>{draft.poll.choices?.map((choice) => <p key={choice.id} className="mt-2 border border-ink p-3 text-d15">{choice.label}</p>)}</aside>}
      </div>
    </article>}
    <p className="mt-4 font-mono text-d11 leading-relaxed text-ink-soft">Esta vista previa no publica tu pieza. La tarjeta puede cambiar de tamaño en el feed.</p>
  </section>
}
