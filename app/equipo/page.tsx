import type { Metadata } from 'next'
import Link from 'next/link'
import {
  BrandPageShell,
  Redactar,
} from '@/components/brand/BrandPageShell'

export const metadata: Metadata = { title: 'Equipo' }

// Names + GH handles match the collaborators list in CLAUDE.md. Roles below
// are placeholder — to be revised by the team. Bios are [REDACTAR] until each
// person writes their own.
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

export default function EquipoPage() {
  return (
    <BrandPageShell
      subsystem="EQUIPO"
      title="QUIÉN ESCRIBE ESTO"
      lead="Gente que va, escucha, escribe y a veces toca. No una redacción."
    >
      <ul className="flex flex-col gap-6">
        {COLLABORATORS.map((c) => (
          <li
            key={c.handle}
            className="flex flex-col gap-2 border-l-2 border-sys-orange/40 pl-4"
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-syne text-2xl font-black text-primary">
                @{c.handle}
              </span>
              <Link
                href={`https://github.com/${c.handle}`}
                className="font-mono text-[10px] tracking-widest text-muted hover:text-sys-orange"
              >
                [github.com/{c.handle}]
              </Link>
            </div>
            <p className="font-mono text-[11px] tracking-wide text-secondary">
              {c.role.toUpperCase()}
            </p>
            <p className="text-sm leading-relaxed text-secondary">
              <Redactar note={`bio de @${c.handle}`} />
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-6 border-t border-border pt-6">
        <p className="font-mono text-xs leading-relaxed text-muted">
          ¿Querés sumarte a la lista? Mandanos lo que estás haciendo:{' '}
          <Redactar note="añadir mecanismo de contacto cuando exista" />
        </p>
      </div>
    </BrandPageShell>
  )
}
