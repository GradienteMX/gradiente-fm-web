import type { ReactNode } from 'react'

const labels: Record<string, string> = {
  IDENTIDAD: 'Tu pieza', CUERPO: 'Texto de la pieza', COPY: 'Texto de la pieza',
  FOOTNOTES: 'Notas al pie', 'VIBE + GÉNEROS': 'Ambiente y géneros', PORTADA: 'Imagen de portada',
  CONTEXTO: 'Contexto y enlaces', 'ENCUESTA (OPCIONAL)': 'Encuesta (opcional)',
  'FUENTE / AUDIO': 'Audio', TRACKLIST: 'Lista de temas (opcional)', FECHAS: 'Fecha y hora',
  UBICACIÓN: 'Lugar', ENTRADAS: 'Entradas y enlaces', ARTISTAS: 'Artistas', RESEÑA: 'Sobre la obra',
}
export function PliegoSection({ number, label, id, children }: {
  number: string; label: string; id?: string; required?: boolean; children: ReactNode
}) {
  const identity = label === 'IDENTIDAD'
  return <section id={id ?? (label === 'PORTADA' ? 'compose-field-cover' : undefined)} data-compose-section={number} className={`mb-4 scroll-mt-40 ${identity ? 'pb-1' : 'border-t border-ink/30 pt-4'}`}>
    {!identity && <h2 className="mb-3 font-syne text-xl font-bold">{labels[label] ?? label}</h2>}
    <div className="grid gap-3">{children}</div>
  </section>
}
