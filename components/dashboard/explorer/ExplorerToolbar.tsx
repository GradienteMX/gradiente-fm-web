'use client'

import {
  FilePlus,
  Trash2,
  Pencil,
  ArrowUp,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react'

export interface ToolbarAction {
  id: string
  label: string
  Icon: LucideIcon
  onClick?: () => void
  disabled?: boolean
}

interface Props {
  actions: ToolbarAction[]
}

export function ExplorerToolbar({ actions }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {actions.map((a, i) => (
        <ToolbarButton key={a.id} action={a} divider={i > 0 && i % 4 === 0} />
      ))}
    </div>
  )
}

function ToolbarButton({ action, divider }: { action: ToolbarAction; divider: boolean }) {
  const { Icon, label, onClick, disabled } = action
  return (
    <>
      {divider && <span className="mx-1 h-7 w-px bg-border" />}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={[
          'flex flex-col items-center gap-0.5 rounded-none border border-transparent px-2 py-1 font-mono text-[9px] tracking-widest transition-colors',
          disabled
            ? 'cursor-not-allowed text-muted/60'
            : 'text-secondary hover:border-border hover:bg-elevated hover:text-primary',
        ].join(' ')}
        title={label}
      >
        <Icon size={16} strokeWidth={1.5} />
        <span>{label}</span>
      </button>
    </>
  )
}

// Default action set used when the section has no special actions to expose.
// Trimmed to only the actions that have real meaning for editorial content —
// dropped Cortar/Copiar/Pegar since clipboard semantics don't map here.
export function defaultToolbarActions(opts?: {
  onNew?: () => void
  onDelete?: () => void
  onRename?: () => void
  onUp?: () => void
  hasSelection?: boolean
}): ToolbarAction[] {
  const has = !!opts?.hasSelection
  return [
    { id: 'new', label: 'Nuevo', Icon: FilePlus, onClick: opts?.onNew },
    {
      id: 'delete',
      label: 'Eliminar',
      Icon: Trash2,
      onClick: opts?.onDelete,
      disabled: !has || !opts?.onDelete,
    },
    {
      id: 'rename',
      label: 'Renombrar',
      Icon: Pencil,
      onClick: opts?.onRename,
      disabled: !has || !opts?.onRename,
    },
    { id: 'up', label: 'Subir', Icon: ArrowUp, onClick: opts?.onUp, disabled: !opts?.onUp },
    { id: 'more', label: 'Más', Icon: MoreHorizontal, disabled: true },
  ]
}
