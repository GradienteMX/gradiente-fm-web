'use client'

import { useState } from 'react'
import { useUI } from '@/lib/store/ui'
import { useMe } from '@/lib/store/session'
import { newId, useDispatch } from '@/lib/store/world'
import type { ReportRow } from '@/lib/store/world-core'
import { Sheet } from '@/components/kit/Sheet'
import { Button } from '@/components/kit/Button'
import { TextArea } from '@/components/kit/Field'
import styles from './Reportar.module.css'

const REASONS: Array<{ id: ReportRow['reason']; label: string; hint: string }> = [
  { id: 'spam', label: 'Spam', hint: 'Publicidad, enlaces repetidos, ruido' },
  { id: 'acoso', label: 'Acoso', hint: 'Ataques dirigidos a una persona' },
  { id: 'odio', label: 'Odio', hint: 'Discriminación por quién es alguien' },
  { id: 'sexual', label: 'Contenido sexual', hint: 'Explícito o no consentido' },
  { id: 'violencia', label: 'Violencia', hint: 'Amenazas o apología' },
  { id: 'enganoso', label: 'Engañoso', hint: 'Información falsa que hace daño' },
  { id: 'copyright', label: 'Copyright', hint: 'Obra ajena sin permiso' },
  { id: 'otro', label: 'Otro', hint: 'Cuéntalo en la nota' },
]

/** Reports go to the mod queue in Central. Nothing is ever auto-removed. */
export function Reportar() {
  const target = useUI((s) => s.report)
  const close = useUI((s) => s.closeReport)
  const notify = useUI((s) => s.notify)
  const me = useMe()
  const dispatch = useDispatch()
  const [reason, setReason] = useState<ReportRow['reason'] | null>(null)
  const [note, setNote] = useState('')

  const submit = () => {
    if (!me || !target || !reason) return
    const at = new Date().toISOString()
    dispatch({
      t: 'report',
      report: { id: newId('rp'), reporterId: me.id, targetType: target.type, targetId: target.id, reason, note: note.trim() || undefined, at, status: 'abierto' },
      at,
    })
    notify('Reporte enviado. Moderación lo revisa; nada se borra solo.')
    setReason(null)
    setNote('')
    close()
  }

  return (
    <Sheet open={Boolean(target)} onClose={close} label="Reportar" width={520} z={96}>
      {target ? (
        <div className={styles.body}>
          <p className={styles.kicker}>
            <span className={styles.name}>Reportar</span>
            <span className={styles.rest}>— lo revisa moderación; nada se borra solo</span>
          </p>
          <p className={styles.target}>{target.label}</p>
          <p className={styles.legend} id="reportar-motivo">
            Motivo
          </p>
          <div className={styles.reasons} role="radiogroup" aria-labelledby="reportar-motivo">
            {REASONS.map((r) => (
              <button key={r.id} type="button" role="radio" aria-checked={reason === r.id} data-on={reason === r.id || undefined} className={styles.reason} onClick={() => setReason(r.id)}>
                <span className={styles.tick} aria-hidden="true" />
                <span className={styles.reasonText}>
                  <span className={styles.reasonLabel}>{r.label}</span>
                  <span className={styles.reasonHint}>{r.hint}</span>
                </span>
              </button>
            ))}
          </div>
          <TextArea label="Nota (opcional)" value={note} onChange={(e) => setNote(e.target.value.slice(0, 1000))} counter={{ value: note.length, max: 1000 }} rows={3} />
          <div className={styles.actions}>
            <Button variant="quiet" onClick={close}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={submit} disabled={!reason}>
              Enviar reporte
            </Button>
          </div>
        </div>
      ) : null}
    </Sheet>
  )
}
