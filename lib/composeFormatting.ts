export interface TextSelection { start: number; end: number }
export interface FormattedEdit extends TextSelection { text: string }

export function emphasizeSelection(text: string, selection: TextSelection, marker: '**' | '*'): FormattedEdit {
  const { start, end } = selection
  const selected = text.slice(start, end)
  // Repeating the action on the inner selection removes the same emphasis.
  const before = text.slice(0, start).match(/\*+$/)?.[0].length ?? 0
  const after = text.slice(end).match(/^\*+/)?.[0].length ?? 0
  const count = Math.min(before, after)
  const active = marker === '*' ? count % 2 === 1 : count >= 2
  if (active) {
    return { text: text.slice(0, start - marker.length) + selected + text.slice(end + marker.length), start: start - marker.length, end: end - marker.length }
  }
  const content = selected || 'texto'
  return { text: text.slice(0, start) + marker + content + marker + text.slice(end), start: start + marker.length, end: start + marker.length + content.length }
}

export function linkSelection(text: string, selection: TextSelection, label: string, url: string): FormattedEdit | null {
  let target: URL
  try { target = new URL(url.trim()) } catch { return null }
  if (!['https:', 'http:'].includes(target.protocol) || !label.trim()) return null
  // Encode delimiters that would otherwise terminate the existing inline syntax.
  const safeUrl = target.href.replace(/\(/g, '%28').replace(/\)/g, '%29')
  const safeLabel = label.trim().replace(/\[/g, '［').replace(/\]/g, '］').replace(/\n/g, ' ')
  const inserted = `[${safeLabel}](${safeUrl})`
  return { text: text.slice(0, selection.start) + inserted + text.slice(selection.end), start: selection.start + inserted.length, end: selection.start + inserted.length }
}
