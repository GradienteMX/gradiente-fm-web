'use client'

import type { ContentType } from '@/lib/types'
import {
  Calendar,
  Disc3,
  FileText,
  ListOrdered,
  MessageSquare,
  Newspaper,
  PenLine,
  ScrollText,
  Star,
  type LucideIcon,
} from 'lucide-react'

interface Props {
  color: string
  size?: number
  type?: ContentType
}

const ICON_BY_TYPE: Partial<Record<ContentType, LucideIcon>> = {
  mix: Disc3,
  listicle: ListOrdered,
  articulo: ScrollText,
  evento: Calendar,
  review: Star,
  editorial: PenLine,
  opinion: MessageSquare,
  noticia: Newspaper,
}

/**
 * Folded-corner file icon with an optional content-type glyph in the middle.
 * Mirrors the sketch in the dashboard mockup — outline only, fold tucked in
 * the top-right corner, color taken from the type accent.
 */
export function FileIcon({ color, size = 56, type }: Props) {
  const w = size
  const h = Math.round(size * 1.18)
  const fold = Math.round(size * 0.28)
  const Glyph = type ? ICON_BY_TYPE[type] ?? FileText : FileText

  return (
    <span className="relative inline-block" style={{ width: w, height: h }}>
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        className="absolute inset-0"
        aria-hidden
      >
        <path
          d={`M 1 1 L ${w - fold} 1 L ${w - 1} ${fold} L ${w - 1} ${h - 1} L 1 ${h - 1} Z`}
          fill="transparent"
          stroke={color}
          strokeWidth={1.25}
        />
        {/* Folded corner */}
        <path
          d={`M ${w - fold} 1 L ${w - fold} ${fold} L ${w - 1} ${fold}`}
          fill="transparent"
          stroke={color}
          strokeWidth={1.25}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center pt-1"
        style={{ color }}
      >
        {Glyph && <Glyph size={Math.round(size * 0.42)} strokeWidth={1.25} />}
      </span>
    </span>
  )
}
