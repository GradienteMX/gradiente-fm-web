'use client'

/**
 * REVISAR — read the piece as it will be read, see what's missing, decide
 * how it's signed, then commit with a gesture: hold to publish, and confirm
 * once more. Hard misses block the hold; soft ones are advice with a link.
 */

import { Pieza } from '@/components/pieza/Pieza'
import type { CardLayout } from '@/lib/curation'
import type { ContentItem } from '@/lib/types'
import { HoldButton } from '@/components/kit/HoldButton'
import { Button } from '@/components/kit/Button'
import { Sheet } from '@/components/kit/Sheet'
import { Mark } from '@/components/kit/Glyph'
import { effectiveBand, energyVariation } from '@/lib/vibe'
import { birthBracket, eVar, halfLifeWords, hardMisses, softMisses, type Formato, type Need } from './model'
import { Switch } from './fields/bits'
import { VistaPrevia } from './aside/Preview'
import s from './Revisar.module.css'

const LG: CardLayout = { tier: 'lg', colSpan: 2, rowSpan: 2, intensity: 1 }

export interface Levers {
  editorial?: { on: boolean; set: (v: boolean) => void }
  pinned?: { on: boolean; set: (v: boolean) => void }
  franja?: { on: boolean; set: (v: boolean) => void; name: string; prefix: string; fixed?: boolean }
}

interface Props {
  type: Formato
  preview: ContentItem
  cold: boolean
  needs: Need[]
  isEdit: boolean
  levers: Levers
  mode: 'tarjeta' | 'lectura'
  onMode: (m: 'tarjeta' | 'lectura') => void
  onJump: (n: Need) => void
  onHold: () => void
  onDiscard: () => void
}

export function Revisar({ type, preview, cold, needs, isEdit, levers, mode, onMode, onJump, onHold, onDiscard }: Props) {
  const hard = hardMisses(needs)
  const soft = softMisses(needs)
  const hardAll = needs.filter((n) => n.level === 'hard')
  const band = effectiveBand(preview)
  const mid = (band.min + band.max) / 2
  const editorial = levers.editorial?.on ?? !!preview.editorial

  return (
    <div className={s.revisar}>
      <VistaPrevia item={preview} cold={cold} mode={mode} onMode={onMode} big />

      <aside className={s.panel} aria-label="Antes de publicar">
        <div className={s.verdict} data-ready={!hard.length || undefined}>
          <span className="label" style={{ color: 'var(--ink-3)' }}>
            Antes de publicar
          </span>
          <h2 className={s.verdictTitle}>{hard.length ? `Falta${hard.length === 1 ? '' : 'n'} ${hard.length}` : isEdit ? 'Lista para actualizar' : 'Lista para el campo'}</h2>
          <div className={s.progress} aria-hidden="true">
            {hardAll.map((n) => (
              <span key={n.key} data-on={n.done || undefined} />
            ))}
          </div>
          <p className={s.verdictSub}>
            {hard.length
              ? 'Sin esto la pieza no puede nacer. Tu borrador se guarda tal como está.'
              : soft.length
                ? 'Puedes publicar ya. Lo recomendado ayuda a que tu pieza se encuentre mejor.'
                : 'Todo en su lugar. Léela una vez más en la vista previa.'}
          </p>
        </div>

        {hard.length ? (
          <div className={s.group}>
            <span className={s.groupLabel}>Necesario</span>
            {hard.map((n) => (
              <button key={n.key} type="button" className={s.need} onClick={() => onJump(n)}>
                <span>{n.label}</span>
                <span>Ir →</span>
              </button>
            ))}
          </div>
        ) : null}

        {soft.length ? (
          <div className={s.group}>
            <span className={s.groupLabel}>Recomendado</span>
            {soft.map((n) => (
              <button key={n.key} type="button" className={s.need} data-soft="" onClick={() => onJump(n)}>
                <span>{n.label}</span>
                <span>Ir →</span>
              </button>
            ))}
          </div>
        ) : null}

        {hardAll.some((n) => n.done) ? (
          <div className={s.done}>
            {hardAll
              .filter((n) => n.done)
              .map((n) => (
                <span key={n.key}>
                  <Mark name="check" size={11} /> {n.label}
                </span>
              ))}
          </div>
        ) : null}

        {levers.editorial || levers.pinned || levers.franja ? (
          <>
            <div className={s.rule} />
            <div className={s.group}>
              <span className={s.groupLabel}>Publicación y firma</span>
              {levers.editorial ? (
                <Switch
                  on={levers.editorial.on}
                  onChange={levers.editorial.set}
                  label="Selección editorial"
                  hint="La casa la siembra con más vida al nacer. Si nadie la toca, se apaga igual."
                />
              ) : null}
              {levers.pinned ? <Switch on={levers.pinned.on} onChange={levers.pinned.set} label="Fijar en portada" hint="Entra al carrusel de portada del campo." /> : null}
              {levers.franja ? (
                levers.franja.fixed ? (
                  <p className={s.life}>
                    Firmada por la franja: <b>{levers.franja.prefix} · {levers.franja.name}</b>.
                  </p>
                ) : (
                  <Switch
                    on={levers.franja.on}
                    onChange={levers.franja.set}
                    label="Publicar con mi franja"
                    hint={`La pieza lleva ${levers.franja.prefix} · ${levers.franja.name}, a la vista de todos.`}
                  />
                )
              ) : null}
            </div>
          </>
        ) : null}

        <div className={s.rule} />
        <p className={s.life}>
          {isEdit ? (
            <>Actualizar conserva su vida, su fecha y su enlace: solo cambia lo que escribiste.</>
          ) : (
            <>
              Nace <b className={s.private}>{birthBracket(editorial)}</b> <span className={s.privateTag}>· solo tú lo ves</span>. Su vida se reduce a la mitad cada{' '}
              {halfLifeWords(type)} si nadie la toca.
            </>
          )}
        </p>

        {/* The wrapper takes the panel's side margins, so `full` means the
            panel's inner width rather than 100% plus the margins. */}
        <div className={s.hold}>
          <HoldButton
            full
            energy={cold ? 5 : mid}
            disabled={hard.length > 0}
            onConfirm={onHold}
            holdingLabel={isEdit ? 'Actualizando…' : 'Publicando…'}
          >
            {isEdit ? 'Mantén para actualizar' : 'Mantén para publicar'}
          </HoldButton>
        </div>
        <p className={s.after}>{hard.length ? 'Completa lo necesario para poder publicar.' : 'Confirmarás una vez más antes de que nazca.'}</p>
        <button type="button" className={s.discard} onClick={onDiscard}>
          {isEdit ? 'Descartar estos cambios' : 'Descartar borrador'}
        </button>
      </aside>
    </div>
  )
}

export function Confirmar({
  open,
  item,
  type,
  isEdit,
  franja,
  onClose,
  onPublish,
}: {
  open: boolean
  item: ContentItem
  type: Formato
  isEdit: boolean
  franja: { name: string; prefix: string } | null
  onClose: () => void
  onPublish: () => void
}) {
  const band = effectiveBand(item)
  const mid = (band.min + band.max) / 2
  return (
    <Sheet open={open} onClose={onClose} label={isEdit ? '¿Actualizar en el campo?' : '¿Publicar en el campo?'} width={560}>
      <div className={s.confirm} style={{ ['--m-e' as string]: eVar(mid) }}>
        <span className="label" style={{ color: 'var(--ink-3)' }}>
          Último paso
        </span>
        <h2 className={s.confirmTitle} style={{ fontVariationSettings: energyVariation(mid) }}>
          {isEdit ? '¿Actualizar en el campo?' : '¿Publicar en el campo?'}
        </h2>
        <div className={s.confirmCard} inert>
          <Pieza item={item} layout={LG} life={1} />
        </div>
        <ul className={s.facts}>
          {isEdit ? (
            <>
              <li>
                <span>
                  Conserva su vida (<b>HL</b>), su fecha y su enlace.
                </span>
              </li>
              <li>
                <span>Quien ya la leyó verá la versión nueva.</span>
              </li>
            </>
          ) : (
            <>
              <li>
                <span>
                  Nace con vida (<b>HL</b>): la tuya la verás como <b className={s.private}>{birthBracket(!!item.editorial)}</b>{' '}
                  <span className={s.privateTag}>· solo tú lo ves</span>.
                </span>
              </li>
              <li>
                <span>Decae con el tiempo: se reduce a la mitad cada {halfLifeWords(type)} sin que nadie la toque.</span>
              </li>
              <li>
                <span>La comunidad la calibrará: con cinco lecturas, su energía la decide la mediana.</span>
              </li>
            </>
          )}
          {franja ? (
            <li>
              <span>
                Firmada: <b>{franja.prefix} · {franja.name}</b>.
              </span>
            </li>
          ) : null}
          {item.pinned ? (
            <li>
              <span>Entra a la portada.</span>
            </li>
          ) : null}
        </ul>
        <div className={s.confirmActions}>
          <Button variant="ghost" size="lg" onClick={onClose}>
            Volver
          </Button>
          <Button variant="ink" size="lg" onClick={onPublish} data-autofocus="" iconRight={<Mark name="arrow" size={15} />}>
            {isEdit ? 'Actualizar' : 'Publicar'}
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
