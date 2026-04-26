'use client'

import { useRouter, usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { useVibe } from '@/context/VibeContext'
import { useOverlay } from '@/components/overlay/useOverlay'
import { getGenreById } from '@/lib/genres'

interface GenreChipButtonProps {
  genreId: string
  className?: string
  style?: React.CSSProperties
  // Optional rendered label override. Defaults to the genre's display name.
  children?: ReactNode
}

// Clickable genre chip. Same UX whether triggered from a card on the home
// grid or from inside an overlay: sets the in-page genre filter, closes any
// open overlay, and lands on home where the filter actually applies.
//
// Composes with the existing categoryFilter — both can be active at once
// (e.g. category=mix + genre=techno). Clearing either is independent.
export function GenreChipButton({
  genreId,
  className,
  style,
  children,
}: GenreChipButtonProps) {
  const { setGenreFilter } = useVibe()
  const { close } = useOverlay()
  const router = useRouter()
  const pathname = usePathname()

  const name = getGenreById(genreId)?.name ?? genreId

  const handleClick = (e: React.MouseEvent) => {
    // Prevent the click from bubbling to a parent card / row that would
    // otherwise open an overlay or navigate elsewhere.
    e.stopPropagation()
    e.preventDefault()
    setGenreFilter(genreId)
    close()
    if (pathname !== '/') router.push('/')
  }

  // Built-in hover signal so users can tell a chip apart from the card
  // surface — without it, clicking a chip and seeing the home grid reorganize
  // reads as a bug. Caller's className comes first so per-site visual styles
  // (color, bg, border) win for non-hover state, and our hover utilities
  // override their fainter equivalents (e.g. an old `hover:brightness-125`).
  const baseHover =
    'cursor-pointer transition-all duration-150 hover:scale-110 hover:brightness-150 focus-visible:outline focus-visible:outline-1 focus-visible:outline-current'

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`Filtrar por género · ${name}`}
      className={`${className ?? ''} ${baseHover}`.trim()}
      style={style}
    >
      {children ?? name}
    </button>
  )
}
