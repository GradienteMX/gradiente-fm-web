'use client'

// ── The ONE widget registry (WP10) ──────────────────────────────────────────
//
// Shared by app/dashboard/page.tsx and app/lab/dashboard/page.tsx so the lab
// renders exactly the composition production ships. Presence rules stay where
// they belong: MERCADO renders null for non-partner users (its own gate), and
// the layout vocabulary in lib/dashboard/layout.ts governs which ids exist.

import type { WidgetRegistry } from '@/components/dashboard/grid/WidgetGrid'
import { CrearWidget } from '@/components/dashboard/widgets/CrearWidget'
import { CultivarWidget } from '@/components/dashboard/widgets/CultivarWidget'
import { ActividadWidget } from '@/components/dashboard/widgets/ActividadWidget'
import { GuardadosWidget } from '@/components/dashboard/widgets/GuardadosWidget'
import { ReproductorWidget } from '@/components/dashboard/widgets/ReproductorWidget'
import { NovedadesWidget } from '@/components/dashboard/widgets/NovedadesWidget'
import { AgendaWidget } from '@/components/dashboard/widgets/AgendaWidget'
import { MapaWidget } from '@/components/dashboard/widgets/MapaWidget'
import { MercadoWidget } from '@/components/dashboard/widgets/MercadoWidget'

export const DASH_WIDGETS: WidgetRegistry = {
  crear: CrearWidget,
  cultivar: CultivarWidget,
  actividad: ActividadWidget,
  guardados: GuardadosWidget,
  reproductor: ReproductorWidget,
  novedades: NovedadesWidget,
  agenda: AgendaWidget,
  mapa: MapaWidget,
  mercado: MercadoWidget,
}
