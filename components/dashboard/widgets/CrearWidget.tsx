'use client'

import { useAuth } from '@/components/auth/useAuth'
import { canCreateContent } from '@/lib/permissions'
import { dashboardTextType } from '@/lib/dashboard/creationTypes'
import type { ContentType } from '@/lib/types'
import type { DashboardWidgetProps } from '@/components/dashboard/grid/WidgetGrid'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'
import { dashWidgetDomId } from '@/components/dashboard/shell/StatusStrip'
import { useComposeNav, type ComposeType } from '@/components/dashboard/widgets/cultivar/CrearZone'

// One color per choice. Legacy text types remain editable through their URLs.
const CHOICES: { type: ComposeType; label: string; color: string }[] = [
  { type: 'mix', label: 'MIX', color: 'bg-publication-mix' },
  { type: 'listicle', label: 'LISTA', color: 'bg-publication-list' },
  { type: 'evento', label: 'EVENTO', color: 'bg-publication-event' },
  { type: 'review', label: 'RESEÑA', color: 'bg-publication-review' },
  { type: 'articulo', label: 'TEXTO', color: 'bg-publication-text' },
  { type: 'noticia', label: 'NOTICIA', color: 'bg-publication-news' },
]

export function publicationTint(type: ContentType): string {
  const key = type === 'editorial' || type === 'opinion' ? 'articulo' : type
  return CHOICES.find((choice) => choice.type === key)?.color ?? 'bg-paper-raised'
}

export function relTimeShort(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (!Number.isFinite(min)) return '—'
  if (min < 1) return 'AHORA'
  if (min < 60) return `HACE ${min} MIN`
  if (min < 1440) return `HACE ${Math.floor(min / 60)} H`
  return `HACE ${Math.floor(min / 1440)} D`
}

export function CrearWidget({ size, full = false }: DashboardWidgetProps & { full?: boolean }) {
  const { currentUser } = useAuth()
  const composeNav = useComposeNav()
  const textType = dashboardTextType(currentUser)
  const choices = CHOICES.flatMap((choice) => choice.type === 'articulo'
    ? textType ? [{ ...choice, type: textType }] : []
    : canCreateContent(currentUser, choice.type) ? [choice] : [])
  return (
    <section id={dashWidgetDomId('crear')} className={`flex scroll-mt-14 flex-col gap-3 ${full ? '' : 'h-full'}`} aria-label="Crear publicación">
      <h2 className={`font-syne font-extrabold text-ink ${full ? 'text-d18 md:text-d28' : 'text-d15 leading-6 md:text-d18'}`}>CREAR PUBLICACIÓN</h2>
      {choices.length ? (
        <div className={`grid min-h-0 flex-1 gap-2 ${size.w >= 6 ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-6' : 'grid-cols-2'}`}>
          {choices.map(({ type, label, color }) => (
            <button key={type} type="button" onClick={() => composeNav(type)}
              className={`border border-ink/20 px-2 py-3 font-syne font-extrabold tracking-wide text-ink transition-transform hover:-translate-y-1 hover:border-ink motion-reduce:transform-none ${full ? 'min-h-16 text-d15 md:text-d18' : 'min-h-14 text-d13 md:text-d15'} ${color} ${FOCUS_RING}`}>
              {label}
            </button>
          ))}
        </div>
      ) : <p className="font-grotesk text-d15 text-ink-soft">La publicación está disponible para los perfiles de redacción.</p>}
    </section>
  )
}
