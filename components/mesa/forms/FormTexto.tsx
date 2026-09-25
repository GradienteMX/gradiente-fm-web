'use client'

/** Reseña · Editorial · Opinión — the reading-room formats. */

import type { ItemFormat } from '@/lib/types'
import { TextField } from '@/components/kit/Field'
import type { FormApi } from '../context'
import { FIELD_ID, FORMATS_BY_SUBJECT, SUBJECTS, isHappening, type StepId } from '../model'
import { Seccion } from '../fields/bits'
import { Texto } from '../fields/Texto'
import { Entidades } from '../fields/Vinculos'
import { Titulo } from './Titulo'
import { need, sharedSection } from './shared'
import f from '../fields/fields.module.css'

const TITLE: Record<string, { ph: string; sub: string; body: string }> = {
  review: {
    ph: 'Artista — Título de la obra',
    sub: 'Sello · año (opcional)',
    body: 'Describe lo que escuchaste y explica tu lectura. Un ejemplo concreto dice más que un adjetivo.',
  },
  editorial: {
    ph: 'Una idea, dicha claro',
    sub: 'Un subtítulo que la complete (opcional)',
    body: 'Presenta el tema y la postura de la casa. Distingue los hechos de la opinión; enlaza tus fuentes.',
  },
  opinion: {
    ph: 'Tu postura, en una línea',
    sub: 'Un subtítulo que la matice (opcional)',
    body: 'Plantea una postura concreta y sostenla con ejemplos. Cierra con algo que abra conversación.',
  },
}

export function FormTexto({ api, step }: { api: FormApi; step: StepId }) {
  const { item, patch, env } = api
  const cfg = TITLE[env.type] ?? TITLE.editorial
  return (
    <>
      {env.plan
        .filter((s) => s.step === step)
        .map((def) => {
          switch (def.key) {
            case 'titulo':
              return (
                <Seccion key={def.key} def={def} need={need(api, def.key)}>
                  <Titulo api={api} placeholder={cfg.ph} sub={cfg.sub} />
                </Seccion>
              )
            case 'resena': {
              const subject = item.subjectKind ?? 'record'
              const formats = FORMATS_BY_SUBJECT[subject]
              return (
                <Seccion key={def.key} def={def} hint="Qué es lo que reseñas. Aparece en el contexto de la lectura.">
                  <div className={f.stack} style={{ gap: 8 }}>
                    <span className={f.label}>Es una reseña de</span>
                    <div className={f.seg} role="radiogroup" aria-label="Reseña de">
                      {SUBJECTS.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          role="radio"
                          aria-checked={subject === s.id}
                          className={f.segBtn}
                          onClick={() => patch({ subjectKind: s.id, format: isHappening(s.id) ? undefined : FORMATS_BY_SUBJECT[s.id].some((x) => x.id === item.format) ? item.format : undefined })}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {formats.length ? (
                    <div className={f.stack} style={{ gap: 8 }}>
                      <span className={f.label}>Formato</span>
                      <div className={f.seg} role="group" aria-label="Formato">
                        {formats.map((x) => (
                          <button
                            key={x.id}
                            type="button"
                            aria-pressed={item.format === x.id}
                            className={f.segBtn}
                            onClick={() => patch({ format: item.format === x.id ? undefined : (x.id as ItemFormat) })}
                          >
                            {x.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <Entidades kinds={['venue', 'promoter']} value={item.entities ?? []} onChange={(entities) => patch({ entities })} />
                  )}
                  <div className={f.row2}>
                    <TextField label="País" value={item.country ?? ''} placeholder="México" onChange={(e) => patch({ country: e.target.value })} />
                    <TextField
                      label="Año"
                      inputMode="numeric"
                      value={item.year ?? ''}
                      placeholder="2026"
                      onChange={(e) => {
                        const n = parseInt(e.target.value.replace(/\D/g, '').slice(0, 4), 10)
                        patch({ year: Number.isFinite(n) ? n : undefined })
                      }}
                    />
                  </div>
                </Seccion>
              )
            }
            case 'texto':
              return (
                <Seccion key={def.key} def={def} hint={cfg.body}>
                  <Texto
                    id={FIELD_ID.body}
                    label="Texto de la pieza"
                    value={item.bodyPreview ?? ''}
                    onChange={(bodyPreview) => patch({ bodyPreview })}
                    counter
                    paragraphs
                    placeholder="Empieza aquí. No tienes que saber escribir bien: solo tener algo que decir."
                    helper="Deja una línea en blanco entre párrafos. Selecciona una frase para resaltarla o enlazarla."
                  />
                </Seccion>
              )
            default:
              return sharedSection(def, api)
          }
        })}
    </>
  )
}
