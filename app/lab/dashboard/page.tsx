'use client'

// ── /lab/dashboard — dev-only provider harness (BUILD_PLAN WP2) ─────────────
//
// Reachable anonymously ONLY in dev (middleware isDevLab gate covers /lab/*).
// Renders the REAL DashboardDataProvider with fixture slices injected at the
// provider boundary (`initialSlices` — the single sanctioned door), plus a
// scenario switcher. Until the shell/grid packages land, a plain diagnostic
// dump renders every context slice so cadences/presence/errors are auditable.
//
// Initial scenario can be forced via ?scenario=<fresh|rich|partner|admin|
// smallN|error> (read after mount to keep hydration clean).

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  DashboardDataProvider,
  useDashboardData,
} from '@/components/dashboard/DashboardDataProvider'
import { ComposeSheet } from '@/components/dashboard/compose/ComposeSheet'
import { isComposeType } from '@/components/dashboard/widgets/cultivar/CrearZone'
import { DashMasthead } from '@/components/dashboard/shell/DashMasthead'
import { IdentitySpine } from '@/components/dashboard/shell/IdentitySpine'
import { StatusStrip } from '@/components/dashboard/shell/StatusStrip'
import { DashColophon } from '@/components/dashboard/shell/DashColophon'
import { MiniTransport } from '@/components/dashboard/shell/MiniTransport'
import { DashOverlayHost } from '@/components/dashboard/overlayhost/DashOverlayHost'
import { WidgetGrid } from '@/components/dashboard/grid/WidgetGrid'
import { DASH_WIDGETS } from '@/components/dashboard/widgetRegistry'
import {
  LAB_SCENARIOS,
  LAB_SCENARIO_KEYS,
  type LabScenarioKey,
} from './fixtures'

function isScenarioKey(value: string | null): value is LabScenarioKey {
  return value !== null && (LAB_SCENARIO_KEYS as readonly string[]).includes(value)
}

// JSON.stringify replacer so Map/Set slices print instead of collapsing to {}.
function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Map) return Object.fromEntries(value)
  if (value instanceof Set) return Array.from(value)
  return value
}

function SliceBlock({ name, value }: { name: string; value: unknown }) {
  const count = Array.isArray(value)
    ? value.length
    : value instanceof Map || value instanceof Set
      ? value.size
      : null
  return (
    <section className="border border-ink bg-paper-raised">
      <header className="flex items-baseline justify-between border-b border-ink px-3 py-1.5">
        <h2 className="font-mono text-d11 tracking-widest text-ink">// {name}</h2>
        {count !== null && (
          <span className="font-mono text-d11 tabular-nums text-ink-faint">{count}</span>
        )}
      </header>
      <pre className="max-h-64 overflow-auto px-3 py-2 font-mono text-d11 text-ink-soft">
        {JSON.stringify(value, replacer, 2)}
      </pre>
    </section>
  )
}

// Consumes the context exactly like a widget would — everything shown here
// came through the provider, nothing else.
function SliceDump() {
  const data = useDashboardData()
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-x-6 gap-y-1 border border-ink bg-panel px-3 py-2 font-mono text-d11 text-panel-text">
        <span>
          ÚLTIMO SONDEO:{' '}
          <span className="tabular-nums">{data.lastTickAt ?? '—'}</span>
        </span>
        <span>LAYOUT LISTO: {data.layoutReady ? 'SÍ' : 'NO'}</span>
        <span>MAPA AUTO-EXPAND: {data.mapaAutoExpandEligible ? 'SÍ' : 'NO'}</span>
        <span>REGISTRO: {data.registry.join(' · ')}</span>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SliceBlock name="PRESENCIA DE DATOS" value={data.dataPresence} />
        <SliceBlock name="CARGADOS" value={data.loaded} />
        <SliceBlock name="ERRORES" value={data.errors} />
        <SliceBlock name="SAVES" value={data.saves} />
        <SliceBlock name="SAVED COMMENTS" value={data.savedComments.comments} />
        <SliceBlock name="DRAFTS" value={data.drafts} />
        <SliceBlock name="PUBLISHED" value={data.published} />
        <SliceBlock name="ENGAGEMENT" value={data.engagement} />
        <SliceBlock name="TROPHIES" value={data.trophies} />
        <SliceBlock name="ACTIVITY" value={data.activity} />
        <SliceBlock name="NOVEDADES (POOL)" value={data.novedades} />
        <SliceBlock name="PARTNER OPTIONS" value={data.partnerOptions} />
        <SliceBlock name="EVENTS" value={data.events} />
        <SliceBlock name="VIBE SELF" value={data.vibeSelf} />
        <SliceBlock name="PARTNER" value={data.partner} />
        <SliceBlock name="FOLLOWS" value={data.follows} />
        <SliceBlock name="LAYOUT META" value={data.layoutMeta} />
      </div>
    </div>
  )
}

export default function DashboardLabPage() {
  const [scenario, setScenario] = useState<LabScenarioKey>('rich')
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  // Compose-on-the-lab (judge r2 fix 2): chips/drafts navigate on the CURRENT
  // pathname, so the lab hosts the sheet itself — never ejecting to prod.
  const rawType = search?.get('type') ?? null
  const labComposeType = rawType && isComposeType(rawType) ? rawType : null
  const labEditId = search?.get('edit') ?? null
  // Client-only render: fixtures stamp load-relative dates, so SSR HTML can
  // never match the client pass. Dev-only harness — no SSR value to lose.
  const [mounted, setMounted] = useState(false)
  const [editing, setEditing] = useState(false)
  const [showSlices, setShowSlices] = useState(false)

  useEffect(() => {
    setMounted(true)
    const param = new URLSearchParams(window.location.search).get('scenario')
    if (isScenarioKey(param)) setScenario(param)
  }, [])

  // Same shell contract as app/dashboard/layout.tsx: full-bleed fixed surface
  // above the padded dark <main>, html.dash-route killing overscroll flash.
  useEffect(() => {
    document.documentElement.classList.add('dash-route')
    return () => document.documentElement.classList.remove('dash-route')
  }, [])

  const active = LAB_SCENARIOS[scenario]

  if (!mounted)
    return <div className="dash-shell fixed inset-0 z-40 bg-paper" />

  return (
    <div className="dash-shell fixed inset-0 z-40 overflow-y-auto overflow-x-hidden text-ink">
      {/* Lab control strip — sits ABOVE the real composition, visually apart */}
      <div className="border-b border-ink bg-paper-raised px-4 py-2 md:px-8">
        <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center gap-2">
          <span className="mr-2 font-mono text-d11 tracking-widest text-ink-soft">
            {'// LAB · EL PLIEGO'}
          </span>
          <nav className="flex flex-wrap gap-2" aria-label="Escenario">
            {LAB_SCENARIO_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setScenario(key)}
                className={
                  key === scenario
                    ? 'border border-ink bg-ink px-3 py-1 font-mono text-d11 tracking-widest text-paper'
                    : 'border border-ink bg-paper px-3 py-1 font-mono text-d11 tracking-widest text-ink hover:bg-paper-raised'
                }
              >
                {LAB_SCENARIOS[key].label}
              </button>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => setShowSlices((v) => !v)}
            className="ml-auto border border-ink px-3 py-1 font-mono text-d11 tracking-widest text-ink hover:bg-paper"
          >
            {showSlices ? 'VER PANEL' : 'VER DATOS'}
          </button>
          <span
            className="hidden font-mono text-d11 text-ink-faint lg:block"
            title={active.note}
          >
            {active.note.length > 80 ? `${active.note.slice(0, 80)}…` : active.note}
          </span>
        </div>
      </div>

      {/* key remounts the provider per scenario — clean boot, no bleed.
          THE REAL COMPOSITION: identical to app/dashboard/page.tsx's authed
          branch (masthead → spine → strip → grid → colophon → transport →
          overlay host), with the lab user through the userOverride door. */}
      <DashboardDataProvider key={scenario} initialSlices={active.slices}>
        {labComposeType ? (
          // §4: grid unmounted beneath the sheet — same contract as prod.
          <ComposeSheet
            type={labComposeType}
            editingId={labEditId}
            onClose={() => {
              const params = new URLSearchParams(search?.toString() ?? '')
              params.delete('type')
              params.delete('edit')
              const qs = params.toString()
              router.replace(qs ? `${pathname}?${qs}` : pathname)
            }}
          />
        ) : showSlices ? (
          <div className="mx-auto w-full max-w-[1400px] px-6 py-6">
            <SliceDump />
          </div>
        ) : (
          <>
            <DashMasthead
              editing={editing}
              onEditPanel={() => setEditing((e) => !e)}
              userOverride={active.user}
            />
            <div className="mx-auto w-full max-w-[1440px] px-4 md:px-8">
              <IdentitySpine userOverride={active.user} />
              <StatusStrip />
              <section className="min-h-[32rem] py-6">
                <WidgetGrid
                  widgets={DASH_WIDGETS}
                  editing={editing}
                  onEditingChange={setEditing}
                />
              </section>
              <DashColophon />
            </div>
            <MiniTransport />
            <DashOverlayHost />
          </>
        )}
      </DashboardDataProvider>
    </div>
  )
}
