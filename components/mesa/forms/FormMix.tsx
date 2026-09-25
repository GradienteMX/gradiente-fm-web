'use client'

/** Mix — the audio is the piece; the rest is context and credit. */

import { TextField } from '@/components/kit/Field'
import type { FormApi } from '../context'
import { FIELD_ID, MIX_STATUS, durationOk, type StepId } from '../model'
import { Seccion } from '../fields/bits'
import { Texto } from '../fields/Texto'
import { Fuentes } from '../fields/Fuentes'
import { Tracklist } from '../fields/Tracklist'
import { Titulo } from './Titulo'
import { need, sharedSection } from './shared'
import f from '../fields/fields.module.css'

export function FormMix({ api, step }: { api: FormApi; step: StepId }) {
  const { item, patch, env } = api
  const status = item.mixStatus ?? 'disponible'
  const bpms = (item.tracklist ?? []).map((t) => t.bpm).filter((b): b is number => typeof b === 'number')
  const bpmFromList = bpms.length >= 2 ? `${Math.min(...bpms)}-${Math.max(...bpms)}` : null
  return (
    <>
      {env.plan
        .filter((s) => s.step === step)
        .map((def) => {
          switch (def.key) {
            case 'titulo':
              return (
                <Seccion key={def.key} def={def} need={need(api, def.key)}>
                  <Titulo api={api} placeholder="Título de la sesión" sub="Subtítulo (opcional)">
                    <TextField label="Artista" value={item.author ?? ''} placeholder="Quién toca · alias" onChange={(e) => patch({ author: e.target.value })} />
                  </Titulo>
                </Seccion>
              )
            case 'audio':
              return (
                <Seccion key={def.key} def={def} hint="Pega el enlace y comprueba que suene. Es la pieza central.">
                  <Fuentes id={FIELD_ID.audio} value={item.embeds ?? []} onChange={(embeds) => patch({ embeds })} />
                  <div className={f.stack} style={{ gap: 8 }}>
                    <span className={f.label}>Estado</span>
                    <div className={f.seg} role="radiogroup" aria-label="Estado del mix">
                      {MIX_STATUS.map((s) => (
                        <button key={s.id} type="button" role="radio" aria-checked={status === s.id} className={f.segBtn} onClick={() => patch({ mixStatus: s.id })}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <p className={f.note}>{MIX_STATUS.find((s) => s.id === status)?.meaning}</p>
                  </div>
                  <div className={f.row2}>
                    <TextField
                      label="Duración"
                      value={item.duration ?? ''}
                      placeholder="1:04:12"
                      inputMode="numeric"
                      onChange={(e) => patch({ duration: e.target.value })}
                      error={item.duration && !durationOk(item.duration) ? 'Escríbela como 1:04:12 o 58:30.' : undefined}
                      hint="Horas:minutos:segundos."
                    />
                  </div>
                </Seccion>
              )
            case 'tracklist':
              return (
                <Seccion key={def.key} def={def} hint="Da crédito a los artistas. Puedes añadirla después.">
                  <Tracklist value={item.tracklist ?? []} onChange={(tracklist) => patch({ tracklist })} />
                </Seccion>
              )
            case 'texto':
              return (
                <Seccion key={def.key} def={def} hint="Quién toca, cómo se grabó, qué recorrido propone.">
                  <Texto
                    id={FIELD_ID.body}
                    label="Sobre la sesión"
                    size="small"
                    value={item.bodyPreview ?? ''}
                    onChange={(bodyPreview) => patch({ bodyPreview })}
                    paragraphs
                    counter
                    placeholder="Una hora entre el dub y la madrugada…"
                    helper="Deja una línea en blanco entre párrafos."
                  />
                </Seccion>
              )
            case 'ficha':
              return (
                <Seccion key={def.key} def={def} hint="Datos de la sesión que se leen en su ficha.">
                  <div className={f.row3}>
                    <TextField label="Serie" value={item.mixSeries ?? ''} placeholder="Espectro Mix" onChange={(e) => patch({ mixSeries: e.target.value })} />
                    <TextField label="Grabado en" value={item.recordedIn ?? ''} placeholder="Club Japan · CDMX" onChange={(e) => patch({ recordedIn: e.target.value })} />
                    <TextField label="Formato" value={item.mixFormat ?? ''} placeholder="DJ set · live · radio" onChange={(e) => patch({ mixFormat: e.target.value })} />
                  </div>
                  <div className={f.row3}>
                    <div className={f.stack} style={{ gap: 6 }}>
                      <TextField label="BPM (rango)" value={item.bpmRange ?? ''} placeholder="128-134" onChange={(e) => patch({ bpmRange: e.target.value })} />
                      {bpmFromList && item.bpmRange !== bpmFromList ? (
                        <button type="button" className={f.textBtn} style={{ alignSelf: 'flex-start' }} onClick={() => patch({ bpmRange: bpmFromList })}>
                          Usar {bpmFromList} del tracklist
                        </button>
                      ) : null}
                    </div>
                    <TextField label="Tonalidad" value={item.musicalKey ?? ''} placeholder="D#m" onChange={(e) => patch({ musicalKey: e.target.value })} />
                  </div>
                </Seccion>
              )
            default:
              return sharedSection(def, api)
          }
        })}
    </>
  )
}
