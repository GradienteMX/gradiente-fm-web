'use client'

import { Children, isValidElement, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import type { ContentItem } from '@/lib/types'
import type { useDraftWorkbench } from '@/components/dashboard/forms/shared/Fields'
import type { ComposeRailProps } from '@/components/dashboard/compose/editor/ComposeRail'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'
import { composeSteps, isOptionalComposeSection, sectionStep } from '@/lib/composeWorkflow'
import { blockingFields, recommendedFields } from '@/lib/contentReadiness'
import { usePublishConfirm } from '@/components/publish/usePublishConfirm'
import { ComposeGuide } from '@/components/dashboard/compose/editor/ComposeGuide'
import { ComposePreview } from '@/components/dashboard/compose/editor/ComposePreview'
import { useComposeHistory } from '@/components/dashboard/compose/editor/useComposeHistory'

interface ComposeLayoutProps {
  typeLabel: string
  isEdit: boolean
  draft: ContentItem
  setDraft: (item: ContentItem) => void
  workbench: ReturnType<typeof useDraftWorkbench>
  onClose: () => void
  children: ReactNode
  rail: ReactElement<ComposeRailProps>
}

const button = `min-h-11 border border-ink px-4 py-2 font-mono text-d13 hover:bg-ink hover:text-paper disabled:cursor-wait disabled:opacity-50 ${FOCUS_RING}`

export function ComposeLayout({ typeLabel, isEdit, draft, setDraft, workbench, onClose, children, rail }: ComposeLayoutProps) {
  const [step, setStep] = useState('content')
  const [busy, setBusy] = useState(false)
  const [sideMode, setSideMode] = useState<'guide' | 'preview'>('guide')
  const [closeError, setCloseError] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const { confirmingId } = usePublishConfirm()
  const history = useComposeHistory(draft, setDraft, workbench.hydrated)
  const event = draft.type === 'evento'
  const media = draft.type === 'mix' || draft.type === 'listicle'
  const steps = composeSteps(draft.type)
  const index = steps.findIndex((s) => s.id === step)
  const controls = rail.props
  const sections = Children.toArray(children).filter((child): child is ReactElement<{ number: string }> => isValidElement(child))
  // Hard misses block publishing; soft misses are listed as recommendations
  // and never disable the button (the server enforces only the hard set).
  const missing = blockingFields(controls.checklist)
  const recommended = recommendedFields(controls.checklist)
  const outline = (draft.articleBody ?? []).map((block, i) => block.kind === 'h2' || block.kind === 'h3' ? { title: block.text || 'Sección sin título', index: i } : null).filter((v) => v !== null)

  // Resume autosave only when the confirmation actually closes. `workbench` is
  // a fresh object every render, so depending on it would re-run this on the
  // render between requestPublish() and the modal opening and undo the pause.
  const resumeSaving = useRef(workbench.resumeSaving)
  resumeSaving.current = workbench.resumeSaving
  useEffect(() => { if (!confirmingId) resumeSaving.current() }, [confirmingId])

  const navigate = (next: string) => {
    const target = steps.some((candidate) => candidate.id === next) ? next : 'content'
    setStep(target)
    setSideMode(target === 'presentation' ? 'preview' : 'guide')
    requestAnimationFrame(() => {
      root.current?.closest('[role="dialog"]')?.scrollTo({ top: 0 })
      heading.current?.focus({ preventScroll: true })
      if (draft.type === 'noticia' && next !== target) {
        const optional = root.current?.querySelector<HTMLDetailsElement>('[data-compose-optional]')
        if (optional) { optional.open = true; optional.scrollIntoView({ block: 'start' }) }
      }
    })
  }
  const saveAndClose = async () => {
    if (busy || confirmingId) return
    if (!workbench.hydrated) { onClose(); return }
    setBusy(true)
    const ok = !workbench.hasChanges && workbench.syncState !== 'error' ? true : await workbench.saveDraft()
    if (ok) { workbench.releaseRecovery(); onClose() }
    else setCloseError(true)
    setBusy(false)
  }
  const reviewPublish = async () => {
    if (busy || missing.length) return
    setBusy(true)
    // Publishing posts the composer payload directly; it never depends on the
    // account draft save succeeding. Only wait for a save already on the wire
    // to land, then kick the (background) autosave and open confirmation.
    await workbench.settle()
    controls.onPublish()
    setBusy(false)
  }
  const jumpToField = (id: string) => {
    const element = document.getElementById(id)
    const number = element?.closest<HTMLElement>('[data-compose-section]')?.dataset.composeSection
    if (number) setStep(sectionStep(draft.type, number))
    requestAnimationFrame(() => {
      // Open optional details containing the invalid field before focusing.
      let parent = element?.parentElement
      while (parent) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement }
      element?.scrollIntoView({ block: 'center' })
      element?.querySelector<HTMLElement>('input, textarea, button')?.focus()
    })
  }
  useEffect(() => {
    if (confirmingId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      if (e.key === 'Escape') { e.preventDefault(); void saveAndClose() }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) history.redo(); else history.undo()
      }
      if (e.key === 'Tab') {
        const nodes = Array.from(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary, [tabindex="0"]') ?? []).filter((el) => el.getClientRects().length > 0)
        const first = nodes[0], last = nodes[nodes.length - 1]
        if (e.shiftKey && (document.activeElement === first || !root.current?.contains(document.activeElement))) { e.preventDefault(); last?.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const saveLabel = workbench.syncState === 'saving' ? 'Guardando en tu cuenta…'
    : workbench.syncState === 'saved' ? 'Guardado en tu cuenta'
    : workbench.syncState === 'error' ? 'No se pudo guardar en tu cuenta'
    : workbench.hasChanges ? (workbench.localCopy ? 'Copia en esta pestaña · pendiente de guardar' : 'Cambios sin guardar')
    : isEdit ? 'Borrador abierto' : 'Tu borrador se guardará al escribir'

  return <div ref={root} className="min-h-screen pb-24 font-grotesk">
    <header className="sticky top-0 z-30 border-b border-ink bg-paper">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 md:px-8">
        <span className="font-syne text-xl font-extrabold tracking-tight">GRADIENTE FM</span>
        <span className="border-l border-ink pl-5 font-mono text-d11 uppercase tracking-widest">{isEdit ? 'Editar' : 'Crear'} / {typeLabel}</span>
        <div className="ml-auto flex items-center gap-3">
          <button type="button" onClick={() => void saveAndClose()} disabled={busy} className={`min-h-11 px-2 text-d13 underline underline-offset-4 ${FOCUS_RING}`}>{busy ? 'Guardando…' : 'Guardar y salir'}</button>
          {step !== 'review' && <button type="button" onClick={() => navigate('review')} className={`${button} hidden bg-acid font-bold sm:block`}>Revisar publicación →</button>}
        </div>
      </div>
      <nav aria-label="Pasos de creación" className="mx-auto flex max-w-[1600px] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-t border-ink/20 px-4 md:px-8">
        {steps.map((s, i) => <button key={s.id} type="button" aria-current={step === s.id ? 'step' : undefined} onClick={() => navigate(s.id)} className={`min-h-12 shrink-0 border-b-4 px-4 font-mono text-d13 ${step === s.id ? 'border-ink bg-acid font-bold' : 'border-transparent hover:bg-ink/5'} ${FOCUS_RING}`}><span className="mr-2 text-d11">{String(i + 1).padStart(2, '0')}</span>{s.label}</button>)}
      </nav>
    </header>

    <div className="mx-auto max-w-[1500px] px-4 py-4 md:px-8 md:py-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 font-mono text-d11 uppercase tracking-widest">{workbench.isPublished ? 'Cambios a una publicación' : 'Borrador privado'}{event ? ` · Paso ${index + 1} de ${steps.length}` : ''}</p>
          <h1 ref={heading} tabIndex={-1} className={`max-w-3xl leading-snug focus:outline-none ${event ? 'font-syne text-2xl font-extrabold md:text-d28' : 'text-d18 text-ink-soft'}`}>{steps[index].description}</h1>
        </div>
        <div className="max-w-sm text-d13" role="status">
          <p className={workbench.syncState === 'error' ? 'font-bold text-sys-red-paper' : 'text-ink-soft'}>{saveLabel}</p>
          {workbench.lastSavedAt && workbench.syncState === 'saved' && <time className="mt-1 block font-mono text-d11" dateTime={new Date(workbench.lastSavedAt).toISOString()}>{new Date(workbench.lastSavedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</time>}
          {workbench.syncState === 'error' && <button type="button" onClick={() => void workbench.saveDraft()} className={`mt-2 min-h-11 underline ${FOCUS_RING}`}>Reintentar guardado</button>}
        </div>
      </div>
      {(workbench.recovered || closeError) && <p role="status" className="mb-6 border border-ink bg-paper-raised p-4 text-d15">{closeError ? 'No se pudo guardar. Conservamos el editor abierto para que puedas reintentarlo.' : 'Recuperamos los cambios de esta pestaña. Revisa tu borrador y espera a que se guarde en tu cuenta.'}</p>}

      {!workbench.hydrated ? <div role="status" className="border border-ink p-6">{workbench.loadError ? 'No encontramos este borrador. Puedes volver a tus borradores e intentarlo de nuevo.' : 'Abriendo tu borrador…'}</div> : <>
        <div className={step === 'review' ? 'hidden' : 'grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:gap-8'}>
          <div className="min-w-0">
            <details className="mb-4 border border-ink bg-paper-raised lg:hidden"><summary className={`min-h-11 cursor-pointer px-3 py-3 text-d13 font-bold ${FOCUS_RING}`}>Cómo dar forma a tu {typeLabel.toLowerCase()}</summary><ComposeGuide draft={draft} step={step} onPreview={() => navigate('review')} /></details>
            {sections.filter((section) => !isOptionalComposeSection(draft.type, section.props.number)).map((section) => <div key={section.props.number} hidden={sectionStep(draft.type, section.props.number) !== step}>{section}</div>)}
            {draft.type === 'noticia' && <details data-compose-optional className="mt-4 border border-ink/30 bg-paper-raised p-4"><summary className={`min-h-11 cursor-pointer py-2 text-d15 font-bold ${FOCUS_RING}`}>Imagen, resumen y contexto (opcional)</summary><div className="pt-4">{sections.filter((section) => isOptionalComposeSection(draft.type, section.props.number)).map((section) => <div key={section.props.number}>{section}</div>)}</div></details>}
          </div>
          <aside className="hidden min-w-0 lg:block lg:sticky lg:top-36" aria-label="Ayuda y vista previa">
            <div className="mb-3 flex border border-ink" role="group" aria-label="Herramientas de apoyo">
              <button type="button" aria-pressed={sideMode === 'guide'} onClick={() => setSideMode('guide')} className={`min-h-11 flex-1 px-3 text-d13 ${sideMode === 'guide' ? 'bg-ink text-paper' : 'hover:bg-acid'} ${FOCUS_RING}`}>Guía de {typeLabel.toLowerCase()}</button>
              <button type="button" aria-pressed={sideMode === 'preview'} onClick={() => setSideMode('preview')} className={`min-h-11 flex-1 px-3 text-d13 ${sideMode === 'preview' ? 'bg-ink text-paper' : 'hover:bg-acid'} ${FOCUS_RING}`}>Mi pieza</button>
            </div>
            {sideMode === 'guide' ? <ComposeGuide draft={draft} step={step} onPreview={() => setSideMode('preview')} /> : <ComposePreview draft={draft} full={!event && !media && step === 'content'} />}
            {outline.length > 0 && step === 'content' && <nav aria-label="Secciones de tu pieza" className="mt-4 border border-ink/30 p-4"><p className="mb-2 font-mono text-d11 uppercase tracking-widest">En esta pieza</p>{outline.map((entry) => <button type="button" key={entry.index} onClick={() => document.getElementById(`compose-block-${entry.index}`)?.scrollIntoView({ block: 'center' })} className={`block min-h-11 w-full text-left text-d13 underline-offset-4 hover:underline ${FOCUS_RING}`}>{entry.title}</button>)}</nav>}
          </aside>
        </div>
        {step === 'review' && <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <ComposePreview draft={draft} full />
          <aside className="border border-ink bg-paper-raised p-5 lg:sticky lg:top-36">
            <h2 className="font-syne text-xl font-extrabold">Antes de compartir</h2>
            <p className="mt-3 text-d15 leading-relaxed">{missing.length ? 'Revisa estos detalles para poder publicar. Tu borrador puede guardarse tal como está.' : recommended.length ? 'Puedes publicar ya. Estas sugerencias ayudan a que tu pieza se encuentre mejor.' : 'La información necesaria está completa. Comprueba el texto y la presentación.'}</p>
            {missing.length > 0 && <ul className="my-4 border-y border-ink/20 py-2" aria-label="Necesario para publicar">{missing.map((field) => <li key={field.key}><button type="button" onClick={() => jumpToField(field.anchorId)} className={`min-h-11 w-full text-left text-d15 underline ${FOCUS_RING}`}>{field.label} →</button></li>)}</ul>}
            {recommended.length > 0 && <div className="my-4 border-y border-ink/20 py-2"><p className="mb-1 font-mono text-d11 uppercase tracking-widest text-ink-soft">Recomendado</p><ul>{recommended.map((field) => <li key={field.key}><button type="button" onClick={() => jumpToField(field.anchorId)} className={`min-h-11 w-full text-left text-d13 text-ink-soft underline ${FOCUS_RING}`}>{field.label} →</button></li>)}</ul></div>}
            {!draft.imageUrl && <button type="button" onClick={() => jumpToField('compose-field-cover')} className={`my-3 min-h-11 text-left text-d13 underline ${FOCUS_RING}`}>Añadir portada (opcional) →</button>}
            {rail}
            <button type="button" disabled={missing.length > 0 || busy} onClick={() => void reviewPublish()} className={`${button} mt-5 w-full bg-acid font-bold`}>{busy ? 'Guardando…' : workbench.isPublished ? 'Actualizar publicación →' : 'Continuar a publicar →'}</button>
            <p className="mt-3 text-d13 leading-relaxed text-ink-soft">Confirmarás la publicación en el siguiente paso.</p>
          </aside>
        </div>}
      </>}
    </div>
    <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-ink bg-paper px-4 py-3 md:px-8">
      <div className="mx-auto flex max-w-[1436px] items-center justify-between gap-3">
        <div className="flex gap-2">
          <button type="button" disabled={!history.canUndo} onClick={history.undo} className={`min-h-11 px-2 text-d13 disabled:opacity-40 ${FOCUS_RING}`}>↶ Deshacer</button>
          <button type="button" disabled={!history.canRedo} onClick={history.redo} className={`min-h-11 px-2 text-d13 disabled:opacity-40 ${FOCUS_RING}`}>↷ Rehacer</button>
        </div>
        <div className="flex gap-2">
          {index > 0 && <button type="button" onClick={() => navigate(steps[index - 1].id)} className={`${button} hidden sm:block`}>← Atrás</button>}
          {index < steps.length - 1 && <button type="button" onClick={() => navigate(steps[index + 1].id)} className={`${button} bg-acid font-bold`}>{index === steps.length - 2 ? 'Revisar →' : 'Continuar →'}</button>}
          {index === steps.length - 1 && <button type="button" onClick={() => navigate('content')} className={button}>Volver a editar</button>}
        </div>
      </div>
    </footer>
  </div>
}
