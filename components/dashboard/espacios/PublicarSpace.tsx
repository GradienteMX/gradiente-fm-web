'use client'

import { CrearWidget } from '@/components/dashboard/widgets/CrearWidget'
import { PublicationCollection } from '@/components/dashboard/widgets/CultivarWidget'

/** Full artwork gallery; composing still opens the existing editor in place. */
export function PublicarSpace() {
  return <div className="flex min-w-0 flex-col gap-6">
    <CrearWidget size={{ w: 12, h: 1 }} compact={false} editing={false} full/>
    <PublicationCollection full/>
  </div>
}
