'use client'

import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import type { EntityRef } from '@/lib/types'
import { useOverlay } from '@/components/overlay/useOverlay'

interface EntityChipButtonProps {
  entity: EntityRef
  className?: string
  style?: React.CSSProperties
  children?: ReactNode
}

// Clickable scene-entity chip. Closes any open overlay and navigates to the
// entity's page (`/e/[slug]`), which lists everything that references it.
// Mirrors GenreChipButton's gesture, but routes to a dedicated page rather
// than setting an in-page filter — entities get their own browsable surface.
export function EntityChipButton({
  entity,
  className,
  style,
  children,
}: EntityChipButtonProps) {
  const { close } = useOverlay()
  const router = useRouter()

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    close()
    router.push(`/e/${entity.slug}`)
  }

  const baseHover =
    'cursor-pointer transition-all duration-150 hover:scale-110 hover:brightness-150 focus-visible:outline focus-visible:outline-1 focus-visible:outline-current'

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`Ver todo · ${entity.name}`}
      className={`${className ?? ''} ${baseHover}`.trim()}
      style={style}
    >
      {children ?? entity.name}
    </button>
  )
}
