import type { ContentType } from '@/lib/types'

export interface ComposeStep { id: string; label: string; description: string }
export const WRITING_STEPS: ComposeStep[] = [
  { id: 'content', label: 'Escribir', description: 'Escribe primero. Los detalles pueden esperar.' },
  { id: 'presentation', label: 'Presentación', description: 'Así encontrará la comunidad tu pieza.' },
  { id: 'details', label: 'Más detalles', description: 'Añade contexto solo si tu pieza lo necesita.' },
  { id: 'review', label: 'Revisar', description: 'Lee tu pieza antes de compartirla.' },
]
export const EVENT_STEPS: ComposeStep[] = [
  { id: 'content', label: 'Lo esencial', description: 'Empieza por la fecha y el lugar.' },
  { id: 'presentation', label: 'Cartel y artistas', description: 'Dale una imagen y presenta a quienes participan.' },
  { id: 'details', label: 'Ambiente y entradas', description: 'Ayuda a la comunidad a llegar y saber qué esperar.' },
  { id: 'review', label: 'Revisar', description: 'Comprueba los detalles antes de compartir tu evento.' },
]
// Section numbers are stable within the existing type forms; persisted
// content retains its original shape throughout the new workflow.
const GROUPS: Partial<Record<ContentType, Record<string, string[]>>> = {
  evento: { content: ['01', '02', '03'], presentation: ['05', '06', '08'], details: ['04', '07', '09'] },
  mix: { content: ['01', '02', '03', '04'], presentation: ['05', '06'], details: ['07', '08'] },
  articulo: { content: ['01', '02'], presentation: ['04', '05', '06'], details: ['03', '07', '08'] },
  listicle: { content: ['01', '02'], presentation: ['03', '04', '05'], details: ['06', '07'] },
  review: { content: ['01', '02', '03'], presentation: ['04', '05'], details: ['06', '07'] },
  editorial: { content: ['01', '02'], presentation: ['03', '04'], details: ['05', '06'] },
  opinion: { content: ['01', '02'], presentation: ['03', '04'], details: ['05', '06'] },
  noticia: { content: ['01', '02'], presentation: ['03', '04'], details: ['05', '06'] },
}
const COMPACT_TYPES: ContentType[] = ['mix', 'listicle', 'review', 'opinion', 'editorial']

export function composeSteps(type: ContentType): ComposeStep[] {
  if (type === 'evento') return EVENT_STEPS
  if (type === 'noticia') return [
    { id: 'content', label: 'La noticia', description: 'Qué pasó, dónde y por qué importa.' },
    { id: 'review', label: 'Revisar', description: 'Comprueba la noticia y su fuente antes de compartir.' },
  ]
  const content: Partial<Record<ContentType, [string, string]>> = {
    mix: ['Audio y selección', 'Dale contexto a lo que vamos a escuchar.'],
    listicle: ['Tu selección', 'Una entrada, una obra y una razón para escucharla.'],
    review: ['La reseña', 'Presenta la obra y desarrolla tu lectura crítica.'],
    opinion: ['Tu columna', 'Una postura clara, con espacio para tus argumentos.'],
    editorial: ['La editorial', 'Una idea que abra conversación desde la redacción.'],
  }
  return WRITING_STEPS.filter((step) => step.id !== 'details' || !COMPACT_TYPES.includes(type)).map((step) => {
    if (step.id === 'content' && content[type]) return { ...step, label: content[type]![0], description: content[type]![1] }
    if (step.id === 'presentation' && COMPACT_TYPES.includes(type)) return { ...step, label: 'Portada y contexto', description: 'Presenta tu pieza y añade sus referencias.' }
    return step
  })
}

export function isOptionalComposeSection(type: ContentType, number: string): boolean {
  return type === 'noticia' && !['01', '02'].includes(number)
}

export function sectionStep(type: ContentType, number: string): string {
  const group = number === 'summary' ? 'presentation' : Object.entries(GROUPS[type] ?? {}).find(([, numbers]) => numbers.includes(number))?.[0] ?? 'details'
  if (type === 'noticia') return 'content'
  if (group === 'details' && COMPACT_TYPES.includes(type)) return 'presentation'
  return group
}
