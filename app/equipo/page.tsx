import type { Metadata } from 'next'
import Link from 'next/link'
import {
  BrandPageShell,
  Redactar,
} from '@/components/brand/BrandPageShell'

export const metadata: Metadata = { title: 'Equipo' }

// Names + GH handles match the collaborators list in CLAUDE.md. Roles below
// are placeholder — to be revised by the team. Bios are [SIN REDACTAR] until
// each person writes their own.
//
// Fase F: chrome only — the roster data and every placeholder are unchanged.
const COLLABORATORS = [
  {
    handle: 'datavismo-cmyk',
    role: 'Project lead · curaduría · dirección editorial',
  },
  {
    handle: 'hzamorate',
    role: 'Colaborador',
  },
  {
    handle: 'ikerio',
    role: 'Colaborador',
  },
] as const

const FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

export default function EquipoPage() {
  return (
    <>
      <BrandPageShell
        subsystem="EQUIPO"
        title="QUIÉN ESCRIBE ESTO"
        lead="Gente que va, escucha, escribe y a veces toca. No una redacción."
      >
        <ul className="flex flex-col gap-6">
          {COLLABORATORS.map((c) => (
            <li
              key={c.handle}
              className="flex flex-col gap-2 border-l-2 border-ink pl-4"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-syne text-d28 font-extrabold text-ink">
                  @{c.handle}
                </span>
                <Link
                  href={`https://github.com/${c.handle}`}
                  className={`inline-flex min-h-11 items-center font-mono text-d11 uppercase tracking-widest text-ink-faint hover:text-ink hover:underline hover:underline-offset-4 ${FOCUS_RING}`}
                >
                  [github.com/{c.handle}]
                </Link>
              </div>
              <p className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
                {c.role.toUpperCase()}
              </p>
              <p className="font-grotesk text-d13 leading-relaxed text-ink-soft">
                <Redactar note={`bio de @${c.handle}`} />
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-6 border-t border-ink pt-6">
          <p className="font-mono text-d11 uppercase leading-relaxed tracking-widest text-ink-faint">
            ¿Querés sumarte a la lista? Mandanos lo que estás haciendo:{' '}
            <Redactar note="añadir mecanismo de contacto cuando exista" />
          </p>
        </div>
      </BrandPageShell>
    </>
  )
}
