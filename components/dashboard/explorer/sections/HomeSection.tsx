'use client'

import type { ReactNode } from 'react'
import {
  FilePlus,
  FileText,
  User,
  Archive,
  type LucideIcon,
} from 'lucide-react'
import type { ExplorerSection } from '../types'

interface Props {
  username: string | null
  draftCount: number
  publishedCount: number
  onPick: (section: ExplorerSection) => void
}

interface Tile {
  section: ExplorerSection
  Icon: LucideIcon
  label: string
  blurb: string
  badge?: string
  color: string
}

export function HomeSection({ username, draftCount, publishedCount, onPick }: Props) {
  const tiles: Tile[] = [
    {
      section: 'nuevo',
      Icon: FilePlus,
      label: 'Nuevo contenido',
      blurb: 'Elige una plantilla y compón. Mix, evento, review, editorial, opinión, lista, artículo, noticia.',
      color: '#F97316',
    },
    {
      section: 'drafts',
      Icon: FileText,
      label: 'Drafts',
      blurb: 'Bandeja de borradores activos. Color por tipo, posiciones libres.',
      badge: draftCount > 0 ? String(draftCount).padStart(2, '0') : undefined,
      color: '#22D3EE',
    },
    {
      section: 'publicados',
      Icon: Archive,
      label: 'Publicados',
      blurb: 'Lo que ya soltaste. Versión local de la sesión, listo para revisar.',
      badge: publishedCount > 0 ? String(publishedCount).padStart(2, '0') : undefined,
      color: '#4ADE80',
    },
    {
      section: 'profile',
      Icon: User,
      label: 'Perfil',
      blurb: 'Identidad editorial. Bio, firma, pronombres, ciudad.',
      color: '#A78BFA',
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[10px] tracking-widest text-sys-orange">
          // SUBSISTEMA·UNIT-10
        </span>
        <h1 className="font-syne text-3xl font-black leading-tight text-primary md:text-4xl">
          BIENVENIDO, @{username ?? 'unit'}
        </h1>
        <p className="font-mono text-[11px] leading-relaxed text-secondary">
          Este es tu disco de trabajo. Compón, edita, archiva y muévete entre los
          módulos del subsistema.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2">
        {tiles.map((t) => (
          <HomeTile key={t.section} tile={t} onClick={() => onPick(t.section)} />
        ))}
      </div>
    </div>
  )
}

function HomeTile({ tile, onClick }: { tile: Tile; onClick: () => void }) {
  const { Icon, label, blurb, badge, color } = tile
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex items-start gap-3 border border-border bg-surface p-4 text-left transition-colors hover:border-secondary hover:bg-elevated"
    >
      <span
        className="absolute left-0 top-0 h-[2px] w-full"
        style={{ backgroundColor: color }}
      />
      <span
        className="flex h-12 w-12 items-center justify-center border"
        style={{ borderColor: color, color }}
      >
        <Icon size={22} strokeWidth={1.5} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-syne text-base font-black" style={{ color }}>
            {label}
          </span>
          {badge && (
            <span
              className="border px-1.5 py-[1px] font-mono text-[9px] tracking-widest"
              style={{ borderColor: color, color }}
            >
              {badge}
            </span>
          )}
        </div>
        <p className="font-mono text-[10px] leading-relaxed text-secondary">{blurb}</p>
      </div>
      <span className="ml-auto self-end font-mono text-[10px] text-muted transition-colors group-hover:text-primary">
        →
      </span>
    </button>
  )
}
