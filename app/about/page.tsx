import type { Metadata } from 'next'
import Link from 'next/link'
import {
  BrandPageShell,
  BrandSection,
  Redactar,
} from '@/components/brand/BrandPageShell'

export const metadata: Metadata = { title: 'About' }

export default function AboutPage() {
  return (
    <BrandPageShell
      subsystem="ABOUT"
      title="QUÉ ES GRADIENTE FM"
      lead="Editorial + agenda + mixes desde adentro de la escena de música electrónica de la Ciudad de México."
    >
      <p>
        Gradiente FM es un subsistema cultural construido por gente que fue al{' '}
        <Link
          href="https://fascinoma.space"
          className="text-primary underline decoration-sys-orange/60 underline-offset-2 hover:decoration-sys-orange"
        >
          FASCINOMA
        </Link>{' '}
        y a Club Japan, no por una redacción que escribe sobre la escena desde
        afuera. Cubrimos eventos, perfilamos artistas, publicamos mixes y
        opinamos sobre cómo está cambiando todo. <Redactar note="hilo editorial fundacional" />
      </p>

      <BrandSection index={1} title="EL FILTRO DE VIBE">
        <p>
          Cada pieza de contenido tiene un puntaje de vibe entre 0 (glacial,
          ambient, dub) y 10 (volcán, peak hour, hard techno). Es subjetivo,
          editorial, no algorítmico. Movés la barra de arriba y el feed se
          reorganiza por dónde estás esa noche.
        </p>
      </BrandSection>

      <BrandSection index={2} title="QUÉ ENCONTRÁS ACÁ">
        <ul className="ml-4 flex list-disc flex-col gap-1.5 marker:text-sys-orange">
          <li>Agenda de eventos curada (no scraping ciego)</li>
          <li>Mixes con contexto: dónde se grabaron, BPM, recorrido</li>
          <li>Editoriales y opiniones de gente que está en la escena</li>
          <li>Reviews de discos y noches</li>
          <li>Listas: «tracks de la temporada», «venues que importan»</li>
        </ul>
      </BrandSection>

      <BrandSection index={3} title="CONEXIONES">
        <p>
          Gradiente FM existe en órbita con{' '}
          <Link
            href="https://fascinoma.space"
            className="text-primary underline decoration-sys-orange/60 underline-offset-2 hover:decoration-sys-orange"
          >
            FASCINOMA
          </Link>{' '}
          y Club Japan (Monterrey 56, Roma Norte). Compartimos circuito, gente y
          algo de criterio. <Redactar note="ampliar partners ecosystem" />
        </p>
      </BrandSection>

      <p className="border-t border-border pt-6 font-mono text-xs leading-relaxed text-muted">
        ¿Querés colaborar, mandar un mix o sugerir cobertura?{' '}
        <Redactar note="añadir contacto cuando exista" />
      </p>
    </BrandPageShell>
  )
}
