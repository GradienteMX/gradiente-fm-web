import type { Metadata } from 'next'
import {
  BrandPageShell,
  BrandSection,
  Redactar,
} from '@/components/brand/BrandPageShell'

export const metadata: Metadata = { title: 'Manifiesto' }

// Manifesto copy is intentionally placeholder — the editorial team will write
// the real document. The structure below is a scaffold mirroring the
// already-decided editorial principles in /wiki/90-Decisions/ so the team
// has a starting point, not a blank page.
export default function ManifestoPage() {
  return (
    <BrandPageShell
      subsystem="MANIFIESTO"
      title="GUÍAS, NO PORTEROS"
      lead="Una declaración editorial — qué hacemos, qué no hacemos, y por qué importa."
    >
      <p className="border-l-2 border-sys-orange/50 pl-4 font-mono text-sm italic leading-relaxed text-secondary">
        <Redactar note="lead — escribir el primer párrafo magnético" />
      </p>

      <BrandSection index={1} title="LA ESCENA NO ES UNA MARCA">
        <p>
          <Redactar note="escena vs producto institucional · ~150 palabras" />
        </p>
      </BrandSection>

      <BrandSection index={2} title="NO HAY ALGORITMO">
        <p>
          La prominencia de cada pieza viene de criterio editorial y decaimiento
          orgánico. No hay engagement metrics visibles, no hay likes, no hay
          contadores de «trending». El tamaño y la posición de una tarjeta son
          las únicas señales — porque el editor decidió que esa cosa merece estar
          arriba esta semana.
        </p>
        <p>
          <Redactar note="profundizar — por qué rechazamos métricas" />
        </p>
      </BrandSection>

      <BrandSection index={3} title="GUÍAS, NO PORTEROS">
        <p>
          Editorial y contenido scrapeado conviven en la misma cuadrícula. No
          hay un «feed de redacción» separado del «feed real». El editor decide
          qué empuja y qué deja flotar — pero todo compite por la misma
          atención del lector.
        </p>
        <p>
          <Redactar note="elaborar — el contraste con curaduría top-down" />
        </p>
      </BrandSection>

      <BrandSection index={4} title="VIBE ANTES QUE GÉNERO">
        <p>
          Filtramos por sensación, no por taxonomía. Un mix de ambient
          experimental y un set de techno hipnótico pueden estar al lado en el
          rango 4–6 — porque a esa hora de la noche, esa es la temperatura.
        </p>
        <p>
          <Redactar note="explicar el vibe spectrum desde la experiencia del raver" />
        </p>
      </BrandSection>

      <BrandSection index={5} title="CDMX PRIMERO">
        <p>
          <Redactar note="por qué CDMX, qué relación con el resto de LATAM" />
        </p>
      </BrandSection>

      <p className="border-t border-border pt-6 font-mono text-xs leading-relaxed text-muted">
        Versión <span className="text-secondary">0.1</span> · borrador interno ·{' '}
        <Redactar note="fecha + firma del equipo editorial" />
      </p>
    </BrandPageShell>
  )
}
