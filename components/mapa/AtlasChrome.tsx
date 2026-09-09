'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { Crosshair, Hand, HelpCircle, Minus, Plus, X } from 'lucide-react'
import type { ContentItem } from '@/lib/types'
import type { FranjaCluster } from '@/lib/mapa/layout'

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-text'
const CONTROL = `flex min-h-10 items-center justify-center gap-2 px-3 font-mono text-[11px] uppercase tracking-wider hover:bg-paper hover:text-ink ${FOCUS}`

interface AtlasChromeProps {
  focusTitle: string | null
  focusSlug: string | null
  affinityOn: boolean
  zoom: number
  clusters: FranjaCluster[]
  inertFranjas: ContentItem[]
  franjasOpen: boolean
  onToggleFranjas: () => void
  onSelectFranja: (slug: string) => void
  onZoom: (factor: number) => void
  onFit: () => void
  helpOpen: boolean
  onToggleHelp: () => void
}

export function AtlasChrome({ focusTitle, focusSlug, affinityOn, zoom, clusters, inertFranjas, franjasOpen, onToggleFranjas, onSelectFranja, onZoom, onFit, helpOpen, onToggleHelp }: AtlasChromeProps) {
  const [query, setQuery] = useState('')
  const helpButton = useRef<HTMLButtonElement>(null)
  const franjaButton = useRef<HTMLButtonElement>(null)
  const matches = (title: string) => title.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es').trim())
  const found = clusters.filter((c) => matches(c.franja.title))
  const dormant = inertFranjas.filter((p) => matches(p.title))
  return <>
    <header data-mapa-ui className="absolute inset-x-4 top-3 z-40 flex h-11 cursor-auto items-center gap-5 bg-ink px-4 text-paper">
      <Link href="/" className={`shrink-0 font-syne text-[25px] font-extrabold tracking-tight ${FOCUS}`}>GRADIENTE</Link>
      <nav aria-label="Navegación principal" className="hidden h-full items-center lg:flex">
        {([['INICIO', '/'], ['AGENDA', '/agenda'], ['FORO', '/foro'], ['MERCADO', '/marketplace']] as const).map(([label, href]) => <Link key={href} href={href} className={CONTROL}>{label}</Link>)}
        <span aria-current="page" className="mx-2 bg-acid px-4 py-2 font-mono text-[11px] font-bold tracking-widest text-ink">MAPA</span>
      </nav>
      <span role="status" className="ml-auto hidden max-w-[260px] truncate border-l border-paper/40 pl-4 font-mono text-[10px] uppercase tracking-wider xl:block">{focusTitle ? `ENFOQUE · ${focusTitle}` : affinityOn ? 'GLOBAL · AFINIDAD' : 'VISTA GLOBAL'}</span>
      <div className="relative ml-auto xl:ml-0">
        <button ref={franjaButton} type="button" onClick={onToggleFranjas} aria-expanded={franjasOpen} aria-controls="mapa-franjas" className={`${CONTROL} ${focusSlug ? 'bg-acid text-ink' : 'border border-paper/40'}`}>◎ FRANJAS</button>
        {franjasOpen && <section onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onToggleFranjas(); franjaButton.current?.focus() } }} id="mapa-franjas" aria-label="Elegir franja" className="absolute right-0 top-full mt-2 w-80 border border-ink bg-paper text-ink shadow-lift">
          <div className="border-b border-ink/30 p-3"><label htmlFor="mapa-franja-search" className="mb-2 block font-mono text-[10px] tracking-widest">BUSCAR FRANJA</label><input autoFocus id="mapa-franja-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nombre de la franja…" className="w-full border border-ink bg-paper-raised px-2 py-2 font-mono text-[12px] outline-offset-2 focus:outline-ink" /></div>
          <div className="max-h-[55dvh] overflow-y-auto p-2">
            <p className="p-2 font-mono text-[10px] text-ink-faint">EXPLORAR SU TERRENO</p>
            {found.map((c) => <button key={c.franja.id} type="button" onClick={() => onSelectFranja(c.franja.slug)} aria-pressed={focusSlug === c.franja.slug} className={`flex min-h-11 w-full items-center gap-3 px-2 text-left font-mono text-[11px] focus-visible:outline-ink ${focusSlug === c.franja.slug ? 'bg-acid' : 'hover:bg-ink hover:text-paper'}`}>
              {/* Native logo thumbnails also accept arbitrary franja image hosts. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {c.franja.imageUrl && <img src={c.franja.imageUrl} alt="" className="h-7 w-7 object-cover" />}
              <span className="flex-1 truncate">{c.franja.title}</span><span aria-label={`${c.itemIds.length} publicaciones`}>{c.itemIds.length}</span>
            </button>)}
            {found.length === 0 && <p className="p-2 font-mono text-[11px]">Sin terreno coincidente.</p>}
            {dormant.length > 0 && <details className="mt-2 border-t border-ink/30"><summary className="cursor-pointer p-2 font-mono text-[10px]">DOSSIERS SIN TERRENO ({dormant.length})</summary>{dormant.map((p) => <Link key={p.id} href={`/f/${p.slug}`} className="block px-2 py-2 font-mono text-[11px] hover:bg-ink hover:text-paper">{p.title} ↗</Link>)}</details>}
          </div>
        </section>}
      </div>
    </header>

    <div aria-hidden className="pointer-events-none absolute left-6 top-[76px] z-10 bg-paper pb-3 pr-5 text-ink">
      <p className="font-syne text-[clamp(56px,4.5vw,76px)] font-extrabold leading-[0.82] tracking-[-0.07em]">MAPA</p>
      <p className="mt-3 font-mono text-[10px] tracking-[0.15em]">ESCENA EN MOVIMIENTO</p>
    </div>
    <div aria-hidden className="pointer-events-none absolute bottom-20 left-5 -z-0 origin-bottom-left -rotate-90 font-syne text-[120px] font-extrabold leading-none tracking-tight text-ink/[0.045]">GRADIENTE</div>

    <footer data-mapa-ui className="absolute inset-x-4 bottom-3 z-40 flex h-12 cursor-auto items-center justify-between gap-3 bg-ink px-3 text-paper">
      <span className="hidden items-center gap-3 px-2 font-mono text-[10px] tracking-widest lg:flex"><Hand size={18} aria-hidden />ARRASTRAR · MOVER</span>
      <div className="flex items-center border border-paper/40">
        <button type="button" aria-label="Alejar" disabled={zoom <= 0.06} onClick={() => onZoom(1 / 1.35)} className={`${CONTROL} disabled:opacity-40`}><Minus size={16} /></button>
        <output aria-label="Nivel de zoom" className="min-w-12 text-center font-mono text-[11px] tabular-nums">{Math.round(zoom * 100)}%</output>
        <button type="button" aria-label="Acercar" disabled={zoom >= 1.6} onClick={() => onZoom(1.35)} className={`${CONTROL} disabled:opacity-40`}><Plus size={16} /></button>
      </div>
      <button type="button" onClick={onFit} className={CONTROL}><Crosshair size={18} />ENCUADRAR</button>
      <button ref={helpButton} type="button" onClick={onToggleHelp} aria-expanded={helpOpen} aria-controls="mapa-help" className={CONTROL}><HelpCircle size={18} />AYUDA</button>
      <span className="ml-auto hidden font-mono text-[10px] tracking-widest text-paper/65 xl:block">{focusTitle ? 'ESC · SALIR DEL ENFOQUE' : 'CONTENIDO · CONEXIONES · ESCENA'}</span>
    </footer>
    {helpOpen && <section onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onToggleHelp(); helpButton.current?.focus() } }} id="mapa-help" data-mapa-ui aria-label="Cómo explorar el mapa" className="absolute bottom-[76px] left-1/2 z-40 w-[410px] -translate-x-1/2 cursor-auto border border-ink bg-paper-raised p-5 text-ink shadow-lift">
      <div className="mb-4 flex items-center justify-between"><h2 className="font-syne text-xl font-extrabold">EXPLORAR EL MAPA</h2><button type="button" aria-label="Cerrar ayuda" onClick={() => { onToggleHelp(); helpButton.current?.focus() }} className="p-2 hover:bg-ink hover:text-paper"><X size={18} /></button></div>
      <dl className="space-y-3 font-mono text-[11px] leading-relaxed">
        <div><dt className="font-bold">MOVER / ACERCAR</dt><dd>Arrastra o desplaza con dos dedos. Ctrl / ⌘ + rueda para zoom. Doble clic en un hueco para acercarte.</dd></div>
        <div><dt className="font-bold">CONTENIDO / TECLADO</dt><dd>Pasa por una pieza para leerla; clic o Enter para abrir. Flechas para recorrer vecinas, Alt para las otras diagonales.</dd></div>
        <div><dt className="font-bold">FRANJAS / AFINIDAD</dt><dd>Una franja reúne su contenido. Afinidad separa grupos conectados por sus datos. Escape regresa al terreno global.</dd></div>
        <div><dt className="font-bold">CAPAS</dt><dd>Desactiva un tipo para ocultarlo. Las piezas restantes se reagrupan en la vista global.</dd></div>
      </dl>
    </section>}
  </>
}
