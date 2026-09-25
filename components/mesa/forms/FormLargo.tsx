'use client'

/** Artículo and Lista — the structured, long formats. */

import type { FormApi } from '../context'
import { FIELD_ID, type StepId } from '../model'
import { Seccion } from '../fields/bits'
import { Bloques } from '../fields/Bloques'
import { Notas } from '../fields/Notas'
import { Lista } from '../fields/Lista'
import { Titulo } from './Titulo'
import { need, sharedSection } from './shared'

export function FormArticulo({ api, step }: { api: FormApi; step: StepId }) {
  const { item, patch, env } = api
  return (
    <>
      {env.plan
        .filter((s) => s.step === step)
        .map((def) => {
          switch (def.key) {
            case 'titulo':
              return (
                <Seccion key={def.key} def={def} need={need(api, def.key)}>
                  <Titulo api={api} placeholder="El título del artículo" sub="Un subtítulo que abra la lectura (opcional)" />
                </Seccion>
              )
            case 'cuerpo':
              return (
                <Seccion key={def.key} def={def} hint="Abre con una escena o una idea. Las secciones ordenan el índice; una cita o una imagen cambian el ritmo.">
                  <Bloques id={FIELD_ID.body} value={item.articleBody ?? []} footnotes={item.footnotes} onChange={(articleBody) => patch({ articleBody })} />
                </Seccion>
              )
            case 'notas':
              return (
                <Seccion key={def.key} def={def} hint="Amplían una idea sin interrumpir la lectura. Úsalas solo donde hagan falta.">
                  <Notas value={item.footnotes ?? []} blocks={item.articleBody ?? []} onChange={(footnotes) => patch({ footnotes })} />
                </Seccion>
              )
            default:
              return sharedSection(def, api)
          }
        })}
    </>
  )
}

export function FormLista({ api, step }: { api: FormApi; step: StepId }) {
  const { item, patch, env } = api
  return (
    <>
      {env.plan
        .filter((s) => s.step === step)
        .map((def) => {
          switch (def.key) {
            case 'titulo':
              return (
                <Seccion key={def.key} def={def} need={need(api, def.key)}>
                  <Titulo api={api} placeholder="Discos para cuando baja la luz" sub="Qué reúne esta selección (opcional)" />
                </Seccion>
              )
            case 'lista':
              return (
                <Seccion key={def.key} def={def} hint="Una entrada por obra: artista, título, portada, dónde escucharla y tu razón. Las flechas deciden el orden.">
                  <Lista id={FIELD_ID.list} value={item.articleBody ?? []} onChange={(articleBody) => patch({ articleBody })} />
                </Seccion>
              )
            default:
              return sharedSection(def, api)
          }
        })}
    </>
  )
}
