'use client'

import {
  Home,
  FilePlus,
  FileText,
  Archive,
  User,
  Bookmark,
  Calendar,
  Newspaper,
  Star,
  Disc3,
  PenLine,
  ScrollText,
  Rss,
  MessageSquare,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { useMemo, useState, type ComponentType } from 'react'
import type { ExplorerSection } from './types'

type LucideIconType = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>

interface SidebarItem {
  section: ExplorerSection
  label: string
  Icon: LucideIconType
  badge?: number
  /** Disabled placeholder section — visible but not yet implemented. */
  stub?: boolean
  /** Indented under a folder header. */
  indent?: boolean
}

interface SidebarFolder {
  key: string
  label: string
  Icon: LucideIconType
  items: SidebarItem[]
}

interface Props {
  active: ExplorerSection
  onPick: (section: ExplorerSection) => void
  draftCount: number
  publishedCount: number
}

export function ExplorerSidebar({ active, onPick, draftCount, publishedCount }: Props) {
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    guardados: true,
  })

  // Top-level items the user can actually act on today.
  const flatItems: SidebarItem[] = useMemo(
    () => [
      { section: 'home', label: 'Dashboard', Icon: Home },
      { section: 'nuevo', label: 'Nuevo contenido', Icon: FilePlus },
      { section: 'drafts', label: 'Drafts', Icon: FileText, badge: draftCount },
      { section: 'publicados', label: 'Publicados', Icon: Archive, badge: publishedCount },
      { section: 'profile', label: 'Perfil', Icon: User },
    ],
    [draftCount, publishedCount],
  )

  // Guardados — saved content from the public feed. Stub for now; the save
  // affordance lives elsewhere on the public side and isn't built yet, but the
  // folder reserves the destination so the mental model is clear.
  const folders: SidebarFolder[] = useMemo(
    () => [
      {
        key: 'guardados',
        label: 'Guardados',
        Icon: Bookmark,
        items: [
          { section: 'guardados-feed', label: 'Feed', Icon: Rss, indent: true, stub: true },
          { section: 'guardados-agenda', label: 'Agenda', Icon: Calendar, indent: true, stub: true },
          { section: 'guardados-noticias', label: 'Noticias', Icon: Newspaper, indent: true, stub: true },
          { section: 'guardados-reviews', label: 'Reviews', Icon: Star, indent: true, stub: true },
          { section: 'guardados-mixes', label: 'Mixes', Icon: Disc3, indent: true, stub: true },
          { section: 'guardados-editoriales', label: 'Editoriales', Icon: PenLine, indent: true, stub: true },
          { section: 'guardados-articulos', label: 'Artículos', Icon: ScrollText, indent: true, stub: true },
          { section: 'guardados-comentarios', label: 'Comentarios', Icon: MessageSquare, indent: true },
        ],
      },
    ],
    [],
  )

  return (
    <aside className="flex w-full flex-col border border-border bg-surface md:w-[240px] md:flex-shrink-0">
      <SidebarHeader />

      <div className="flex-1 overflow-y-auto px-2 py-2">
        <ul className="flex flex-col gap-0.5">
          {flatItems.map((item) => (
            <SidebarRow
              key={item.label}
              item={item}
              active={active === item.section && !item.stub}
              onClick={() => !item.stub && onPick(item.section)}
            />
          ))}

          <li className="my-2 border-t border-dashed border-border/60" />

          {folders.map((folder) => {
            const isOpen = openFolders[folder.key] ?? true
            return (
              <li key={folder.key} className="flex flex-col">
                <button
                  type="button"
                  onClick={() =>
                    setOpenFolders((prev) => ({ ...prev, [folder.key]: !isOpen }))
                  }
                  className="flex w-full items-center gap-2 rounded-none px-2 py-1.5 text-left font-mono text-[11px] tracking-wider text-secondary transition-colors hover:bg-elevated"
                >
                  {isOpen ? (
                    <ChevronDown size={12} strokeWidth={1.5} />
                  ) : (
                    <ChevronRight size={12} strokeWidth={1.5} />
                  )}
                  <folder.Icon size={14} strokeWidth={1.5} />
                  <span>{folder.label}</span>
                </button>
                {isOpen && (
                  <ul className="flex flex-col gap-0.5">
                    {folder.items.map((item) => (
                      <SidebarRow
                        key={`${folder.key}-${item.label}`}
                        item={item}
                        active={active === item.section && !item.stub}
                        onClick={() => !item.stub && onPick(item.section)}
                      />
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </aside>
  )
}

function SidebarHeader() {
  return (
    <div className="flex items-center justify-between border-b border-border px-3 py-2 font-mono text-[10px] tracking-widest text-muted">
      <span>EXPLORADOR</span>
      <div className="flex items-center gap-2 text-secondary/60">
        <WindowDots />
      </div>
    </div>
  )
}

function SidebarRow({
  item,
  active,
  onClick,
}: {
  item: SidebarItem
  active: boolean
  onClick: () => void
}) {
  const { Icon, label, badge, stub, indent } = item
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={stub}
        className={[
          'flex w-full items-center gap-2 px-2 py-1.5 text-left font-mono text-[11px] transition-colors',
          indent ? 'pl-7' : '',
          active
            ? 'bg-sys-orange/10 text-sys-orange'
            : stub
              ? 'cursor-not-allowed text-muted/70'
              : 'text-secondary hover:bg-elevated hover:text-primary',
        ].join(' ')}
        title={stub ? 'Próximamente — depende del flujo de guardado en el feed' : label}
      >
        <Icon size={14} strokeWidth={1.5} />
        <span className="flex-1 truncate">{label}</span>
        {typeof badge === 'number' && badge > 0 && (
          <span
            className="ml-auto inline-flex items-center justify-center border px-1.5 py-[1px] font-mono text-[9px] tracking-widest"
            style={{
              borderColor: active ? '#F97316' : '#242424',
              color: active ? '#F97316' : '#888',
              minWidth: 22,
            }}
          >
            {String(badge).padStart(2, '0')}
          </span>
        )}
      </button>
    </li>
  )
}

function WindowDots() {
  return (
    <span className="flex items-center gap-1">
      <span className="text-muted">─</span>
      <span className="text-muted">▢</span>
      <span className="text-muted">×</span>
    </span>
  )
}
