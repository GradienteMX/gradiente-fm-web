'use client'

/**
 * ENCUESTA — one poll per piece, and its kind follows the format: a list
 * asks for a favorite from its entries, a mix from its tracklist, an event
 * asks who's going; everything else writes its own choices. Readers see
 * results only after voting.
 */

import type { ContentItem, PollAttachment } from '@/lib/types'
import { resolvePollChoices } from '@/lib/store/world-core'
import { POLL_DEFAULT_PROMPT } from '@/lib/logic/polls'
import { Mark } from '@/components/kit/Glyph'
import { TextField } from '@/components/kit/Field'
import { newId, newUuid } from '@/lib/store/world'
import { POLL_KIND_LABEL, emptyPoll, isoToLocal, localToIso, pollKindFor, type Formato } from '../model'
import { IconBtn, Switch } from './bits'
import f from './fields.module.css'

export function Encuesta({ item, type, onChange, id }: { item: ContentItem; type: Formato; onChange: (poll: PollAttachment | undefined) => void; id?: string }) {
  const poll = item.poll
  const kind = pollKindFor(type)
  const patch = (p: Partial<PollAttachment>) => poll && onChange({ ...poll, ...p })

  if (!poll) {
    return (
      <Switch
        id={id}
        on={false}
        // polls.id is a uuid: the route keeps this one, so a vote right after publishing names the poll.
        onChange={() => onChange(emptyPoll(kind, newUuid(), new Date().toISOString()))}
        label="Añadir una encuesta"
        hint={`${POLL_KIND_LABEL[kind]}. Anónima hasta que cada quien vota.`}
      />
    )
  }

  const derived = kind === 'freeform' ? [] : resolvePollChoices(item)
  const choices = poll.choices ?? []

  return (
    <div className={f.stack} style={{ gap: 16 }}>
      <Switch id={id} on onChange={() => onChange(undefined)} label="Encuesta activa" hint={POLL_KIND_LABEL[kind]} />
      <div className={f.panel}>
        <TextField
          label="Pregunta"
          value={poll.prompt}
          placeholder={POLL_DEFAULT_PROMPT[kind] || '¿Qué quieres preguntar?'}
          onChange={(e) => patch({ prompt: e.target.value })}
        />

        {kind === 'freeform' ? (
          <div className={f.stack} style={{ gap: 8 }}>
            <span className={f.label}>Opciones · {choices.length}</span>
            <div className={f.rows}>
              {choices.map((c, i) => (
                <div key={c.id} className={f.rowLine} style={{ gridTemplateColumns: '22px minmax(0, 1fr) auto' }}>
                  <span className={f.idx}>{i + 1}</span>
                  <input
                    id={`mesa-choice-${i}`}
                    className={f.cell}
                    value={c.label}
                    placeholder={`Opción ${i + 1}`}
                    aria-label={`Opción ${i + 1}`}
                    onChange={(e) => patch({ choices: choices.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && i === choices.length - 1 && c.label.trim()) {
                        e.preventDefault()
                        patch({ choices: [...choices, { id: newId('op'), label: '' }] })
                        requestAnimationFrame(() => document.getElementById(`mesa-choice-${i + 1}`)?.focus())
                      }
                    }}
                  />
                  <IconBtn label={`Quitar opción ${i + 1}`} onClick={() => patch({ choices: choices.filter((_, k) => k !== i) })}>
                    <Mark name="close" size={12} />
                  </IconBtn>
                </div>
              ))}
            </div>
            <button
              type="button"
              className={f.add}
              onClick={() => {
                patch({ choices: [...choices, { id: newId('op'), label: '' }] })
                requestAnimationFrame(() => document.getElementById(`mesa-choice-${choices.length}`)?.focus())
              }}
            >
              <Mark name="plus" size={13} /> Opción
            </button>
            {choices.filter((c) => c.label.trim()).length < 2 ? <p className={f.note}>Con menos de dos opciones la encuesta no se publica.</p> : null}
          </div>
        ) : (
          <div className={f.stack} style={{ gap: 8 }}>
            <span className={f.label}>Opciones · {derived.length ? `${derived.length}, se generan solas` : 'aún ninguna'}</span>
            {derived.length ? (
              <ol className={f.derived}>
                {derived.slice(0, 12).map((c, i) => (
                  <li key={c.id}>
                    <span>{i + 1}</span>
                    <span>
                      {c.label}
                      {c.sub ? ` · ${c.sub}` : ''}
                    </span>
                  </li>
                ))}
                {derived.length > 12 ? (
                  <li>
                    <span>…</span>
                    <span>y {derived.length - 12} más</span>
                  </li>
                ) : null}
              </ol>
            ) : (
              <p className={f.note}>{kind === 'from-list' ? 'Añade entradas a la lista y serán las opciones.' : 'Añade temas al tracklist y serán las opciones.'}</p>
            )}
          </div>
        )}

        <div className={f.row2}>
          <TextField
            label="Cierra (opcional)"
            type="datetime-local"
            value={isoToLocal(poll.closesAt)}
            onChange={(e) => patch({ closesAt: localToIso(e.target.value) })}
            hint="Sin fecha, queda abierta."
          />
          <div style={{ alignSelf: 'end' }}>
            <Switch on={!!poll.multiChoice} onChange={(v) => patch({ multiChoice: v || undefined })} label="Voto múltiple" hint="Permite elegir más de una opción." />
          </div>
        </div>
      </div>
    </div>
  )
}
