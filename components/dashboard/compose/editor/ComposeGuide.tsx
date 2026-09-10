'use client'
import { AlignLeft, ArrowUpRight, AudioLines, CalendarDays, Check, Image as ImageIcon, ListOrdered, NotebookPen, Quote } from 'lucide-react'
import type { ContentItem, ContentType } from '@/lib/types'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'
import { readingMinutes } from '@/lib/draftContent'

type Guide = { title: string; opening: string; middle: string; closing: string; sample: string; note: string }
const guides: Record<Exclude<ContentType, 'franja'>, Guide> = {
  articulo: { title: 'Dale forma a tu historia', opening: 'Abre con una escena o una idea.', middle: 'Usa secciones para cambiar de tema.', closing: 'Intercala una imagen o una voz.', sample: 'La ciudad también se escucha de noche', note: 'Una cita destaca una voz. Una sección ayuda a orientarse. Úsalas cuando aporten a la historia.' },
  editorial: { title: 'Una idea desde la redacción', opening: 'Presenta el tema y tu postura.', middle: 'Desarrolla argumentos con contexto.', closing: 'Cierra con una idea para discutir.', sample: 'La pista como espacio compartido', note: 'Distingue los hechos de la postura editorial. Enlaza las fuentes que sostienen tus argumentos.' },
  opinion: { title: 'Haz visible tu argumento', opening: 'Plantea una postura concreta.', middle: 'Sostén tu idea con ejemplos.', closing: 'Cierra con una reflexión propia.', sample: 'Bailar también es tomar posición', note: 'Usa la negrita para una idea clave; la cursiva para dar énfasis. Los enlaces permiten ampliar el contexto.' },
  noticia: { title: 'Una noticia que se entiende', opening: 'Di qué ocurrió en el titular.', middle: 'Responde quién, cuándo y dónde.', closing: 'Incluye la fuente de la información.', sample: 'Un nuevo ciclo de escucha llega a la Roma', note: 'Escribe párrafos breves. La imagen, el resumen y los enlaces están debajo del texto y son opcionales.' },
  review: { title: 'De la escucha a la crítica', opening: 'Identifica la obra y su autor.', middle: 'Describe detalles que escuchaste.', closing: 'Explica tu lectura de la obra.', sample: 'Texturas que cambian con cada escucha', note: 'Un ejemplo concreto dice más que un adjetivo. Puedes enlazar la obra y dar contexto sin asignar una puntuación.' },
  evento: { title: 'Una invitación completa', opening: 'Fecha, hora y lugar reconocibles.', middle: 'Cartel y nombres de quienes participan.', closing: 'Entradas y detalles para llegar.', sample: 'Viernes de escucha · Club Japan', note: 'El cartel acompaña los datos: escribe también la fecha, el lugar y los artistas para que sean fáciles de consultar.' },
  mix: { title: 'Prepara la escucha', opening: 'Pega y comprueba el enlace de audio.', middle: 'Cuenta quién toca y qué vamos a oír.', closing: 'Añade la lista de temas si la tienes.', sample: 'Una hora entre el dub y la madrugada', note: 'El enlace es la pieza central. La lista de temas da crédito a los artistas; puedes añadirla después.' },
  listicle: { title: 'Una selección con criterio', opening: 'Explica qué conecta las obras.', middle: 'Una entrada por disco o tema.', closing: 'Añade tu comentario y cómo escucharlo.', sample: 'Discos para escuchar cuando baja la luz', note: 'Cada entrada reúne artista, título, imagen y comentario. Usa las flechas para decidir el orden.' },
}

export function ComposeGuide({ draft, step, onPreview }: { draft: ContentItem; step: string; onPreview: () => void }) {
  const guide = guides[draft.type === 'franja' ? 'articulo' : draft.type]
  const presenting = step === 'presentation'
  const details = step === 'details'
  const Icon = draft.type === 'evento' ? CalendarDays : draft.type === 'mix' ? AudioLines : draft.type === 'listicle' ? ListOrdered : NotebookPen
  const tips = presenting ? ['Elige una imagen legible incluso en pequeño.', 'Resume lo que encontrará quien abra la pieza.', 'Describe la energía con el ambiente y los géneros.'] : details ? ['Cita una fuente cuando amplíe una idea.', 'Añade notas solo donde se necesiten.', 'Incluye una encuesta si abre una conversación.'] : [guide.opening, guide.middle, guide.closing]
  return <section aria-label="Guía para este contenido" className="border border-ink bg-paper-raised">
    <div className="flex items-center gap-2 border-b border-ink bg-acid px-4 py-3"><Icon size={17} aria-hidden /><h2 className="font-mono text-d11 font-bold uppercase tracking-widest">{presenting ? 'Presenta tu pieza' : details ? 'Contexto con propósito' : guide.title}</h2></div>
    <div className="p-4">
      <p className="mb-3 font-mono text-d11 uppercase text-ink-soft">{presenting ? 'Antes de elegir la portada' : 'Una estructura posible'}</p>
      <ol className="space-y-3">{tips.map((tip, i) => <li key={tip} className="flex gap-3 text-d13 leading-relaxed"><span className="flex h-6 w-6 shrink-0 items-center justify-center border border-ink font-mono text-d11">{i + 1}</span><span>{tip}</span></li>)}</ol>
      {!presenting && !details && <div className="mt-5 border border-ink/30 bg-paper p-4" aria-label="Ejemplo de estructura, no es tu borrador">
        <p className="mb-3 font-mono text-d11 uppercase text-ink-soft">Ejemplo · {draft.type === 'evento' ? 'invitación' : draft.type === 'mix' ? 'sesión' : 'composición'}</p>
        <p className="font-syne text-d18 font-bold leading-snug">{guide.sample}</p>
        {draft.type === 'evento' ? <div className="mt-3 flex gap-3 border-y border-ink/20 py-3 text-d13"><CalendarDays size={22} aria-hidden /><p>Viernes · 21:00<br />Lugar y dirección</p></div>
          : draft.type === 'mix' ? <div className="mt-3 flex items-center gap-3 border-y border-ink/20 py-3 text-d13"><AudioLines size={25} aria-hidden /><p>Artista · 60 min<br />Enlace para escuchar</p></div>
          : <p className="mt-2 text-d13 leading-relaxed text-ink-soft">Una apertura breve sitúa a quien lee y le da una razón para seguir.</p>}
        <div className="mt-3 flex items-center gap-2 border-t border-ink/20 pt-3 text-d13"><AlignLeft size={14} aria-hidden /><span>{draft.type === 'listicle' ? '01 · Artista — Obra' : draft.type === 'noticia' ? 'Qué pasó · Dónde · Cuándo' : 'Desarrollo y contexto'}</span></div>
        <div className="mt-3 flex items-start gap-2 border-l-2 border-ink pl-3 text-d13 italic text-ink-soft">{draft.type === 'evento' || presenting ? <ImageIcon size={16} aria-hidden /> : <Quote size={16} className="shrink-0" aria-hidden />}<span>{draft.type === 'listicle' ? 'Tu razón para incluir esta obra.' : draft.type === 'noticia' ? 'Fuente y enlace para ampliar.' : draft.type === 'mix' ? 'Un recorrido que empieza lento.' : draft.type === 'evento' ? 'Cartel + artistas + entradas.' : 'Una voz o una idea que merece espacio.'}</span></div>
      </div>}
      <p className="mt-4 text-d13 leading-relaxed text-ink-soft">{presenting ? 'La tarjeta es una puerta de entrada. La imagen y el resumen deben invitar a abrir tu pieza.' : details ? 'Estos elementos son opcionales. Puedes pasar a la revisión sin rellenarlos.' : guide.note}</p>
      {draft.type !== 'evento' && draft.type !== 'mix' && readingMinutes(draft) && <p className="mt-4 flex items-center gap-2 border-t border-ink/20 pt-3 text-d11 text-ink-soft"><Check size={13} aria-hidden />Lectura estimada: {readingMinutes(draft)} min</p>}
      <button type="button" onClick={onPreview} className={`mt-4 flex min-h-11 w-full items-center justify-between border border-ink px-3 text-left text-d13 hover:bg-ink hover:text-paper ${FOCUS_RING}`}>Ver mi pieza<ArrowUpRight size={16} aria-hidden /></button>
    </div>
  </section>
}
