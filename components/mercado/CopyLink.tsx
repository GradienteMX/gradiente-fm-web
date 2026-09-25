'use client'

import { useState } from 'react'
import { Mark } from '@/components/kit/Glyph'
import chrome from './Chrome.module.css'

/** Copies an absolute link to a path on this site. */
export function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`)
    } catch {
      /* clipboard blocked — the button still acknowledges; the URL is in the bar on /mercado */
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button type="button" className={chrome.action} onClick={copy}>
      <Mark name={copied ? 'check' : 'share'} size={15} />
      <span>{copied ? 'Enlace copiado' : 'Copiar enlace'}</span>
    </button>
  )
}
