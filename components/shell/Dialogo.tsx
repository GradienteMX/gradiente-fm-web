'use client'

import { useState } from 'react'
import { useUI } from '@/lib/store/ui'
import { Sheet } from '@/components/kit/Sheet'
import { Button } from '@/components/kit/Button'
import { TextField } from '@/components/kit/Field'
import styles from './Dialogo.module.css'

/** Promise-based confirm / input / type-to-confirm. Replaces window.prompt. */
export function Dialogo() {
  const d = useUI((s) => s.dialog)
  const settle = useUI((s) => s.settleDialog)
  // What's typed belongs to one dialog: a new one starts empty.
  const [draft, setDraft] = useState<{ for: typeof d; text: string }>({ for: null, text: '' })
  const text = draft.for === d ? draft.text : ''
  const setText = (t: string) => setDraft({ for: d, text: t })

  const cancel = () => settle(null)
  const confirmOk = (() => {
    if (!d) return false
    // Labels are set in capitals: accept the phrase in any case.
    if (d.typeToConfirm) return text.trim().toLowerCase() === d.typeToConfirm.trim().toLowerCase()
    if (d.input) return text.trim().length >= (d.input.minLength ?? 1) && text.length <= (d.input.maxLength ?? 1000)
    return true
  })()

  const confirm = () => {
    if (!d || !confirmOk) return
    settle(d.input ? text.trim() : true)
  }

  return (
    <Sheet open={Boolean(d)} onClose={cancel} label={d?.title ?? 'Confirmación'} width={480} z={95}>
      {d ? (
        <form
          className={styles.body}
          data-destructive={d.destructive || undefined}
          onSubmit={(e) => {
            e.preventDefault()
            confirm()
          }}
        >
          <p className={styles.kicker}>{d.destructive ? 'Irreversible' : 'Confirmación'}</p>
          <h2 className={styles.title}>{d.title}</h2>
          {d.body ? <p className={styles.text}>{d.body}</p> : null}
          {d.input ? (
            <TextField
              label={d.input.label}
              placeholder={d.input.placeholder}
              value={text}
              onChange={(e) => setText(e.target.value)}
              counter={d.input.maxLength ? { value: text.length, max: d.input.maxLength } : undefined}
              data-autofocus=""
            />
          ) : null}
          {d.typeToConfirm ? (
            <TextField
              label={`Escribe «${d.typeToConfirm}» para confirmar`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              data-autofocus=""
              autoComplete="off"
            />
          ) : null}
          <div className={styles.actions}>
            <Button variant="quiet" onClick={cancel}>
              {d.cancelLabel ?? 'Cancelar'}
            </Button>
            <Button variant={d.destructive ? 'danger' : 'ink'} type="submit" disabled={!confirmOk}>
              {d.confirmLabel ?? 'Confirmar'}
            </Button>
          </div>
        </form>
      ) : null}
    </Sheet>
  )
}
